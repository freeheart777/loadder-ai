// Loadder Diagnosis Registry v1
// Evidence-first deterministic diagnosis rules.

const registry = [
  {
    id: "revenue_conversion_drop",
    objective: "revenue_growth",
    evidence: ["revenue_down", "conversion_down"],
    diagnosis: "conversion_constraint",
    confidence: 0.8,
    recommendedAction: "create_conversion_experiment"
  },
  {
    id: "retention_decline",
    objective: "retention_growth",
    evidence: ["repeat_purchase_down", "inactive_customers_up"],
    diagnosis: "retention_constraint",
    confidence: 0.75,
    recommendedAction: "create_reactivation_experiment"
  }
];

export function getDiagnosisRules() {
  return registry;
}

export function findDiagnosisRules(objective) {
  return registry.filter(rule => !objective || rule.objective === objective);
}
