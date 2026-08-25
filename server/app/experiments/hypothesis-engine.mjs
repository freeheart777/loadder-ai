export function createHypothesisEngine() {
  return {
    fromDiagnosis(diagnosis) {
      if (!diagnosis) return null;

      return {
        statement: `Test intervention for ${diagnosis.problem}`,
        sourceDiagnosisId: diagnosis.id || null,
        confidence: diagnosis.confidence || 0,
        createdAt: new Date().toISOString(),
      };
    },
  };
}
