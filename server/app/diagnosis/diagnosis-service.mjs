import { performance } from "node:perf_hooks";

function scoreHealth(metrics = {}) {
  const values = Object.values(metrics).filter((v) => typeof v === "number");
  if (!values.length) return 50;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.max(0, Math.min(100, Math.round(avg)));
}

function detectConstraint(state = {}) {
  const candidates = [
    ["conversion", state.conversion],
    ["retention", state.retention],
    ["traffic", state.traffic],
    ["revenue", state.revenue],
  ];

  return candidates
    .filter(([, value]) => typeof value === "number")
    .sort((a, b) => a[1] - b[1])[0]?.[0] || null;
}

export function createDiagnosisService({ operationMetrics } = {}) {
  function diagnose(input = {}) {
    const started = performance.now();
    const businessState = input.businessState || {};
    const constraint = detectConstraint(businessState);

    const diagnosis = {
      healthScore: scoreHealth(input.metrics),
      constraint,
      evidence: [],
      recommendations: [],
    };

    if (constraint) {
      diagnosis.evidence.push(`${constraint}_metric_requires_attention`);
      diagnosis.recommendations.push({
        action: `investigate_${constraint}`,
        confidence: 0.5,
        requiresExperiment: true,
      });
    }

    operationMetrics?.record({
      operation: "diagnosis.run",
      durationMs: performance.now() - started,
      resultCount: 1,
    });

    return diagnosis;
  }

  return Object.freeze({ diagnose });
}
