import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";
import { decodeCursor, CursorPaginationError } from "../query/cursor-pagination.mjs";
import { createOperationMetrics } from "../observability/operation-metrics.mjs";

export class ActionProposalError extends Error {
  constructor(message,status=400,code="ACTION_PROPOSAL_INVALID"){super(message);this.status=status;this.code=code;}
}
const canonical=(value)=>value===null||typeof value!=="object"?JSON.stringify(value):Array.isArray(value)?`[${value.map(canonical).join(",")}]`:`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
const hash=(value)=>crypto.createHash("sha256").update(canonical(value)).digest("hex");
const text=(value,name)=>{if(typeof value!=="string"||!value.trim()||value.trim().length>200)throw new ActionProposalError(`${name} is invalid.`);return value.trim();};

export function createActionProposalService({repository,registry,decisionQuery,recommendationRepository,now=()=>new Date(),operationMetrics=createOperationMetrics()}){
  function create(decisionId,payload,actor,idempotencyKey){
    const started=performance.now(),workspaceId=requireWorkspaceId();let rowsRead=0,rowsWritten=0,reusedResult=false,failure=null;
    try{
      if(!actor||!["owner","admin"].includes(actor.role))throw new ActionProposalError("Action proposal permission denied.",403,"ACTION_PROPOSAL_PERMISSION_DENIED");
      if(!payload||typeof payload!=="object"||Array.isArray(payload)||Object.keys(payload).length!==1||typeof payload.actionType!=="string")throw new ActionProposalError("Action proposal request must contain only actionType.");
      const actionType=text(payload.actionType,"actionType"),key=text(idempotencyKey,"Idempotency-Key");
      const contract=registry.get(actionType,1);
      if(!contract)throw new ActionProposalError("No approved action proposal contract exists for this action type.",409,"ACTION_PROPOSAL_UNSUPPORTED");
      const decision=decisionQuery.getDecision(text(decisionId,"decisionId"));rowsRead++;
      if(!decision)throw new ActionProposalError("Decision not found.",404,"DECISION_NOT_FOUND");
      if(decision.decisionType!=="ADOPT"||decision.executionAuthorizing!==false)throw new ActionProposalError("Decision is not eligible for an action proposal.",409,"DECISION_NOT_ADOPTED");
      const head=decisionQuery.getDecisionHead(decision.recommendationId);rowsRead++;
      if(!head||head.id!==decision.id)throw new ActionProposalError("Decision has been superseded.",409,"DECISION_SUPERSEDED");
      const recommendation=recommendationRepository.getById(decision.recommendationId);rowsRead++;
      if(!recommendation)throw new ActionProposalError("Recommendation not found.",404,"RECOMMENDATION_NOT_FOUND");
      if(decision.contextVersionId!==recommendation.contextVersionId||decision.recommendationVersion!==recommendation.recommendationVersion)throw new ActionProposalError("Decision and recommendation identity do not match.",409,"DECISION_RECOMMENDATION_MISMATCH");
      if(!contract.supportedRecommendationTypes.includes(recommendation.recommendationType)||!contract.supportedDecisionTypes.includes(decision.decisionType))throw new ActionProposalError("The action contract does not support this governance identity.",409,"ACTION_PROPOSAL_UNSUPPORTED");
      const targetType=contract.supportedTargetTypes[0],targetKey=recommendation.subjectKey;
      const requestHash=hash({decisionId:decision.id,actionType:contract.actionType,actionVersion:contract.actionVersion});
      const inputManifestHash=hash({decision:{id:decision.id,type:decision.decisionType,contextVersionId:decision.contextVersionId},recommendation:{id:recommendation.id,type:recommendation.recommendationType,version:recommendation.recommendationVersion,contextVersionId:recommendation.contextVersionId,pointInTimeCutoff:recommendation.pointInTimeCutoff}});
      const proposalIdentity={workspaceId,decisionId:decision.id,recommendationId:recommendation.id,actionType:contract.actionType,actionVersion:contract.actionVersion,schemaVersion:contract.schemaVersion,targetType,targetKey,contextVersionId:recommendation.contextVersionId,pointInTimeCutoff:recommendation.pointInTimeCutoff,riskClass:contract.riskClass,executionEligible:false,executable:false,requiresAuthorization:true,producer:contract.producer,producerVersion:contract.producerVersion,policyVersion:contract.policyVersion,inputManifestHash};
      const proposalHash=hash(proposalIdentity),producerKey=proposalHash;
      const saved=repository.create({decision,recommendation,contract,targetType,targetKey,actor,idempotencyKey:key,requestHash,inputManifestHash,proposalHash,producerKey,producer:contract.producer,producerVersion:contract.producerVersion,createdAt:now().toISOString()});
      if(saved.requestHash!==requestHash)throw new ActionProposalError("Idempotency key was reused with a different request.",409,"IDEMPOTENCY_KEY_REUSED");
      rowsWritten=Number(saved.created);reusedResult=!saved.created;
      return{proposal:saved.proposal,reusedResult,created:saved.created};
    }catch(error){failure=error.code||"UNEXPECTED_ERROR";throw error;}
    finally{operationMetrics.record({operation:"action_proposal.create",workspaceId,durationMs:performance.now()-started,rowsRead,rowsWritten,resultCount:rowsWritten,reusedResult,errorCode:failure,proposalCount:rowsWritten});}
  }
  function list(query={}){
    const started=performance.now(),workspaceId=requireWorkspaceId();let count=0,failure=null;
    try{
      if(Object.keys(query).some(key=>!["limit","cursor"].includes(key)))throw new ActionProposalError("Query contains unsupported filters.");
      const limit=Number(query.limit||50);if(!Number.isInteger(limit)||limit<1||limit>100)throw new ActionProposalError("limit must be between 1 and 100.");
      let cursor;try{cursor=decodeCursor(query.cursor,"action_proposals",["createdAt","id"]);}catch(error){if(error instanceof CursorPaginationError)throw new ActionProposalError(error.message,400,error.code);throw error;}
      const page=repository.listPage({limit,cursor});count=page.items.length;return page;
    }catch(error){failure=error.code||"UNEXPECTED_ERROR";throw error;}
    finally{operationMetrics.record({operation:"action_proposal.list",workspaceId,durationMs:performance.now()-started,rowsRead:count,rowsWritten:0,resultCount:count,errorCode:failure,proposalCount:count});}
  }
  function get(id){
    const started=performance.now(),workspaceId=requireWorkspaceId();let item=null,failure=null;
    try{item=repository.getById(text(id,"proposalId"));if(!item)throw new ActionProposalError("Action proposal not found.",404,"ACTION_PROPOSAL_NOT_FOUND");return item;}
    catch(error){failure=error.code||"UNEXPECTED_ERROR";throw error;}
    finally{operationMetrics.record({operation:"action_proposal.get",workspaceId,durationMs:performance.now()-started,rowsRead:item?1:0,rowsWritten:0,resultCount:item?1:0,errorCode:failure,proposalCount:item?1:0});}
  }
  return Object.freeze({create,list,get,operationMeasurements:operationMetrics.recent});
}
