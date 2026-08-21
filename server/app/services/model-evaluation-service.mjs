import { DETERMINISTIC_EVALUATOR, evaluateDeterministically } from "../evaluators/deterministic-input-consistency-evaluator.mjs";

export class ModelEvaluationError extends Error{constructor(message,status=400,code="MODEL_EVALUATION_ERROR"){super(message);this.status=status;this.code=code;}}
const id=(value,label)=>{if(typeof value!=="string"||!value.trim()||value.length>200)throw new ModelEvaluationError(`${label} is invalid.`);return value.trim();};
const limit=(value)=>{const parsed=Number(value??50);if(!Number.isInteger(parsed)||parsed<1||parsed>100)throw new ModelEvaluationError("limit must be between 1 and 100.");return parsed;};

export function createModelEvaluationService({specificationRegistry,modelInputRepository,evaluationRepository,modelInputBuilder,now=()=>new Date()}){
  return Object.freeze({
    listSpecifications(){return specificationRegistry.list();},
    buildInput(payload,userId){const specificationId=id(payload.specificationId,"specificationId"),subjectType=id(payload.subjectType,"subjectType"),subjectId=id(payload.subjectId,"subjectId");
      const version=Number(payload.specificationVersion??1);if(!Number.isInteger(version)||version<1)throw new ModelEvaluationError("specificationVersion is invalid.");
      if(payload.asOf!==undefined&&!Number.isFinite(Date.parse(payload.asOf)))throw new ModelEvaluationError("asOf must be an ISO timestamp.");
      const result=modelInputBuilder.build({specificationId,specificationVersion:version,subjectType,subjectId,asOf:payload.asOf?new Date(payload.asOf).toISOString():null,userId,repository:modelInputRepository});
      if(result.state==="UNKNOWN_SPECIFICATION")throw new ModelEvaluationError("Model specification not found.",404,"SPECIFICATION_NOT_FOUND");return result;},
    getInput(value){const result=modelInputRepository.getById(id(value,"inputSnapshotId"));if(!result)throw new ModelEvaluationError("Model Input Snapshot not found.",404,"MODEL_INPUT_NOT_FOUND");return result;},
    listInputs(query={}){return modelInputRepository.list({specificationId:query.specificationId,subjectType:query.subjectType,subjectId:query.subjectId,status:query.status,limit:limit(query.limit)});},
    runEvaluation(payload){const snapshot=this.getInput(payload.inputSnapshotId);if(snapshot.status!=="ready")throw new ModelEvaluationError("Model Input Snapshot is not ready.",409,"MODEL_INPUT_NOT_READY");
      const specification=specificationRegistry.get(snapshot.specificationId,snapshot.specificationVersion);if(!specification)throw new ModelEvaluationError("Pinned model specification is unavailable.",409,"SPECIFICATION_UNAVAILABLE");
      if(specification.evaluator.evaluatorId!==DETERMINISTIC_EVALUATOR.evaluatorId||specification.evaluator.evaluatorVersion!==DETERMINISTIC_EVALUATOR.evaluatorVersion)throw new ModelEvaluationError("Evaluator is incompatible.",409,"EVALUATOR_INCOMPATIBLE");
      const evaluatedAt=now().toISOString(),result=evaluateDeterministically({snapshot,specification,evaluatedAt});
      return evaluationRepository.create({specificationId:snapshot.specificationId,specificationVersion:snapshot.specificationVersion,inputSnapshotId:snapshot.id,
        contextVersionId:snapshot.contextVersionId,...DETERMINISTIC_EVALUATOR,...result,evaluatedAt,createdAt:evaluatedAt});},
    getEvaluation(value){const result=evaluationRepository.getById(id(value,"evaluationId"));if(!result)throw new ModelEvaluationError("Evaluation not found.",404,"EVALUATION_NOT_FOUND");return result;},
    listEvaluations(query={}){return evaluationRepository.list({specificationId:query.specificationId,inputSnapshotId:query.inputSnapshotId,limit:limit(query.limit)});},
  });
}
