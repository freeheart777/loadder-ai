import { createDeterministicFeatureProducer } from "./deterministic-feature-producer.mjs";

export function createCartFeatureProducer({ contextGateway, featureRegistry, repository, now = () => new Date() }) {
  const bandDefinition = featureRegistry.get("cart_recovery_value_band", 1);
  return createDeterministicFeatureProducer({
    contextGateway, featureRegistry, repository, now,
    calculate({ subjectType, subjectId, observations, signals, calculatedAt }) {
      const observation = observations.find((item) => item.observationType === "cart.abandoned_value");
      const signal = signals.find((item) => item.signalType === "cart_recovery_opportunity");
      if (!observation || !signal) throw new Error("Cart feature sources are incomplete.");
      const currency = observation.sourceManifest.currency || null;
      const values = [
        {
          featureName: "cart_abandoned_value", featureVersion: 1,
          subjectType, subjectId, value: observation.numericValue,
          windowStart: observation.windowStart, windowEnd: observation.windowEnd,
          validUntil: observation.validUntil,
          sourceObservationIds: [observation.id], sourceSignalIds: [],
          calculationMetadata: { currency },
        },
        {
          featureName: "cart_recovery_opportunity_active", featureVersion: 1,
          subjectType, subjectId,
          value: signal.lifecycleStatus === "active" &&
            (!signal.validUntil || signal.validUntil > calculatedAt),
          windowStart: signal.observedAt, windowEnd: signal.observedAt,
          validUntil: signal.validUntil,
          sourceObservationIds: [], sourceSignalIds: [signal.id],
          calculationMetadata: {},
        },
      ];
      const thresholds = bandDefinition.calculationPolicy.thresholdsByCurrency[currency];
      const omitted = [];
      if (thresholds) {
        const value = observation.numericValue < thresholds.lowUpperExclusive ? "low"
          : observation.numericValue < thresholds.mediumUpperExclusive ? "medium" : "high";
        values.push({
          featureName: "cart_recovery_value_band", featureVersion: 1,
          subjectType, subjectId, value,
          windowStart: observation.windowStart, windowEnd: observation.windowEnd,
          validUntil: observation.validUntil,
          sourceObservationIds: [observation.id], sourceSignalIds: [],
          calculationMetadata: { currency, thresholds, crossCurrencyComparable: false },
        });
      } else {
        omitted.push({ featureName: "cart_recovery_value_band", reason: "UNSUPPORTED_CURRENCY", currency });
      }
      return { values, omitted };
    },
  });
}
