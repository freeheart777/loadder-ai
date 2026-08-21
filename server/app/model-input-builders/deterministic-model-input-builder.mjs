import crypto from "node:crypto";

const BUILDER = "canonical_feature_snapshot_builder";
const BUILDER_VERSION = "1.0";
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");

function manifest(feature) {
  return { featureValueId: feature.id, featureName: feature.featureName, featureVersion: feature.featureVersion,
    valueType: feature.valueType, producer: feature.producer, producerVersion: feature.producerVersion,
    calculatedAt: feature.calculatedAt, validUntil: feature.validUntil };
}

export function createDeterministicModelInputBuilder({ contextGateway, featureRepository, specificationRegistry, now=()=>new Date() }) {
  return Object.freeze({
    build({ specificationId, specificationVersion=1, subjectType, subjectId, asOf=null, userId=null, executionRequestId=null, repository }) {
      const specification=specificationRegistry.get(specificationId,specificationVersion);
      if(!specification)return {state:"UNKNOWN_SPECIFICATION",snapshot:null};
      if(subjectType!==specification.subjectType)throw new Error("Subject type does not match the model specification.");
      const timestamp=asOf||now().toISOString();
      const gateway=contextGateway.consume({consumer:"model_inputs",operation:"build_model_input",executionRequestId,userId});
      if(gateway.state!=="READY")return {state:gateway.state,staleReasons:gateway.staleReasons||[],snapshot:null};
      if(!specification.supportedContextSchemaVersions.includes(gateway.contextSchemaVersion))return {state:"UNSUPPORTED_SCHEMA",snapshot:null};

      const available=featureRepository.listPointInTime(subjectType,subjectId,timestamp);
      const selected=[], missing=[], expired=[], incompatible=[], unavailable=[];
      for(const requirement of [...specification.requiredFeatures,...specification.optionalFeatures]){
        const named=available.filter((item)=>item.featureName===requirement.featureName);
        const contextual=named.filter((item)=>item.contextVersionId===gateway.contextVersionId);
        const compatible=contextual.filter((item)=>item.featureVersion===requirement.featureVersion&&item.valueType===requirement.valueType);
        const fresh=compatible.find((item)=>!item.validUntil||item.validUntil>timestamp);
        if(fresh){selected.push(fresh);continue;}
        const detail={featureName:requirement.featureName,featureVersion:requirement.featureVersion,valueType:requirement.valueType};
        if(compatible.length)expired.push({...detail,featureValueIds:compatible.map((item)=>item.id)});
        else if(contextual.length)incompatible.push({...detail,available:contextual.map((item)=>({featureValueId:item.id,featureVersion:item.featureVersion,valueType:item.valueType}))});
        else if(named.length)unavailable.push({...detail,reason:"NOT_AVAILABLE_FOR_ACTIVE_CONTEXT"});
        else missing.push(detail);
      }
      const featureManifest=selected.map(manifest);
      const featureValues=Object.fromEntries(selected.map((item)=>[item.featureName,{featureValueId:item.id,featureVersion:item.featureVersion,valueType:item.valueType,value:item.value}]));
      const status=incompatible.length?"incompatible":(missing.length||expired.length||unavailable.length)?"incomplete":"ready";
      const identity={specificationId:specification.specificationId,specificationVersion:specification.specificationVersion,
        subjectType,subjectId,contextVersionId:gateway.contextVersionId,snapshotSchemaVersion:specification.snapshotSchemaVersion,
        asOf:timestamp,featureManifest,missing,expired,incompatible,unavailable};
      const snapshot=repository.create({...identity,status,featureValues,missingFeatures:missing,expiredFeatures:expired,
        incompatibleFeatures:incompatible,unavailableFeatures:unavailable,builder:BUILDER,builderVersion:BUILDER_VERSION,
        producerKey:hash(stable(identity)),provenance:{sourceLayer:"feature_values",featureValueIds:featureManifest.map((item)=>item.featureValueId),
          contextVersionId:gateway.contextVersionId,contextSchemaVersion:gateway.contextSchemaVersion,pointInTime:timestamp,
          imputationApplied:false},createdAt:now().toISOString()});
      return {state:status==="ready"?"READY":"INCOMPLETE_INPUT",snapshot};
    },
  });
}
