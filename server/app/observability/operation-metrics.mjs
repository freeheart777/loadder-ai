const DEFAULT_LIMIT = 200;
const numeric = (value) => Math.max(0, Number(value) || 0);
const average = (items, field) => items.reduce((total, item) => total + item[field], 0) / items.length;
const percentile = (values, proportion) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * proportion) - 1)];
};

export function createOperationMetrics({ limit = DEFAULT_LIMIT, sink = null } = {}) {
  const measurements = [];

  function record(input) {
    const measurement = Object.freeze({
      operation: input.operation,
      workspaceId: input.workspaceId || null,
      durationMs: numeric(input.durationMs),
      rowsRead: numeric(input.rowsRead),
      rowsWritten: numeric(input.rowsWritten),
      resultCount: numeric(input.resultCount),
      reusedResult: Boolean(input.reusedResult),
      errorCode: input.errorCode || null,
      measuredAt: input.measuredAt || new Date().toISOString(),
      currentWindowRows: numeric(input.currentWindowRows),
      previousWindowRows: numeric(input.previousWindowRows),
      topicMatchesGenerated: numeric(input.topicMatchesGenerated),
      aggregatesGenerated: numeric(input.aggregatesGenerated),
      featureCount: numeric(input.featureCount),
      evidenceCount: numeric(input.evidenceCount),
      findingCount: numeric(input.findingCount),
      insufficientEvidenceCount: numeric(input.insufficientEvidenceCount),
      semanticFindingCount: numeric(input.semanticFindingCount),
      recommendationCount: numeric(input.recommendationCount),
      reviewCount: numeric(input.reviewCount),
      decisionCount: numeric(input.decisionCount),
      proposalCount: numeric(input.proposalCount),
      authorizationCount: numeric(input.authorizationCount),
      requestCount: numeric(input.requestCount),
      identityCount: numeric(input.identityCount),
      providerKind: input.providerKind || null,
      verificationMethod: input.verificationMethod || null,
      capabilityId: input.capabilityId || null,
      capabilityVersion: input.capabilityVersion || null,
      providerSafetyClass: input.providerSafetyClass || null,
      attemptNumber: numeric(input.attemptNumber),
      resultType: input.resultType || null,
      normalizedErrorCode: input.normalizedErrorCode || null,
      jobKind: input.jobKind || null,
      processingAttempts: numeric(input.processingAttempts),
      leaseGeneration: numeric(input.leaseGeneration),
      riskClass: input.riskClass || null,
      policyVersion: input.policyVersion || null,
      requestPolicyVersion: input.requestPolicyVersion || null,
      actionType: input.actionType || null,
      actionVersion: input.actionVersion || null,
      schemaVersion: input.schemaVersion || null,
      sensitivityClass: input.sensitivityClass || null,
      sizeBucket: input.sizeBucket || null,
      mediaType: input.mediaType || null,
      contractId: input.contractId || null,
      contractVersion: input.contractVersion || null,
      placementId: input.placementId || null,
      placementVersion: input.placementVersion || null,
      providerBindingVersion: input.providerBindingVersion || null,
      providerModel: input.providerModel || null,
      inputTokens: numeric(input.inputTokens),
      outputTokens: numeric(input.outputTokens),
    });
    measurements.push(measurement);
    if (measurements.length > limit) measurements.splice(0, measurements.length - limit);
    if (sink) sink(measurement);
    return measurement;
  }

  function summary(operation = null) {
    const grouped = new Map();
    for (const item of measurements) {
      if (operation && item.operation !== operation) continue;
      if (!grouped.has(item.operation)) grouped.set(item.operation, []);
      grouped.get(item.operation).push(item);
    }
    return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([name, items]) => ({
      operation: name,
      count: items.length,
      errorCount: items.filter((item) => item.errorCode).length,
      reuseCount: items.filter((item) => item.reusedResult).length,
      averageDurationMs: average(items, "durationMs"),
      p50DurationMs: percentile(items.map((item) => item.durationMs), 0.5),
      p95DurationMs: percentile(items.map((item) => item.durationMs), 0.95),
      maxDurationMs: Math.max(...items.map((item) => item.durationMs)),
      averageRowsRead: average(items, "rowsRead"),
      averageRowsWritten: average(items, "rowsWritten"),
      averageResultCount: average(items, "resultCount"),
    }));
  }

  return {
    record,
    recent: () => [...measurements],
    summary,
  };
}
