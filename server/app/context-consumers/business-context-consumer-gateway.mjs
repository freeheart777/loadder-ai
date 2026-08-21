import { requireWorkspaceId } from "../tenant-context.mjs";

export const BUSINESS_CONTEXT_GATEWAY_STATES = Object.freeze({
  READY: "READY",
  MISSING_CONTEXT: "MISSING_CONTEXT",
  STALE_CONTEXT: "STALE_CONTEXT",
  UNSUPPORTED_SCHEMA: "UNSUPPORTED_SCHEMA",
});

function baseResult(state, capability, activeContext = null) {
  return {
    state,
    consumer: capability.consumer,
    contextVersionId: activeContext?.id || null,
    contextSchemaVersion: activeContext?.contextSchemaVersion || null,
    sourceVersionReferences: activeContext?.sourceManifest || null,
  };
}

export function createBusinessContextConsumerGateway({
  businessContextService,
  usageRepository,
  capabilityRegistry,
  now = () => new Date(),
}) {
  return Object.freeze({
    consume({ consumer, operation, executionRequestId = null, userId = null }) {
      requireWorkspaceId();
      const capability = capabilityRegistry.get(consumer);
      if (!capability) throw new Error(`Unregistered Business Context consumer: ${consumer}`);
      if (typeof operation !== "string" || !operation.trim() || operation.length > 120) {
        throw new Error("A valid Business Context consumer operation is required.");
      }
      if (executionRequestId !== null &&
        (typeof executionRequestId !== "string" || !executionRequestId.trim() || executionRequestId.length > 200)) {
        throw new Error("Business Context execution/request ID is invalid.");
      }

      const current = businessContextService.getCurrent();
      const active = current.activeContext;
      if (!active) return baseResult(BUSINESS_CONTEXT_GATEWAY_STATES.MISSING_CONTEXT, capability);
      if (current.isStale) {
        return {
          ...baseResult(BUSINESS_CONTEXT_GATEWAY_STATES.STALE_CONTEXT, capability, active),
          staleReasons: [...current.staleReasons],
        };
      }

      const missingRequiredSections = capability.requiredContextSections.filter(
        (section) => !Object.hasOwn(active.snapshot, section)
      );
      if (!capability.supportedContextSchemaVersions.includes(active.contextSchemaVersion) ||
        missingRequiredSections.length > 0) {
        return {
          ...baseResult(BUSINESS_CONTEXT_GATEWAY_STATES.UNSUPPORTED_SCHEMA, capability, active),
          supportedContextSchemaVersions: [...capability.supportedContextSchemaVersions],
          missingRequiredSections,
        };
      }

      const usage = usageRepository.record({
        contextVersionId: active.id,
        userId,
        consumer: capability.consumer,
        operation: operation.trim(),
        executionRequestId: executionRequestId?.trim() || null,
        createdAt: now().toISOString(),
      });
      return {
        ...baseResult(BUSINESS_CONTEXT_GATEWAY_STATES.READY, capability, active),
        context: active.snapshot,
        capability,
        usageId: usage.id,
      };
    },
  });
}
