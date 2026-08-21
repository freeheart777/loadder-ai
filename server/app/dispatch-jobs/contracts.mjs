import crypto from"node:crypto";
const canonical=v=>v===null||typeof v!=="object"?JSON.stringify(v):Array.isArray(v)?`[${v.map(canonical).join(",")}]`:`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`;
export const JOB_KINDS=Object.freeze(["DISPATCH","RECONCILIATION"]);
export const BLOCKED_REASON_CODES=Object.freeze(["MANUAL_INTERVENTION_REQUIRED","EXECUTION_UNAVAILABLE","UNKNOWN_UNRESOLVED","RECONCILIATION_UNAVAILABLE","POLICY_UNAVAILABLE"]);
export const RECOVERY_DECISIONS=Object.freeze(["COMPLETE_FROM_TERMINAL_RESULT","BLOCK_UNKNOWN","RESUME_PRE_INVOCATION_EVALUATION","RESCHEDULE_RECONCILIATION","WAIT","NO_ACTION"]);
export function buildDispatchClaimKey({workspaceId,jobId,executionRequestId,jobKind,jobGeneration}={}){if(![workspaceId,jobId,executionRequestId,jobKind].every(v=>typeof v==="string"&&v.length>0)||!JOB_KINDS.includes(jobKind)||!Number.isInteger(jobGeneration)||jobGeneration<1)throw new Error("Dispatch claim identity is invalid.");return crypto.createHash("sha256").update(canonical({domain:"loadder:dispatch-claim:v1",workspaceId,jobId,executionRequestId,jobKind,jobGeneration})).digest("hex");}
