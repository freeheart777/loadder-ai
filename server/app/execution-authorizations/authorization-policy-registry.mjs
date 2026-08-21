const freeze=(entry)=>Object.freeze({...entry,supportedActionTypes:Object.freeze([...entry.supportedActionTypes]),supportedActionVersions:Object.freeze([...entry.supportedActionVersions]),supportedRiskClasses:Object.freeze([...entry.supportedRiskClasses])});
function validate(entry){
 if(!entry||typeof entry.policyId!=="string"||!entry.policyId||!Number.isInteger(entry.version)||entry.version<1||
  !Array.isArray(entry.supportedActionTypes)||!entry.supportedActionTypes.length||
  !Array.isArray(entry.supportedActionVersions)||entry.supportedActionVersions.some(x=>!Number.isInteger(x)||x<1)||
  !Array.isArray(entry.supportedRiskClasses)||entry.supportedRiskClasses.some(x=>x!=="LOW")||
  entry.requiredRole!=="owner"||!Number.isInteger(entry.expirySeconds)||entry.expirySeconds<60||entry.expirySeconds>3600||
  typeof entry.selfApprovalAllowed!=="boolean"||typeof entry.decisionAuthorApprovalAllowed!=="boolean"||
  typeof entry.acknowledgementCode!=="string"||!entry.acknowledgementCode||
  !(entry.providerCapability===null||typeof entry.providerCapability==="string"))throw new Error("Authorization policy is invalid.");
 return freeze(entry);
}
export function createAuthorizationPolicyRegistry(entries=[]){const policies=entries.map(validate);return Object.freeze({
 list:()=>[...policies],
 resolve:(proposal)=>policies.find(p=>p.supportedActionTypes.includes(proposal.actionType)&&p.supportedActionVersions.includes(proposal.actionVersion)&&p.supportedRiskClasses.includes(proposal.riskClass))||null,
});}
// No approved executable Action Proposal contract exists.
export const authorizationPolicyRegistry=createAuthorizationPolicyRegistry();
