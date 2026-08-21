const PRODUCER = "cart_abandonment_signal";
const PRODUCER_VERSION = "1.0";

export function createCartAbandonmentSignalProducer({
  contextGateway, repository, featureProducer = null, now = () => new Date(),
}) {
  return Object.freeze({
    produce(event, { userId = null } = {}) {
      if (event.eventType !== "cart.abandoned" || event.properties.totalAmount <= 0) {
        return { state: "NOT_APPLICABLE", observation: null, signal: null };
      }
      const gateway = contextGateway.consume({
        consumer: "growth_signals",
        operation: "derive_cart_abandonment",
        executionRequestId: event.id,
        userId,
      });
      if (gateway.state !== "READY") {
        return { state: gateway.state, staleReasons: gateway.staleReasons || [], observation: null, signal: null };
      }
      const calculatedAt = now().toISOString();
      const validUntil = new Date(Date.parse(event.occurredAt) + 7 * 24 * 60 * 60 * 1000).toISOString();
      const producerKey = `event:${event.id}`;
      return repository.transaction(() => {
        const observation = repository.createObservation({
        observationType: "cart.abandoned_value",
        observationVersion: 1,
        subjectType: "cart",
        subjectId: event.subjectId,
        contextVersionId: gateway.contextVersionId,
        windowStart: event.occurredAt,
        windowEnd: event.occurredAt,
        valueType: "numeric",
        numericValue: event.properties.totalAmount,
        sourceEventCount: 1,
        sourceManifest: { eventIds: [event.id], currency: event.properties.currency || null },
        calculatedAt,
        validUntil,
        producer: PRODUCER,
        producerVersion: PRODUCER_VERSION,
        producerKey,
        });
        const signal = repository.createSignal({
        signalType: "cart_recovery_opportunity",
        signalVersion: 1,
        subjectType: "cart",
        subjectId: event.subjectId,
        contextVersionId: gateway.contextVersionId,
        state: "detected",
        score: 1,
        confidence: 1,
        severity: "medium",
        observedAt: event.occurredAt,
        validUntil,
        producer: PRODUCER,
        producerVersion: PRODUCER_VERSION,
        producerKey,
        sourceObservationIds: [observation.id],
        provenance: {
          sourceEventIds: [event.id],
          sourceObservationIds: [observation.id],
          calculationWindow: { start: event.occurredAt, end: event.occurredAt },
          calculatedAt,
        },
        createdAt: calculatedAt,
        });
        const featureResult = featureProducer
          ? featureProducer.produce({
              subjectType: "cart", subjectId: event.subjectId,
              observations: [observation], signals: [signal],
              userId, executionRequestId: event.id,
            })
          : { state: "NOT_CONFIGURED", features: [], omitted: [] };
        if (featureResult.state !== "PRODUCED" && featureResult.state !== "NOT_CONFIGURED") {
          throw new Error(`Feature production was blocked after signal creation: ${featureResult.state}.`);
        }
        return {
          state: "PRODUCED", observation, signal,
          features: featureResult.features, omittedFeatures: featureResult.omitted,
        };
      });
    },
  });
}
