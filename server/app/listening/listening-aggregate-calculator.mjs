import { listeningMetricRegistry } from "./listening-intelligence-contracts.mjs";
import { collectEntitySets, recordMentionsEntity } from "./listening-topic-matcher.mjs";

export function calculateListeningAggregateValues({ current, previous, topics, context, duration }) {
  const entitySets = collectEntitySets(current, context);
  const countMentions = (rows, set) => rows.filter((record) => recordMentionsEntity(record, set)).length;
  const brand = countMentions(current, entitySets.brand);
  const competitor = countMentions(current, entitySets.competitor);
  const tracked = brand + competitor;
  const engagementValues = current.flatMap((record) => Object.entries(record.engagement)
    .filter(([key, value]) => !["views", "rating", "ratingScale"].includes(key) && Number.isFinite(value))
    .map(([, value]) => value));
  const engagementTotal = engagementValues.reduce((sum, value) => sum + value, 0);
  const views = current.reduce((sum, record) => sum + (Number.isFinite(record.engagement.views) ? record.engagement.views : 0), 0);
  const hasEngagement = engagementValues.length > 0;
  const hasViews = current.some((record) => Number.isFinite(record.engagement.views));
  const distribution = (field) => current.reduce((result, record) => {
    const key = record[field] || "unknown";
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
  const topicDistribution = topics.reduce((result, topic) => {
    result[topic.topic] = (result[topic.topic] || 0) + 1;
    return result;
  }, {});
  const priorCount = previous.length;
  const growth = priorCount ? (current.length - priorCount) / priorCount : null;
  const values = {
    mention_count: { value: current.length },
    unique_source_count: { value: new Set(current.map((record) => record.provider)).size },
    engagement_total: hasEngagement ? { value: engagementTotal } : { state: "unavailable" },
    engagement_rate: hasEngagement && hasViews && views > 0 ? { value: engagementTotal / views, numerator: engagementTotal, denominator: views } : { state: "unavailable" },
    source_distribution: { value: distribution("provider") },
    language_distribution: { value: distribution("language") },
    channel_distribution: { value: distribution("source_category") },
    mention_velocity: { value: current.length / (duration / 3600000) },
    mention_growth_rate: priorCount ? { value: growth, numerator: current.length - priorCount, denominator: priorCount } : { state: "insufficient_data" },
    share_of_voice: tracked ? { value: brand / tracked, numerator: brand, denominator: tracked } : { state: "unavailable" },
    topic_frequency: Object.keys(topicDistribution).length ? { value: topicDistribution } : { state: "unavailable" },
    topic_velocity: Object.keys(topicDistribution).length ? { value: Object.fromEntries(Object.entries(topicDistribution).map(([key, value]) => [key, value / (duration / 3600000)])) } : { state: "unavailable" },
    competitor_mention_count: entitySets.competitor.size ? { value: competitor } : { state: "unavailable" },
    brand_vs_competitor_ratio: entitySets.competitor.size && competitor > 0 ? { value: brand / competitor, numerator: brand, denominator: competitor } : { state: "unavailable" },
  };
  return { entitySets, brand, competitor, engagementTotal, hasEngagement, growth, values };
}

export function persistListeningAggregates({ repository, values, entitySets, current, ids, manifestHash, context, contextVersionId, request, calculatedAt, hash, collectionSnapshot }) {
  const entityScope = { brands: [...entitySets.brand].sort(), competitors: [...entitySets.competitor].sort() };
  return listeningMetricRegistry.list().map((definition) => {
    const value = values[definition.metricType];
    const state = value.state || "available";
    return repository.createAggregate({
      metricType: definition.metricType,
      window: request.window,
      windowStart: request.start,
      windowEnd: request.end,
      cutoff: request.cutoff,
      calculatedAt,
      state,
      value: value.value,
      numerator: value.numerator,
      denominator: value.denominator,
      recordIds: ids,
      manifestHash,
      contextVersionId,
      producerKey: hash([definition.metricType, 1, request.window, request.start, request.end, request.cutoff, manifestHash, contextVersionId, entityScope.brands, entityScope.competitors]),
      provenance: {
        metricDefinition: `${definition.metricType}@1`,
        windowPolicy: `${request.window}@1`,
        pointInTimeCutoff: request.cutoff,
        contextState: context.state,
        entitySet: entityScope,
        sourceScope: {
          providers: [...new Set(current.map((record) => record.provider))].sort(),
          languages: [...new Set(current.map((record) => record.language || "unknown"))].sort(),
        },
        missingDataState: state,
        requestFingerprint: request.fingerprint,
        collectionSnapshot,
      },
    });
  });
}
