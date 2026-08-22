export const migration049ContentAssets = {
  version: 49,
  name: "content_assets",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS content_assets (
        id TEXT PRIMARY KEY CHECK(length(id) BETWEEN 1 AND 100),
        workspace_id TEXT NOT NULL REFERENCES workspaces(id),
        created_by_user_id TEXT NOT NULL REFERENCES users(id),
        media_type TEXT NOT NULL CHECK(media_type IN ('IMAGE','VIDEO')),
        declared_mime_type TEXT NOT NULL CHECK(
          (media_type='IMAGE' AND declared_mime_type IN ('image/jpeg','image/png','image/webp')) OR
          (media_type='VIDEO' AND declared_mime_type='video/mp4')
        ),
        declared_byte_size INTEGER NOT NULL CHECK(declared_byte_size>0),
        declared_sha256 TEXT NOT NULL CHECK(length(declared_sha256)=64 AND declared_sha256 NOT GLOB '*[^0-9a-f]*'),
        mime_type TEXT CHECK(mime_type IS NULL OR length(mime_type) BETWEEN 1 AND 100),
        byte_size INTEGER CHECK(byte_size IS NULL OR byte_size>0),
        content_sha256 TEXT CHECK(content_sha256 IS NULL OR(length(content_sha256)=64 AND content_sha256 NOT GLOB '*[^0-9a-f]*')),
        width INTEGER CHECK(width IS NULL OR width>0),
        height INTEGER CHECK(height IS NULL OR height>0),
        duration_ms INTEGER CHECK(duration_ms IS NULL OR duration_ms>0),
        original_filename TEXT CHECK(original_filename IS NULL OR(length(original_filename) BETWEEN 1 AND 180 AND length(CAST(original_filename AS BLOB))<=255)),
        storage_provider TEXT NOT NULL CHECK(storage_provider IN ('TEST_MEMORY','UNAVAILABLE')),
        storage_object_key TEXT NOT NULL CHECK(length(storage_object_key) BETWEEN 1 AND 500),
        status TEXT NOT NULL CHECK(status IN ('UPLOADING','VERIFYING','READY','REJECTED','FAILED','DELETING','DELETED')),
        failure_code TEXT CHECK(failure_code IS NULL OR(length(failure_code) BETWEEN 1 AND 100 AND failure_code NOT GLOB '*[^A-Z0-9_]*' AND failure_code GLOB '[A-Z]*')),
        operation_kind TEXT NOT NULL CHECK(operation_kind='content_asset.intent'),
        idempotency_key TEXT NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 200),
        request_hash TEXT NOT NULL CHECK(length(request_hash)=64 AND request_hash NOT GLOB '*[^0-9a-f]*'),
        upload_expires_at TEXT NOT NULL CHECK(length(upload_expires_at) BETWEEN 20 AND 40),
        verifying_at TEXT CHECK(verifying_at IS NULL OR length(verifying_at) BETWEEN 20 AND 40),
        ready_at TEXT CHECK(ready_at IS NULL OR length(ready_at) BETWEEN 20 AND 40),
        deletion_requested_at TEXT CHECK(deletion_requested_at IS NULL OR length(deletion_requested_at) BETWEEN 20 AND 40),
        deleted_at TEXT CHECK(deleted_at IS NULL OR length(deleted_at) BETWEEN 20 AND 40),
        created_at TEXT NOT NULL CHECK(length(created_at) BETWEEN 20 AND 40),
        updated_at TEXT NOT NULL CHECK(length(updated_at) BETWEEN 20 AND 40),
        CHECK(storage_object_key='workspaces/'||workspace_id||'/content-assets/'||id||'/original'),
        CHECK(updated_at>=created_at AND upload_expires_at>created_at),
        CHECK(status!='READY' OR(
          mime_type=declared_mime_type AND byte_size IS NOT NULL AND content_sha256 IS NOT NULL AND
          width IS NOT NULL AND height IS NOT NULL AND
          ((media_type='IMAGE' AND duration_ms IS NULL) OR(media_type='VIDEO' AND duration_ms IS NOT NULL)) AND
          ready_at IS NOT NULL AND failure_code IS NULL
        )),
        CHECK(status NOT IN ('REJECTED','FAILED') OR failure_code IS NOT NULL),
        CHECK(status NOT IN ('DELETING','DELETED') OR deletion_requested_at IS NOT NULL),
        CHECK(status!='DELETED' OR deleted_at IS NOT NULL)
      );

      CREATE UNIQUE INDEX IF NOT EXISTS uq_content_assets_idempotency
        ON content_assets(workspace_id,created_by_user_id,operation_kind,idempotency_key);
      CREATE UNIQUE INDEX IF NOT EXISTS uq_content_assets_locator
        ON content_assets(storage_provider,storage_object_key);
      CREATE INDEX IF NOT EXISTS idx_content_assets_workspace_history
        ON content_assets(workspace_id,created_at DESC,id DESC);
      CREATE INDEX IF NOT EXISTS idx_content_assets_workspace_lifecycle
        ON content_assets(workspace_id,status,created_at,id);

      CREATE TRIGGER IF NOT EXISTS trg_content_assets_insert_guard BEFORE INSERT ON content_assets BEGIN
        SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM workspaces WHERE id=NEW.workspace_id AND status='active')
          THEN RAISE(ABORT,'content asset workspace must be active') END;
        SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.created_by_user_id AND status='active')
          THEN RAISE(ABORT,'content asset user must be active') END;
        SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM workspace_memberships WHERE workspace_id=NEW.workspace_id AND user_id=NEW.created_by_user_id AND status='active' AND role IN ('owner','admin','member'))
          THEN RAISE(ABORT,'content asset membership must be active') END;
      END;

      CREATE TRIGGER IF NOT EXISTS trg_content_assets_identity_immutable BEFORE UPDATE ON content_assets WHEN
        NEW.id IS NOT OLD.id OR NEW.workspace_id IS NOT OLD.workspace_id OR NEW.created_by_user_id IS NOT OLD.created_by_user_id OR
        NEW.media_type IS NOT OLD.media_type OR NEW.declared_mime_type IS NOT OLD.declared_mime_type OR
        NEW.declared_byte_size IS NOT OLD.declared_byte_size OR NEW.declared_sha256 IS NOT OLD.declared_sha256 OR
        NEW.original_filename IS NOT OLD.original_filename OR NEW.storage_provider IS NOT OLD.storage_provider OR
        NEW.storage_object_key IS NOT OLD.storage_object_key OR NEW.operation_kind IS NOT OLD.operation_kind OR
        NEW.idempotency_key IS NOT OLD.idempotency_key OR NEW.request_hash IS NOT OLD.request_hash OR NEW.created_at IS NOT OLD.created_at
      BEGIN SELECT RAISE(ABORT,'content asset identity is immutable'); END;

      CREATE TRIGGER IF NOT EXISTS trg_content_assets_transition_guard BEFORE UPDATE ON content_assets WHEN
        NEW.updated_at<=OLD.updated_at OR NOT(
          (OLD.status='UPLOADING' AND NEW.status IN ('VERIFYING','FAILED','DELETING')) OR
          (OLD.status='VERIFYING' AND NEW.status IN ('READY','REJECTED','FAILED','DELETING')) OR
          (OLD.status='FAILED' AND NEW.status IN ('VERIFYING','DELETING')) OR
          (OLD.status='REJECTED' AND NEW.status='DELETING') OR
          (OLD.status='READY' AND NEW.status='DELETING') OR
          (OLD.status='DELETING' AND NEW.status='DELETED')
        )
      BEGIN SELECT RAISE(ABORT,'content asset state transition invalid'); END;

      CREATE TRIGGER IF NOT EXISTS trg_content_assets_delete_reject BEFORE DELETE ON content_assets
      BEGIN SELECT RAISE(ABORT,'content assets cannot be deleted'); END;
    `);
  },
};
