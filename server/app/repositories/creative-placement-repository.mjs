import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";
import { pageResult } from "../query/cursor-pagination.mjs";

const map = (row) => row && Object.freeze({ id: row.id, contentItemId: row.content_item_id, placementKind: row.placement_kind, channel: row.channel, status: row.status, externalReferenceId: row.external_reference_id, createdByUserId: row.created_by_user_id, requestHash: row.request_hash, createdAt: row.created_at, updatedAt: row.updated_at });

export function createCreativePlacementRepository(db) {
  const workspace = () => requireWorkspaceId();
  const findByIdempotency = (userId, key) => map(db.prepare("SELECT * FROM creative_placements WHERE workspace_id=? AND created_by_user_id=? AND operation_kind='creative_placement.create' AND idempotency_key=?").get(workspace(), userId, key));
  function create(input) {
    const id = crypto.randomUUID();
    try {
      db.prepare("INSERT INTO creative_placements(id,workspace_id,content_item_id,placement_kind,channel,status,external_reference_id,created_by_user_id,operation_kind,idempotency_key,request_hash,created_at,updated_at) VALUES(?,?,?,?,?,'ACTIVE',NULL,?,'creative_placement.create',?,?,?,?)").run(id, workspace(), input.contentItemId, input.placementKind, input.channel, input.userId, input.idempotencyKey, input.requestHash, input.now, input.now);
      return { placement: map(db.prepare("SELECT * FROM creative_placements WHERE workspace_id=? AND id=?").get(workspace(), id)), created: true };
    } catch (error) {
      const winner = findByIdempotency(input.userId, input.idempotencyKey);
      if (winner) return { placement: winner, created: false };
      throw error;
    }
  }
  function listPage(contentItemId, { limit, cursor }) {
    const values = [workspace(), contentItemId]; let where = "workspace_id=? AND content_item_id=?";
    if (cursor) { where += " AND(created_at<? OR(created_at=? AND id<?))"; values.push(cursor.createdAt, cursor.createdAt, cursor.id); }
    values.push(limit + 1);
    const rows = db.prepare(`SELECT * FROM creative_placements WHERE ${where} ORDER BY created_at DESC,id DESC LIMIT ?`).all(...values).map(map);
    return pageResult(rows, limit, "creative_placements", (item) => ({ createdAt: item.createdAt, id: item.id }));
  }
  return Object.freeze({ findByIdempotency, create, listPage });
}
