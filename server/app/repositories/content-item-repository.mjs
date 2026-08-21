import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";
import { pageResult } from "../query/cursor-pagination.mjs";

const parse = (value) => { try { return JSON.parse(value); } catch { return null; } };
const map = (row) => row && Object.freeze({
  contentItemId: row.id, createdByUserId: row.created_by_user_id,
  sourceGenerationId: row.source_generation_id, sourceVariantIndex: row.source_variant_index,
  mediaType: row.media_type, contractId: row.contract_id, contractVersion: row.contract_version,
  placementId: row.placement_id, placementVersion: row.placement_version,
  contextVersionId: row.context_version_id, title: row.title, content: parse(row.content_json),
  revision: row.revision, operationKind: row.operation_kind, requestHash: row.request_hash,
  createdAt: row.created_at, updatedAt: row.updated_at,
});

export function createContentItemRepository(db) {
  const workspace = () => requireWorkspaceId();
  const select = "SELECT * FROM content_items";
  const findById = (id) => map(db.prepare(`${select} WHERE workspace_id=? AND id=?`).get(workspace(), id));
  const findByIdempotency = (userId, operationKind, key) => map(db.prepare(`${select} WHERE workspace_id=? AND created_by_user_id=? AND operation_kind=? AND idempotency_key=?`).get(workspace(), userId, operationKind, key));
  function create(input) {
    const id = crypto.randomUUID();
    try {
      db.prepare(`INSERT INTO content_items(id,workspace_id,created_by_user_id,source_generation_id,source_variant_index,media_type,contract_id,contract_version,placement_id,placement_version,context_version_id,title,content_json,revision,operation_kind,idempotency_key,request_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,?,?)`).run(
        id, workspace(), input.userId, input.sourceGenerationId, input.sourceVariantIndex, input.mediaType,
        input.contractId, input.contractVersion, input.placementId, input.placementVersion, input.contextVersionId,
        input.title, JSON.stringify(input.content), input.operationKind, input.idempotencyKey, input.requestHash, input.now, input.now
      );
      return { item: findById(id), created: true };
    } catch (error) {
      const winner = findByIdempotency(input.userId, input.operationKind, input.idempotencyKey);
      if (winner) return { item: winner, created: false };
      throw error;
    }
  }
  function update(id, expectedRevision, { title, content, now }) {
    const result = db.prepare(`UPDATE content_items SET title=?,content_json=?,revision=revision+1,updated_at=? WHERE workspace_id=? AND id=? AND revision=?`).run(title, JSON.stringify(content), now, workspace(), id, expectedRevision);
    return result.changes ? findById(id) : null;
  }
  function listPage({ limit, cursor, mediaType, contractId, placementId }) {
    const values = [workspace()]; let where = "workspace_id=?";
    for (const [column, value] of [["media_type", mediaType], ["contract_id", contractId], ["placement_id", placementId]]) if (value) { where += ` AND ${column}=?`; values.push(value); }
    if (cursor) { where += " AND (updated_at<? OR(updated_at=? AND id<?))"; values.push(cursor.updatedAt, cursor.updatedAt, cursor.id); }
    values.push(limit + 1);
    const rows = db.prepare(`${select} WHERE ${where} ORDER BY updated_at DESC,id DESC LIMIT ?`).all(...values).map(map);
    return pageResult(rows, limit, "content_items", (item) => ({ updatedAt: item.updatedAt, id: item.contentItemId }));
  }
  return Object.freeze({ findById, findByIdempotency, create, update, listPage });
}
