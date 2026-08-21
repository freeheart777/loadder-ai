import crypto from "node:crypto";

export const DETERMINISTIC_EVALUATOR = Object.freeze({evaluatorId:"deterministic_input_consistency",evaluatorVersion:"1.0",evaluationSchemaVersion:"1.0"});
const hash=(value)=>crypto.createHash("sha256").update(value).digest("hex");

export function evaluateDeterministically({snapshot,specification,evaluatedAt}){
  if(snapshot.status!=="ready")throw new Error("Only ready Model Input Snapshots can be evaluated.");
  const values=snapshot.featureValues;
  const checks=[
    {code:"ABANDONED_VALUE_NON_NEGATIVE",passed:Number.isFinite(values.cart_abandoned_value?.value)&&values.cart_abandoned_value.value>=0},
    {code:"OPPORTUNITY_VALUE_CONSISTENT",passed:values.cart_recovery_opportunity_active?.value===(values.cart_abandoned_value?.value>0)},
    {code:"VALUE_BAND_RECOGNIZED",passed:["low","medium","high"].includes(values.cart_recovery_value_band?.value)},
  ];
  const passed=checks.filter((item)=>item.passed).length;
  return {
    producerKey:hash(`${specification.specificationId}@${specification.specificationVersion}|${snapshot.id}|${DETERMINISTIC_EVALUATOR.evaluatorId}@${DETERMINISTIC_EVALUATOR.evaluatorVersion}`),
    output:{assessment:passed===checks.length?"consistent":"inconsistent",explanationCodes:checks.filter((item)=>!item.passed).map((item)=>item.code),
      interpretation:"Deterministic input consistency only; this is not a prediction, recommendation, decision, or action."},
    metrics:{requiredFeatureCount:specification.requiredFeatures.length,availableFeatureCount:snapshot.featureManifest.length,
      completenessRatio:snapshot.featureManifest.length/specification.requiredFeatures.length,consistencyChecks:checks.length,
      consistencyChecksPassed:passed,consistencyRatio:passed/checks.length},
    provenance:{inputSnapshotId:snapshot.id,featureValueIds:snapshot.featureManifest.map((item)=>item.featureValueId),
      contextVersionId:snapshot.contextVersionId,specification:{id:specification.specificationId,version:specification.specificationVersion},
      evaluator:{...DETERMINISTIC_EVALUATOR},evaluatedAt},
  };
}
