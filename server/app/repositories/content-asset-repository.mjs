import { requireWorkspaceId } from "../tenant-context.mjs";

const map = (row) => row && Object.freeze({
  id: row.id, workspaceId: row.workspace_id, createdByUserId: row.created_by_user_id,
  mediaType: row.media_type, declaredMimeType: row.declared_mime_type, declaredByteSize: row.declared_byte_size, declaredSha256: row.declared_sha256,
  mimeType: row.mime_type, byteSize: row.byte_size, contentSha256: row.content_sha256, width: row.width, height: row.height, durationMs: row.duration_ms,
  originalFilename: row.original_filename, storageProvider: row.storage_provider, storageObjectKey: row.storage_object_key,
  status: row.status, failureCode: row.failure_code, operationKind: row.operation_kind, idempotencyKey: row.idempotency_key, requestHash: row.request_hash,
  uploadExpiresAt: row.upload_expires_at, verifyingAt: row.verifying_at, readyAt: row.ready_at,
  deletionRequestedAt: row.deletion_requested_at, deletedAt: row.deleted_at, createdAt: row.created_at, updatedAt: row.updated_at,
  canonicalStorageObjectKey: row.canonical_storage_object_key, canonicalMimeType: row.canonical_mime_type,
  canonicalByteSize: row.canonical_byte_size, canonicalSha256: row.canonical_sha256,
  optimizationPolicyVersion: row.optimization_policy_version, optimizationOutcome: row.optimization_outcome,
  sourceRetentionUntil: row.source_retention_until,
  storageBackendKind: row.storage_backend_kind,
});

export function createContentAssetRepository(db) {
  const hasStorageBackendKind = db.prepare("SELECT 1 FROM pragma_table_info('content_assets') WHERE name='storage_backend_kind'").get();
  const hasPrimaryAsset = db.prepare("SELECT 1 FROM pragma_table_info('content_items') WHERE name='primary_asset_id'").get();
  const workspace = () => requireWorkspaceId();
  const findById = (id) => map(db.prepare("SELECT * FROM content_assets WHERE workspace_id=? AND id=?").get(workspace(), id));
  const findByIdempotency = (userId, operationKind, idempotencyKey) => map(db.prepare("SELECT * FROM content_assets WHERE workspace_id=? AND created_by_user_id=? AND operation_kind=? AND idempotency_key=?").get(workspace(), userId, operationKind, idempotencyKey));
  const isReferenced = (id) => Boolean(hasPrimaryAsset && db.prepare("SELECT 1 FROM content_items WHERE workspace_id=? AND primary_asset_id=? LIMIT 1").get(workspace(), id));
  function create(input) {
    try {
      db.prepare(`INSERT INTO content_assets(
        id,workspace_id,created_by_user_id,media_type,declared_mime_type,declared_byte_size,declared_sha256,
        original_filename,storage_provider,storage_object_key,status,failure_code,operation_kind,idempotency_key,request_hash,
        upload_expires_at,created_at,updated_at${hasStorageBackendKind ? ",storage_backend_kind" : ""}
      ) VALUES(?,?,?,?,?,?,?,?,?,?, 'UPLOADING',NULL,?,?,?,?,?,?${hasStorageBackendKind ? ",?" : ""})`).run(
        input.id, workspace(), input.createdByUserId, input.mediaType, input.declaredMimeType, input.declaredByteSize, input.declaredSha256,
        input.originalFilename, input.storageProvider, input.storageObjectKey, input.operationKind, input.idempotencyKey, input.requestHash,
        input.uploadExpiresAt, input.createdAt, input.createdAt, ...(hasStorageBackendKind ? [input.storageBackendKind || null] : [])
      );
      return Object.freeze({ asset: findById(input.id), created: true });
    } catch (error) {
      const winner = findByIdempotency(input.createdByUserId, input.operationKind, input.idempotencyKey);
      if (winner) return Object.freeze({ asset: winner, created: false });
      throw error;
    }
  }
  const transition = (id, from, assignments, values, now) => {
    const result = db.prepare(`UPDATE content_assets SET ${assignments},updated_at=? WHERE workspace_id=? AND id=? AND status IN (${from.map(() => "?").join(",")})`).run(...values, now, workspace(), id, ...from);
    return result.changes ? findById(id) : null;
  };
  const claimVerification = (id, now) => transition(id, ["UPLOADING", "FAILED"], "status='VERIFYING',verifying_at=?,failure_code=NULL", [now], now);
  const recordReady = (id, verified, now) => transition(id, ["VERIFYING"], "status='READY',mime_type=?,byte_size=?,content_sha256=?,width=?,height=?,duration_ms=?,ready_at=?,failure_code=NULL", [verified.mimeType, verified.byteSize, verified.contentSha256, verified.width, verified.height, verified.durationMs, now], now);
  const recordCanonicalReady = (id, verified, now) => transition(id, ["VERIFYING"], `status='READY',mime_type=?,byte_size=?,content_sha256=?,width=?,height=?,duration_ms=?,ready_at=?,failure_code=NULL,
    canonical_storage_object_key=?,canonical_mime_type=?,canonical_byte_size=?,canonical_sha256=?,optimization_policy_version=?,optimization_outcome=?,source_retention_until=?`, [verified.sourceMimeType, verified.sourceByteSize, verified.sourceSha256, verified.width, verified.height, verified.durationMs, now, verified.canonicalStorageObjectKey, verified.canonicalMimeType, verified.canonicalByteSize, verified.canonicalSha256, verified.optimizationPolicyVersion, verified.optimizationOutcome, verified.sourceRetentionUntil], now);
  const recordRejected = (id, failureCode, now) => transition(id, ["VERIFYING"], "status='REJECTED',failure_code=?", [failureCode], now);
  const recordFailed = (id, failureCode, now) => transition(id, ["UPLOADING", "VERIFYING"], "status='FAILED',failure_code=?", [failureCode], now);
  const requestDeletion = (id, now) => transition(id, ["UPLOADING", "VERIFYING", "FAILED", "REJECTED", "READY"], "status='DELETING',deletion_requested_at=?", [now], now);
  const recordDeleted = (id, now) => transition(id, ["DELETING"], "status='DELETED',deleted_at=?", [now], now);
  const quotaUsage = () => db.prepare(`SELECT COUNT(*) count,COALESCE(SUM(MAX(declared_byte_size,COALESCE(byte_size,0))),0) bytes FROM content_assets WHERE workspace_id=? AND status!='DELETED'`).get(workspace());
  const listHistory = ({ limit = 50, cursor = null } = {}) => {
    const values = [workspace()]; let condition = "workspace_id=?";
    if (cursor) { condition += " AND(created_at<? OR(created_at=? AND id<?))"; values.push(cursor.createdAt, cursor.createdAt, cursor.id); }
    values.push(limit); return db.prepare(`SELECT * FROM content_assets WHERE ${condition} ORDER BY created_at DESC,id DESC LIMIT ?`).all(...values).map(map);
  };
  const listLifecycle = ({ status, before, limit = 100 }) => db.prepare("SELECT * FROM content_assets WHERE workspace_id=? AND status=? AND created_at<=? ORDER BY created_at,id LIMIT ?").all(workspace(), status, before, limit).map(map);
  const listMaintenance = ({ status, before, limit = 50 }) => db.prepare("SELECT * FROM content_assets WHERE workspace_id=? AND status=? AND updated_at<=? ORDER BY updated_at,id LIMIT ?").all(workspace(), status, before, limit).map(map);
  return Object.freeze({ findById, findByIdempotency, isReferenced, create, claimVerification, recordReady, recordCanonicalReady, recordRejected, recordFailed, requestDeletion, recordDeleted, quotaUsage, listHistory, listLifecycle, listMaintenance });
}
