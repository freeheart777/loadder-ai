export class FeatureQueryError extends Error {
  constructor(message, status = 400, code = "INVALID_FEATURE_QUERY") {
    super(message); this.name = "FeatureQueryError"; this.status = status; this.code = code;
  }
}

function identifier(value, field, required = false) {
  if (!value && !required) return null;
  if (typeof value !== "string" || !value.trim() || value.length > 200) throw new FeatureQueryError(`${field} is invalid.`);
  return value.trim();
}

function freshness(feature, now) {
  return feature.validUntil && feature.validUntil <= now ? "expired" : "fresh";
}

export function createFeatureQueryService({ repository, now = () => new Date() }) {
  return Object.freeze({
    list(query) {
      const limit = Number(query.limit || 50);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new FeatureQueryError("limit must be between 1 and 100.");
      const current = now().toISOString();
      const features = repository.list({
        featureName: identifier(query.featureName, "featureName"),
        subjectType: identifier(query.subjectType, "subjectType"),
        subjectId: identifier(query.subjectId, "subjectId"),
        contextVersionId: identifier(query.contextVersionId, "contextVersionId"),
        freshOnly: query.freshOnly === "true", now: current, limit,
      });
      return features.map((feature) => ({ ...feature, freshness: freshness(feature, current) }));
    },
    get(id) {
      const feature = repository.getById(identifier(id, "featureId", true));
      if (!feature) throw new FeatureQueryError("Feature Value not found.", 404, "FEATURE_NOT_FOUND");
      return { ...feature, freshness: freshness(feature, now().toISOString()) };
    },
    getFeatureSet(subjectType, subjectId) {
      const type = identifier(subjectType, "subjectType", true);
      const subject = identifier(subjectId, "subjectId", true);
      const current = now().toISOString();
      const values = repository.listSubject(type, subject);
      if (!values.length) return null;
      const features = Object.fromEntries(values.map((feature) => [feature.featureName, {
        id: feature.id, featureName: feature.featureName, featureVersion: feature.featureVersion,
        value: feature.value, valueType: feature.valueType, freshness: freshness(feature, current),
        calculatedAt: feature.calculatedAt, validUntil: feature.validUntil,
        producer: feature.producer, producerVersion: feature.producerVersion,
        sourceObservationIds: feature.sourceObservationIds, sourceSignalIds: feature.sourceSignalIds,
        provenance: feature.provenance,
      }]));
      return {
        subjectType: type, subjectId: subject, contextVersionId: values[0].contextVersionId,
        calculatedAt: values.map((value) => value.calculatedAt).sort().at(-1), features,
      };
    },
  });
}
