const ALLOWED_INPUT_FIELDS = new Set([
  "eventType", "eventVersion", "occurredAt", "actorType", "actorId",
  "subjectType", "subjectId", "sourceType", "sourceId", "channel",
  "campaignId", "customerId", "sessionId", "correlationId", "causationId",
  "idempotencyKey", "properties", "metadata",
]);

export class BusinessEventError extends Error {
  constructor(message, status = 400, code = "INVALID_BUSINESS_EVENT") {
    super(message); this.name = "BusinessEventError"; this.status = status; this.code = code;
  }
}

function identifier(value, field, { required = false, max = 200 } = {}) {
  if (value === undefined || value === null || value === "") {
    if (required) throw new BusinessEventError(`${field} is required.`);
    return null;
  }
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new BusinessEventError(`${field} is invalid.`);
  }
  return value.trim();
}

function timestamp(value, field, required = false) {
  if (!value && !required) return null;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new BusinessEventError(`${field} must be a valid timestamp.`);
  }
  return new Date(value).toISOString();
}

function filters(query) {
  const result = { limit: 50 };
  for (const field of ["type", "subjectType", "subjectId", "customerId"]) {
    if (query[field]) result[field] = identifier(query[field], field, { max: 200 });
  }
  if (query.from) result.from = timestamp(query.from, "from", true);
  if (query.to) result.to = timestamp(query.to, "to", true);
  const limit = Number(query.limit || 50);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new BusinessEventError("limit must be between 1 and 100.");
  result.limit = limit;
  return result;
}

export function createBusinessEventService({ repository, eventRegistry, contextGateway, signalProducer, now = () => new Date() }) {
  return Object.freeze({
    ingest(payload, userId) {
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new BusinessEventError("Event payload must be an object.");
      if (Object.hasOwn(payload, "workspaceId") || Object.hasOwn(payload, "workspace_id") || Object.hasOwn(payload, "contextVersionId")) {
        throw new BusinessEventError("Workspace and Business Context are resolved by the server.", 400, "EVENT_OWNERSHIP_FORBIDDEN");
      }
      const unknownFields = Object.keys(payload).filter((key) => !ALLOWED_INPUT_FIELDS.has(key));
      if (unknownFields.length) throw new BusinessEventError(`Unknown event fields: ${unknownFields.join(", ")}.`);
      const eventType = identifier(payload.eventType, "eventType", { required: true, max: 120 });
      const sourceType = identifier(payload.sourceType, "sourceType", { required: true, max: 100 });
      const sourceId = identifier(payload.sourceId, "sourceId");
      const idempotencyKey = identifier(payload.idempotencyKey, "idempotencyKey", { max: 200 });
      const duplicate = repository.findIdempotent(sourceType, sourceId, idempotencyKey);
      if (duplicate) return { event: duplicate, duplicate: true, derivation: null };
      let definition;
      try { definition = eventRegistry.validate(eventType, payload); }
      catch (error) { throw new BusinessEventError(error.message, 400, "EVENT_SCHEMA_INVALID"); }
      if (payload.eventVersion !== undefined && Number(payload.eventVersion) !== definition.eventVersion) {
        throw new BusinessEventError("Event version is unsupported.", 400, "EVENT_VERSION_UNSUPPORTED");
      }
      const ingestedAt = now().toISOString();
      const context = contextGateway.consume({
        consumer: "business_events", operation: "attribute_event",
        executionRequestId: idempotencyKey, userId,
      });
      const normalized = {
        eventType, eventVersion: definition.eventVersion,
        occurredAt: timestamp(payload.occurredAt, "occurredAt", true), ingestedAt,
        actorType: identifier(payload.actorType, "actorType", { max: 50 }),
        actorId: identifier(payload.actorId, "actorId"),
        subjectType: identifier(payload.subjectType, "subjectType", { required: true, max: 80 }),
        subjectId: identifier(payload.subjectId, "subjectId", { required: true }),
        sourceType, sourceId, channel: identifier(payload.channel, "channel", { max: 80 }),
        campaignId: identifier(payload.campaignId, "campaignId"),
        customerId: identifier(payload.customerId, "customerId"),
        sessionId: identifier(payload.sessionId, "sessionId"),
        correlationId: identifier(payload.correlationId, "correlationId"),
        causationId: identifier(payload.causationId, "causationId"),
        contextVersionId: context.state === "READY" ? context.contextVersionId : null,
        schemaVersion: `business-event/${definition.eventType}/v${definition.eventVersion}`,
        idempotencyKey,
        properties: payload.properties,
        metadata: {
          ...(payload.metadata || {}),
          ingestion: {
            contextState: context.state,
            staleReasons: context.staleReasons || [],
          },
        },
      };
      try {
        const stored = repository.create(normalized);
        if (stored.duplicate) return { event: stored.event, duplicate: true, derivation: null };
        const event = stored.event;
        const derivation = signalProducer.produce(event, { userId });
        return { event, duplicate: false, derivation };
      } catch (error) {
        if (/cross-workspace/i.test(error.message)) {
          throw new BusinessEventError("An event reference does not belong to the active workspace.", 400, "EVENT_REFERENCE_INVALID");
        }
        throw error;
      }
    },
    list: (query) => repository.list(filters(query)),
    get(id) {
      const event = repository.getById(identifier(id, "eventId", { required: true }));
      if (!event) throw new BusinessEventError("Business Event not found.", 404, "EVENT_NOT_FOUND");
      return event;
    },
  });
}
