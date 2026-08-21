const freeze=entry=>Object.freeze({...entry,supportedActionTypes:Object.freeze([...entry.supportedActionTypes]),supportedActionVersions:Object.freeze([...entry.supportedActionVersions])});
function validate(entry){
 if(!entry||typeof entry.policyId!=="string"||!entry.policyId||!Number.isInteger(entry.version)||entry.version<1||
  typeof entry.authorizationPolicy!=="string"||!entry.authorizationPolicy||!Number.isInteger(entry.authorizationPolicyVersion)||entry.authorizationPolicyVersion<1||
  !Array.isArray(entry.supportedActionTypes)||!entry.supportedActionTypes.length||!Array.isArray(entry.supportedActionVersions)||entry.supportedActionVersions.some(v=>!Number.isInteger(v)||v<1)||
  typeof entry.requiredProviderCapability!=="string"||!entry.requiredProviderCapability||!Number.isInteger(entry.requestLifetimeSeconds)||entry.requestLifetimeSeconds<1||
  entry.sameAuthorizerRequired!==true||entry.singleUseRequired!==true||typeof entry.reconciliationRequired!=="boolean")throw new Error("Execution Request policy is invalid.");
 return freeze(entry);
}
export function createExecutionRequestPolicyRegistry(entries=[]){const policies=entries.map(validate);return Object.freeze({list:()=>[...policies],resolve:(authorization,proposal)=>policies.find(p=>p.authorizationPolicy===authorization.authorizationPolicy&&p.authorizationPolicyVersion===authorization.authorizationPolicyVersion&&p.supportedActionTypes.includes(proposal.actionType)&&p.supportedActionVersions.includes(proposal.actionVersion))||null});}
// No executable proposal or authorization policy is approved.
export const executionRequestPolicyRegistry=createExecutionRequestPolicyRegistry();
