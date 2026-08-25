import { buildEvidence } from './diagnosis-evidence.mjs';
import { matchDiagnosisRules } from './diagnosis-registry.mjs';

/**
 * Diagnosis Orchestrator v1
 *
 * Evidence-first deterministic diagnosis pipeline.
 * No LLM assumptions. No static intelligence claims.
 */
export function runDiagnosis({ businessState = {}, objective = null } = {}) {
  const evidence = buildEvidence(businessState);

  const diagnoses = matchDiagnosisRules({
    evidence,
    objective,
  });

  return {
    objective,
    evidence,
    diagnoses,
    generatedAt: new Date().toISOString(),
  };
}

export default runDiagnosis;
