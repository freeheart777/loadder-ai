export function emitListeningCanonicalRecords({ intelligenceRepository, featureRepository, aggregates, anomaly, metrics, ids, request, contextVersionId, calculatedAt, duration, hash }) {
  if (!contextVersionId) return { observation: null, features: [] };
  const observationKey = hash(["observation", aggregates.map((aggregate) => aggregate.id)]);
  const observation = intelligenceRepository.createObservation({
    observationType: "listening.aggregate_set", observationVersion: 1, subjectType: "workspace", subjectId: contextVersionId,
    contextVersionId, windowStart: request.start, windowEnd: request.end, valueType: "json",
    jsonValue: Object.fromEntries(aggregates.map((aggregate) => [aggregate.metricType, { state: aggregate.state, value: aggregate.value }])),
    sourceEventCount: ids.length, sourceManifest: { listeningAggregateIds: aggregates.map((aggregate) => aggregate.id), recordIds: ids },
    calculatedAt, validUntil: new Date(Date.parse(request.end) + duration).toISOString(), producer: "listening_intelligence", producerVersion: "1.0", producerKey: observationKey,
  });
  const definitions = [
    ["brand_mentions_24h", request.window === "24h" ? metrics.brand : null],
    ["brand_mentions_growth_24h", request.window === "24h" ? metrics.growth : null],
    ["brand_share_of_voice_7d", request.window === "7d" ? metrics.values.share_of_voice.value : null],
    ["competitor_mentions_24h", request.window === "24h" && metrics.entitySets.competitor.size ? metrics.competitor : null],
    ["engagement_total_24h", request.window === "24h" && metrics.hasEngagement ? metrics.engagementTotal : null],
    ["listening_anomaly_active", ["elevated", "anomalous"].includes(anomaly.state)],
  ];
  const features = definitions.filter(([, value]) => value !== null && value !== undefined).map(([name, value]) => featureRepository.create({
    featureName: name, featureVersion: 1, subjectType: "workspace", subjectId: contextVersionId, contextVersionId,
    windowStart: request.start, windowEnd: request.end, valueType: typeof value === "boolean" ? "boolean" : "numeric", value,
    calculatedAt, validUntil: new Date(Date.parse(request.end) + duration).toISOString(), producer: "listening_feature_set", producerVersion: "1.0",
    producerKey: hash([name, observation.id]), sourceObservationIds: [observation.id], sourceSignalIds: [],
    provenance: { sourceAggregateIds: aggregates.map((aggregate) => aggregate.id), window: request.window, contextVersionId }, createdAt: calculatedAt,
  }));
  return { observation, features };
}
