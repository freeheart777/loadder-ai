const ACTIONS=Object.freeze({
  discover_products:{mode:"READ",capability:"commerce:catalog:read",confirmation:false,idempotency:false},
  check_inventory:{mode:"READ",capability:"commerce:inventory:read",confirmation:false,idempotency:false},
  get_order:{mode:"READ",capability:"commerce:orders:read",confirmation:false,idempotency:false},
  track_order:{mode:"READ",capability:"commerce:fulfillment:read",confirmation:false,idempotency:false},
  create_cart:{mode:"WRITE",capability:"commerce:cart:write",confirmation:false,idempotency:true},
  apply_promotion:{mode:"WRITE",capability:"commerce:cart:write",confirmation:false,idempotency:true},
  checkout:{mode:"HIGH_IMPACT",capability:"commerce:checkout:write",confirmation:true,idempotency:true},
  return_item:{mode:"HIGH_IMPACT",capability:"commerce:returns:write",confirmation:true,idempotency:true},
});

const clone=v=>structuredClone(v);
const freeze=v=>{if(v&&typeof v==="object"&&!Object.isFrozen(v)){Object.freeze(v);for(const x of Object.values(v))freeze(x)}return v};
const text=(v,max=256)=>{const s=String(v??"").trim();if(!s||s.length>max)throw new Error("AGENT_COMMERCE_INVALID_TEXT");return s};
const safeInt=(v,code)=>{if(!Number.isSafeInteger(v)||v<0)throw new Error(code);return v};
const has=(xs,v)=>Array.isArray(xs)&&xs.includes(v);
const quantities=input=>{let total=0;const visit=v=>{if(Array.isArray(v))return v.forEach(visit);if(!v||typeof v!=="object")return;for(const[k,x]of Object.entries(v)){if(k==="quantity"){if(!Number.isSafeInteger(x)||x<=0)throw new Error("AGENT_COMMERCE_INVALID_QUANTITY");total+=x;if(!Number.isSafeInteger(total))throw new Error("AGENT_COMMERCE_QUANTITY_OVERFLOW")}else visit(x)}};visit(input);return total};
const proposedMoney=input=>{for(const key of["totalMinor","amountMinor","requestedMinor","proposedTotalMinor"]){if(input&&Object.prototype.hasOwnProperty.call(input,key))return safeInt(input[key],"AGENT_COMMERCE_INVALID_MONEY")}return null};

export class AgentCommerceSafetyError extends Error{constructor(code,status=400,message=code){super(message);this.name="AgentCommerceSafetyError";this.code=code;this.status=status}}
export function getAgentCommerceActionCatalog(){return freeze(clone(ACTIONS))}

export function authorizeAgentCommerceAction({action,input={},principal,authorization={},limits={}}){
  const name=String(action??"").trim();const policy=ACTIONS[name];
  if(!policy)throw new AgentCommerceSafetyError("AGENT_COMMERCE_UNKNOWN_ACTION",400);
  if(!principal||principal.type!=="AGENT")throw new AgentCommerceSafetyError("AGENT_COMMERCE_AGENT_PRINCIPAL_REQUIRED",401);
  const workspaceId=text(principal.workspaceId),storeId=text(principal.storeId),actorId=text(principal.actorId);
  if(!has(principal.capabilities,policy.capability))throw new AgentCommerceSafetyError("AGENT_COMMERCE_CAPABILITY_REQUIRED",403);
  if(input.workspaceId!=null&&String(input.workspaceId)!==workspaceId)throw new AgentCommerceSafetyError("AGENT_COMMERCE_WORKSPACE_MISMATCH",403);
  if(input.storeId!=null&&String(input.storeId)!==storeId)throw new AgentCommerceSafetyError("AGENT_COMMERCE_STORE_MISMATCH",403);

  const maxQuantity=limits.maxQuantity==null?100:safeInt(limits.maxQuantity,"AGENT_COMMERCE_INVALID_LIMIT");
  const maxAmountMinor=limits.maxAmountMinor==null?1_000_000_000:safeInt(limits.maxAmountMinor,"AGENT_COMMERCE_INVALID_LIMIT");
  const quantity=quantities(input);if(quantity>maxQuantity)throw new AgentCommerceSafetyError("AGENT_COMMERCE_QUANTITY_LIMIT_EXCEEDED",422);
  const amount=proposedMoney(input);if(amount!=null&&amount>maxAmountMinor)throw new AgentCommerceSafetyError("AGENT_COMMERCE_AMOUNT_LIMIT_EXCEEDED",422);

  let idempotencyKey=null;
  if(policy.idempotency){idempotencyKey=String(authorization.idempotencyKey??"").trim();if(idempotencyKey.length<8||idempotencyKey.length>200)throw new AgentCommerceSafetyError("AGENT_COMMERCE_IDEMPOTENCY_REQUIRED",428)}
  if(policy.confirmation){
    const c=authorization.confirmation;
    if(!c||c.verifiedBy!=="HUMAN_CONTROL_PLANE"||c.action!==name||c.workspaceId!==workspaceId||c.storeId!==storeId)throw new AgentCommerceSafetyError("AGENT_COMMERCE_HUMAN_CONFIRMATION_REQUIRED",428);
    const expires=Date.parse(c.expiresAt||"");if(!Number.isFinite(expires)||expires<=Date.now())throw new AgentCommerceSafetyError("AGENT_COMMERCE_CONFIRMATION_EXPIRED",428);
  }

  return freeze({allowed:true,action:name,mode:policy.mode,capability:policy.capability,workspaceId,storeId,actorId,idempotencyKey,limits:{maxQuantity,maxAmountMinor},observed:{quantity,amountMinor:amount}});
}

export function createAgentCommerceCommand({decision,input,requestId}){
  if(!decision?.allowed||!ACTIONS[decision.action])throw new AgentCommerceSafetyError("AGENT_COMMERCE_AUTHORIZATION_REQUIRED",403);
  const command={requestId:text(requestId,200),action:decision.action,workspaceId:decision.workspaceId,storeId:decision.storeId,actorId:decision.actorId,idempotencyKey:decision.idempotencyKey??null,input:clone(input)};
  if(command.input?.workspaceId!=null&&String(command.input.workspaceId)!==command.workspaceId)throw new AgentCommerceSafetyError("AGENT_COMMERCE_WORKSPACE_MISMATCH",403);
  if(command.input?.storeId!=null&&String(command.input.storeId)!==command.storeId)throw new AgentCommerceSafetyError("AGENT_COMMERCE_STORE_MISMATCH",403);
  return freeze(command);
}
