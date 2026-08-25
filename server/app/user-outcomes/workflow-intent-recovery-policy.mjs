const MINUTE=60_000;

export const workflowIntentRecoveryPolicy=Object.freeze({
 id:"WORKFLOW_INTENT_RECOVERY_V1",
 version:1,
 workflowType:"GROWTH_STRATEGY",
 providerTimeoutMs:40_000,
 activeThroughMs:2*MINUTE,
 orphanedAfterMs:15*MINUTE,
 rationale:Object.freeze(["ACTIVE_WINDOW_EXCEEDS_PROVIDER_TIMEOUT","AGING_WINDOW_ALLOWS_RESPONSE_PERSISTENCE_LAG","STALE_INTENT_REQUIRES_HUMAN_RECONCILIATION"]),
});

export function classifyWorkflowIntentRecovery(intent,observedAt=new Date()){
 const terminal=intent?.terminalPosture??intent?.terminal_posture;
 if(terminal==="COMPLETED")return Object.freeze({posture:"COMPLETED",ageMs:null,policyId:workflowIntentRecoveryPolicy.id,policyVersion:workflowIntentRecoveryPolicy.version,reasonCode:"CANONICAL_COMPLETION"});
 if(terminal==="FAILED")return Object.freeze({posture:"FAILED",ageMs:null,policyId:workflowIntentRecoveryPolicy.id,policyVersion:workflowIntentRecoveryPolicy.version,reasonCode:"CANONICAL_FAILURE"});
 const startedAt=intent?.startedAt??intent?.started_at,ageMs=Date.parse(observedAt)-Date.parse(startedAt);
 if(terminal!=="STARTED"||!Number.isFinite(ageMs))return Object.freeze({posture:"UNKNOWN",ageMs:null,policyId:workflowIntentRecoveryPolicy.id,policyVersion:workflowIntentRecoveryPolicy.version,reasonCode:"RECOVERY_EVIDENCE_INVALID"});
 if(ageMs<=workflowIntentRecoveryPolicy.activeThroughMs)return Object.freeze({posture:"ACTIVE",ageMs:Math.max(0,ageMs),policyId:workflowIntentRecoveryPolicy.id,policyVersion:workflowIntentRecoveryPolicy.version,reasonCode:ageMs<0?"CLOCK_SKEW_FAIL_SAFE_ACTIVE":"WITHIN_ACTIVE_WINDOW"});
 if(ageMs<workflowIntentRecoveryPolicy.orphanedAfterMs)return Object.freeze({posture:"AGING",ageMs,policyId:workflowIntentRecoveryPolicy.id,policyVersion:workflowIntentRecoveryPolicy.version,reasonCode:"BEYOND_ACTIVE_WINDOW"});
 return Object.freeze({posture:"ORPHANED_UNKNOWN",ageMs,policyId:workflowIntentRecoveryPolicy.id,policyVersion:workflowIntentRecoveryPolicy.version,reasonCode:"STALE_UNRESOLVED_OUTCOME"});
}
