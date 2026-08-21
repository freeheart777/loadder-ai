import crypto from "node:crypto";

import { requireWorkspaceId } from "../tenant-context.mjs";
import { pageResult } from "../query/cursor-pagination.mjs";

function parseJson(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function mapEvent(row) {
  if (!row) return null;
  return {
    id: row.id, eventType: row.event_type, eventVersion: row.event_version,
    occurredAt: row.occurred_at, ingestedAt: row.ingested_at,
    actorType: row.actor_type, actorId: row.actor_id,
    subjectType: row.subject_type, subjectId: row.subject_id,
    sourceType: row.source_type, sourceId: row.source_id, channel: row.channel,
    campaignId: row.campaign_id, customerId: row.customer_id, sessionId: row.session_id,
    correlationId: row.correlation_id, causationId: row.causation_id,
    contextVersionId: row.context_version_id, schemaVersion: row.schema_version,
    idempotencyKey: row.idempotency_key,
    properties: parseJson(row.properties_json, {}), metadata: parseJson(row.metadata_json, {}),
  };
}

export function createBusinessEventRepository(db) {
  function getById(id) {
    return mapEvent(db.prepare("SELECT * FROM business_events WHERE id=? AND workspace_id=?")
      .get(id, requireWorkspaceId()));
  }
  function findIdempotent(sourceType, sourceId, idempotencyKey) {
    if (!idempotencyKey) return null;
    return mapEvent(db.prepare(`SELECT * FROM business_events
      WHERE workspace_id=? AND source_type=? AND COALESCE(source_id,'')=COALESCE(?, '')
        AND idempotency_key=?`).get(requireWorkspaceId(), sourceType, sourceId, idempotencyKey));
  }
  function create(input) {
    const id = crypto.randomUUID();
    try {
      db.prepare(`INSERT INTO business_events (
        id,workspace_id,event_type,event_version,occurred_at,ingested_at,
        actor_type,actor_id,subject_type,subject_id,source_type,source_id,channel,
        campaign_id,customer_id,session_id,correlation_id,causation_id,
        context_version_id,schema_version,idempotency_key,properties_json,metadata_json
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        id, requireWorkspaceId(), input.eventType, input.eventVersion, input.occurredAt, input.ingestedAt,
        input.actorType, input.actorId, input.subjectType, input.subjectId, input.sourceType,
        input.sourceId, input.channel, input.campaignId, input.customerId, input.sessionId,
        input.correlationId, input.causationId, input.contextVersionId, input.schemaVersion,
        input.idempotencyKey, JSON.stringify(input.properties), JSON.stringify(input.metadata)
      );
      return { event: getById(id), duplicate: false };
    } catch (error) {
      const existing = findIdempotent(input.sourceType, input.sourceId, input.idempotencyKey);
      if (existing && String(error.code || "").startsWith("SQLITE_CONSTRAINT")) {
        return { event: existing, duplicate: true };
      }
      throw error;
    }
  }
  function listPage(filters) {
    const clauses = ["workspace_id = ?"];
    const values = [requireWorkspaceId()];
    for (const [column, value] of [
      ["event_type", filters.type], ["subject_type", filters.subjectType],
      ["subject_id", filters.subjectId], ["customer_id", filters.customerId],
    ]) if (value) { clauses.push(`${column} = ?`); values.push(value); }
    if (filters.from) { clauses.push("occurred_at >= ?"); values.push(filters.from); }
    if (filters.to) { clauses.push("occurred_at <= ?"); values.push(filters.to); }
    if (filters.cursor) {
      clauses.push("(occurred_at<? OR(occurred_at=? AND(ingested_at<? OR(ingested_at=? AND id<?))))");
      values.push(filters.cursor.occurredAt, filters.cursor.occurredAt, filters.cursor.ingestedAt, filters.cursor.ingestedAt, filters.cursor.id);
    }
    values.push(filters.limit + 1);
    const rows = db.prepare(`SELECT * FROM business_events WHERE ${clauses.join(" AND ")}
      ORDER BY occurred_at DESC, ingested_at DESC, id DESC LIMIT ?`).all(...values).map(mapEvent);
    return pageResult(rows, filters.limit, "business_events", (event) => ({ occurredAt: event.occurredAt, ingestedAt: event.ingestedAt, id: event.id }));
  }
  const list = filters => listPage(filters).items;
  return { getById, findIdempotent, create, list, listPage };
}
