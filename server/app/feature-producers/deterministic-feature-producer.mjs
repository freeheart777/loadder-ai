import crypto from "node:crypto";

function producerKey(definition, contextVersionId, item) {
  const identity = JSON.stringify({
    featureName: definition.featureName,
    featureVersion: definition.featureVersion,
    producer: definition.producer,
    producerVersion: definition.producerVersion,
    contextVersionId,
    subjectType: item.subjectType,
    subjectId: item.subjectId,
    windowStart: item.windowStart,
    windowEnd: item.windowEnd,
    observationIds: [...item.sourceObservationIds].sort(),
    signalIds: [...item.sourceSignalIds].sort(),
    calculationPolicy: definition.calculationPolicy,
  });
  return crypto.createHash("sha256").update(identity).digest("hex");
}

function validateValue(definition, value) {
  if (definition.valueType === "numeric" && (typeof value !== "number" || !Number.isFinite(value))) return false;
  if (definition.valueType === "boolean" && typeof value !== "boolean") return false;
  if (definition.valueType === "categorical" && (typeof value !== "string" || !value)) return false;
  return definition.valueType !== "json" || (value !== undefined && value !== null && typeof value === "object");
}

export function createDeterministicFeatureProducer({
  contextGateway, featureRegistry, repository, calculate, now = () => new Date(),
}) {
  return Object.freeze({
    produce({ subjectType, subjectId, observations, signals, userId = null, executionRequestId = null }) {
      const gateway = contextGateway.consume({
        consumer: "feature_engine", operation: "calculate_features", executionRequestId, userId,
      });
      if (gateway.state !== "READY") {
        return { state: gateway.state, staleReasons: gateway.staleReasons || [], features: [], omitted: [] };
      }
      const allSources = [...observations, ...signals];
      if (allSources.some((source) => source.subjectType !== subjectType || source.subjectId !== subjectId ||
        source.contextVersionId !== gateway.contextVersionId)) {
        throw new Error("Feature source subject or Business Context is inconsistent.");
      }
      const calculatedAt = now().toISOString();
      const calculation = calculate({
        subjectType, subjectId, observations, signals,
        context: gateway.context, contextVersionId: gateway.contextVersionId, calculatedAt,
      });
      const features = [];
      for (const item of calculation.values) {
        const definition = featureRegistry.get(item.featureName, item.featureVersion);
        if (!definition) throw new Error(`Feature definition not found: ${item.featureName}.`);
        if (definition.subjectType !== subjectType || !definition.supportedContextSchemaVersions.includes(gateway.contextSchemaVersion)) {
          throw new Error(`Feature definition is incompatible: ${item.featureName}.`);
        }
        const observationTypes = new Set(observations
          .filter((source) => item.sourceObservationIds.includes(source.id))
          .map((source) => source.observationType));
        const signalTypes = new Set(signals
          .filter((source) => item.sourceSignalIds.includes(source.id))
          .map((source) => source.signalType));
        if (definition.requiredObservationTypes.some((type) => !observationTypes.has(type)) ||
          definition.requiredSignalTypes.some((type) => !signalTypes.has(type))) {
          throw new Error(`Required feature sources are missing: ${item.featureName}.`);
        }
        if (!validateValue(definition, item.value)) throw new Error(`Feature value type is invalid: ${item.featureName}.`);
        const key = producerKey(definition, gateway.contextVersionId, item);
        features.push(repository.create({
          featureName: definition.featureName, featureVersion: definition.featureVersion,
          subjectType, subjectId, contextVersionId: gateway.contextVersionId,
          windowStart: item.windowStart, windowEnd: item.windowEnd,
          valueType: definition.valueType, value: item.value,
          calculatedAt, validUntil: item.validUntil,
          producer: definition.producer, producerVersion: definition.producerVersion,
          producerKey: key, sourceObservationIds: item.sourceObservationIds,
          sourceSignalIds: item.sourceSignalIds,
          provenance: {
            featureDefinition: { name: definition.featureName, version: definition.featureVersion },
            calculationPolicy: definition.calculationPolicy,
            contextVersionId: gateway.contextVersionId,
            sourceObservationIds: item.sourceObservationIds,
            sourceSignalIds: item.sourceSignalIds,
            calculationWindow: { start: item.windowStart, end: item.windowEnd },
            calculationMetadata: item.calculationMetadata || {},
          },
          createdAt: calculatedAt,
        }));
      }
      return { state: "PRODUCED", features, omitted: calculation.omitted || [] };
    },
  });
}
