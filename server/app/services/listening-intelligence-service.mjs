import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";
import { LISTENING_WINDOWS, LISTENING_TREND_POLICY, LISTENING_ANOMALY_POLICY, listeningMetricRegistry } from "../listening/listening-intelligence-contracts.mjs";
import { matchListeningTopics } from "../listening/listening-topic-matcher.mjs";
import { calculateListeningAggregateValues, persistListeningAggregates } from "../listening/listening-aggregate-calculator.mjs";
import { calculateListeningTrend } from "../listening/listening-trend-calculator.mjs";
import { calculateListeningAnomaly } from "../listening/listening-anomaly-calculator.mjs";
import { emitListeningCanonicalRecords } from "../listening/listening-canonical-emitter.mjs";
import { createListeningIntelligenceQueryService } from "../listening/listening-intelligence-query-service.mjs";
import { createOperationMetrics } from "../observability/operation-metrics.mjs";

export class ListeningIntelligenceError extends Error { constructor(message, status = 400, code = "LISTENING_INTELLIGENCE_INVALID") { super(message); this.status = status; this.code = code; } }
const hash = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const iso = (value, name) => { if (!value || !Number.isFinite(Date.parse(value))) throw new ListeningIntelligenceError(`${name} is invalid.`); return new Date(value).toISOString(); };
const workspaceId = () => { try { return requireWorkspaceId(); } catch { return null; } };

function parseFilters(query = {}) {
  const limit = Number(query.limit || 50);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new ListeningIntelligenceError("limit must be between 1 and 100.");
  const result = { limit };
  for (const key of ["metricType", "topic", "entity", "sourceType", "channel", "language", "window"]) {
    if (query[key] === undefined) continue;
    if (typeof query[key] !== "string" || !query[key].trim() || query[key].length > 120) throw new ListeningIntelligenceError(`${key} is invalid.`);
    result[key] = query[key].trim();
  }
  for (const key of ["from", "to"]) if (query[key]) result[key] = iso(query[key], key);
  return result;
}

function parseRequest(payload, now, contextVersionId, contextState) {
  const window = payload.window || "24h", duration = LISTENING_WINDOWS[window];
  if (!duration) throw new ListeningIntelligenceError("window is invalid.");
  const end = iso(payload.windowEnd || now().toISOString(), "windowEnd"), cutoff = iso(payload.pointInTimeCutoff || end, "pointInTimeCutoff");
  if (cutoff < end) throw new ListeningIntelligenceError("pointInTimeCutoff cannot precede windowEnd.");
  const start = new Date(Date.parse(end) - duration).toISOString(), baselineStart = new Date(Date.parse(start) - duration).toISOString();
  const fingerprint = hash({ window, windowVersion: 1, start, end, cutoff, contextVersionId, contextState, metricVersion: 1, producerVersion: "1.0", sourceScope: "all_workspace_listening_records" });
  return { window, duration, start, end, cutoff, baselineStart, fingerprint };
}

function loadCanonicalReuse({ aggregates, related, intelligenceRepository, featureRepository }) {
  const observation = intelligenceRepository.getObservationByProducerKey("listening_intelligence", "1.0", hash(["observation", aggregates.map((item) => item.id)]));
  const names = ["brand_mentions_24h", "brand_mentions_growth_24h", "brand_share_of_voice_7d", "competitor_mentions_24h", "engagement_total_24h", "listening_anomaly_active"];
  const featureKeys = observation ? names.map((name) => hash([name, observation.id])) : [];
  const features = featureRepository.getByProducerKeys("listening_feature_set", "1.0", featureKeys);
  return { observation, features, ...related };
}

export function createListeningIntelligenceService({ repository, contextGateway, intelligenceRepository, featureRepository, now = () => new Date(), operationMetrics = createOperationMetrics() }) {
  const queries = createListeningIntelligenceQueryService({ repository, now, parseFilters, ErrorType: ListeningIntelligenceError });
  function calculate(payload = {}, userId = null) {
    const started = performance.now(); let rowsRead = 0, rowsWritten = 0, reusedResult = false, failure = null;
    let currentWindowRows = 0, previousWindowRows = 0, topicMatchesGenerated = 0, aggregatesGenerated = 0, featureCount = 0, resultCount = 0;
    try {
      if (Object.hasOwn(payload, "workspaceId") || Object.hasOwn(payload, "workspace_id")) throw new ListeningIntelligenceError("Workspace ownership is server-resolved.");
      const requestedWindow = payload.window || "24h";
      const context = contextGateway.consume({ consumer: "listening_intelligence", operation: "calculate", executionRequestId: `${requestedWindow}:${payload.windowEnd || "now"}:${payload.pointInTimeCutoff || payload.windowEnd || "now"}`, userId });
      const contextVersionId = context.state === "READY" ? context.contextVersionId : null;
      const request = parseRequest(payload, now, contextVersionId, context.state), snapshot = repository.collectionSnapshot();
      const cachedRows = repository.findReusableSet(request.fingerprint, snapshot);
      const metricOrder = new Map(listeningMetricRegistry.list().map((definition, index) => [definition.metricType, index]));
      const cached = cachedRows?.sort((left, right) => metricOrder.get(left.metricType) - metricOrder.get(right.metricType));
      if (cached) {
        const related = repository.related(cached);
        if (related?.trend && related?.anomaly) {
          const canonical = loadCanonicalReuse({ aggregates: cached, related, intelligenceRepository, featureRepository });
          reusedResult = true; rowsRead = cached.length + related.topics.length + 2 + (canonical.observation ? 1 : 0) + canonical.features.length;
          currentWindowRows = cached.find((item) => item.metricType === "mention_count")?.sourceRecordCount || 0;
          previousWindowRows = related.trend.baselineValue || 0;
          featureCount = canonical.features.length; resultCount = cached.length;
          return { state: "CALCULATED", contextState: context.state, window: { policy: request.window, version: 1, start: request.start, end: request.end }, aggregates: cached, topics: related.topics, trend: related.trend, anomaly: related.anomaly, observation: canonical.observation, features: canonical.features };
        }
      }
      const calculatedAt = now().toISOString(), current = repository.records(request.start, request.end, request.cutoff), previous = repository.records(request.baselineStart, request.start, request.cutoff);
      rowsRead = current.length + previous.length;
      currentWindowRows = current.length; previousWindowRows = previous.length;
      const ids = current.map((record) => record.id), manifestHash = hash(ids);
      return repository.transaction(() => {
        const topics = matchListeningTopics({ records: current, repository, calculatedAt, hash });
        const metrics = calculateListeningAggregateValues({ current, previous, topics, context, duration: request.duration });
        const aggregates = persistListeningAggregates({ repository, values: metrics.values, entitySets: metrics.entitySets, current, ids, manifestHash, context, contextVersionId, request, calculatedAt, hash, collectionSnapshot: snapshot });
        const mention = aggregates.find((item) => item.metricType === "mention_count");
        const baseline = repository.createAggregate({ metricType: "mention_count", window: request.window, windowStart: request.baselineStart, windowEnd: request.start, cutoff: request.cutoff, calculatedAt, state: "available", value: previous.length, recordIds: previous.map((record) => record.id), manifestHash: hash(previous.map((record) => record.id)), contextVersionId, producerKey: hash(["mention_count", request.window, request.baselineStart, request.start, request.cutoff, previous.map((record) => record.id), contextVersionId]), provenance: { metricDefinition: "mention_count@1", windowPolicy: `${request.window}@1`, pointInTimeCutoff: request.cutoff, baseline: true } });
        const trend = calculateListeningTrend({ repository, mention, baseline, currentCount: current.length, previousCount: previous.length, request, calculatedAt, contextVersionId, hash });
        const anomaly = calculateListeningAnomaly({ repository, mention, currentCount: current.length, request, calculatedAt, hash });
        const canonical = emitListeningCanonicalRecords({ intelligenceRepository, featureRepository, aggregates, anomaly, metrics, ids, request, contextVersionId, calculatedAt, duration: request.duration, hash });
        topicMatchesGenerated = topics.length; aggregatesGenerated = aggregates.length; featureCount = canonical.features.length; resultCount = aggregates.length;
        rowsWritten = topics.length + aggregates.length + 3 + (canonical.observation ? 1 : 0) + canonical.features.length;
        return { state: "CALCULATED", contextState: context.state, window: { policy: request.window, version: 1, start: request.start, end: request.end }, aggregates, topics, trend, anomaly, observation: canonical.observation, features: canonical.features };
      });
    } catch (error) { failure = error.code || "UNEXPECTED_ERROR"; throw error; }
    finally { operationMetrics.record({ operation: "listening_intelligence.calculate", workspaceId: workspaceId(), durationMs: performance.now() - started, rowsRead, rowsWritten, resultCount, reusedResult, errorCode: failure, currentWindowRows, previousWindowRows, topicMatchesGenerated, aggregatesGenerated, featureCount }); }
  }
  return { definitions: () => ({ metrics: listeningMetricRegistry.list(), windows: Object.keys(LISTENING_WINDOWS).map((name) => ({ name, version: 1, durationMs: LISTENING_WINDOWS[name] })), trendPolicy: LISTENING_TREND_POLICY, anomalyPolicy: LISTENING_ANOMALY_POLICY }), calculate, operationMeasurements: operationMetrics.recent, operationSummary: operationMetrics.summary, ...queries };
}
