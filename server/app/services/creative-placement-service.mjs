import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";
import { decodeCursor } from "../query/cursor-pagination.mjs";

const KINDS = new Set(["WEBSITE","SOCIAL","ADVERTISEMENT","EMAIL","OTHER"]), ROLES = new Set(["owner","admin","member"]);
const canonical = (value) => JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a],[b]) => a.localeCompare(b))));
const hash = (value) => crypto.createHash("sha256").update(canonical(value)).digest("hex");
export class CreativePlacementError extends Error { constructor(code,status=400){super(code);this.code=code;this.status=status;} }
const fail=(code,status)=>{throw new CreativePlacementError(code,status);};
const safe=(item)=>item&&Object.freeze({id:item.id,contentItemId:item.contentItemId,placementKind:item.placementKind,channel:item.channel,status:item.status,externalReferenceId:item.externalReferenceId,createdAt:item.createdAt,updatedAt:item.updatedAt});

export function createCreativePlacementService({ repository, contentItemRepository, operationMetrics, now=()=>new Date() }) {
  const permission=(actor)=>{if(!actor?.userId||!ROLES.has(actor.role))fail("CREATIVE_PLACEMENT_PERMISSION_DENIED",403);};
  const content=(id)=>contentItemRepository.findById(id)||fail("CONTENT_ITEM_NOT_FOUND",404);
  const metric=(operation,started,data={})=>operationMetrics.record({operation,workspaceId:requireWorkspaceId(),durationMs:performance.now()-started,...data});
  return Object.freeze({
    create(contentItemId,input,actor,rawKey){const started=performance.now();permission(actor);content(contentItemId);if(!input||typeof input!=="object"||Array.isArray(input)||Object.keys(input).some(k=>!["placementKind","channel"].includes(k))||!KINDS.has(input.placementKind)||typeof input.channel!=="string")fail("CREATIVE_PLACEMENT_INVALID");const channel=input.channel.trim().toLowerCase();if(!/^[a-z0-9][a-z0-9._-]{0,79}$/.test(channel))fail("CREATIVE_PLACEMENT_INVALID");if(typeof rawKey!=="string"||!rawKey.trim()||rawKey.length>200)fail("CREATIVE_PLACEMENT_INVALID");const idempotencyKey=rawKey.trim(),requestHash=hash({contentItemId,placementKind:input.placementKind,channel}),prior=repository.findByIdempotency(actor.userId,idempotencyKey);if(prior){if(prior.requestHash!==requestHash)fail("CREATIVE_PLACEMENT_IDEMPOTENCY_CONFLICT",409);metric("creative_placement.create",started,{reusedResult:true,rowsRead:1});return{placement:safe(prior),reusedResult:true};}const result=repository.create({contentItemId,placementKind:input.placementKind,channel,userId:actor.userId,idempotencyKey,requestHash,now:now().toISOString()});if(!result.created&&result.placement.requestHash!==requestHash)fail("CREATIVE_PLACEMENT_IDEMPOTENCY_CONFLICT",409);metric("creative_placement.create",started,{rowsWritten:Number(result.created),reusedResult:!result.created});return{placement:safe(result.placement),reusedResult:!result.created};},
    list(contentItemId,query,actor){const started=performance.now();permission(actor);content(contentItemId);if(Object.keys(query||{}).some(k=>!["limit","cursor"].includes(k)))fail("CREATIVE_PLACEMENT_INVALID");const limit=query?.limit===undefined?20:Number(query.limit);if(!Number.isInteger(limit)||limit<1||limit>100)fail("CREATIVE_PLACEMENT_INVALID");let cursor;try{cursor=decodeCursor(query?.cursor,"creative_placements",["createdAt","id"]);}catch{fail("CREATIVE_PLACEMENT_INVALID");}const page=repository.listPage(contentItemId,{limit,cursor});metric("creative_placement.list",started,{rowsRead:page.items.length,resultCount:page.items.length});return{placements:page.items.map(safe),nextCursor:page.nextCursor};}
  });
}
