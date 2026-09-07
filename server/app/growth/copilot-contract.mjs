import { createHash } from 'node:crypto';

export const COPILOT_CAPABILITIES = Object.freeze([
  'READ_GROWTH_CONTEXT', 'READ_APPROVED_TREATMENT',
  'READ_CRM_OUTCOME_EVIDENCE', 'PREPARE_NEXT_EXPERIMENT_DRAFT',
]);
export class CopilotError extends Error {
  constructor(code, status=400) { super(code); this.code=code; this.status=status; }
}
export function copilotId(value) {
  if(typeof value!=='string' || !value.trim() || value.length>200) throw new CopilotError('COPILOT_INVALID_INPUT');
  return value.trim();
}
export function normalizeCopilotInput(input) {
  const fields=['capability','experimentId','contextVersionId','goalRef','candidateId','idempotencyKey'];
  if(!input || typeof input!=='object' || Array.isArray(input) || Object.keys(input).some(k=>!fields.includes(k))) throw new CopilotError('COPILOT_INVALID_INPUT');
  if(!COPILOT_CAPABILITIES.includes(input.capability)) throw new CopilotError('COPILOT_CAPABILITY_DENIED');
  const refs={contractVersion:1, mode:'COPILOT', capability:input.capability,
    experimentId:copilotId(input.experimentId), contextVersionId:copilotId(input.contextVersionId),
    goalRef:copilotId(input.goalRef), candidateId:input.candidateId==null?null:copilotId(input.candidateId)};
  if(!/^\/strategy\/goals\/(0|[1-9][0-9]{0,4})$/.test(refs.goalRef)) throw new CopilotError('COPILOT_INVALID_INPUT');
  if(refs.capability!=='READ_GROWTH_CONTEXT' && !refs.candidateId) throw new CopilotError('COPILOT_TREATMENT_REQUIRED');
  return {refs, idempotencyKey:copilotId(input.idempotencyKey)};
}
export const copilotHash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
