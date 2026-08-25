export function evaluateGuardrails(result, guardrails = []) {
  return guardrails.map((metric) => ({
    metric,
    passed: Boolean(result?.[metric]),
  }));
}
