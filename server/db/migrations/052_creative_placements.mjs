export const migration052CreativePlacements = {
  version: 52,
  name: "creative_placements",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS creative_placements (
        id TEXT PRIMARY KEY CHECK(length(id) BETWEEN 1 AND 100),
        workspace_id TEXT NOT NULL REFERENCES workspaces(id),
        content_item_id TEXT NOT NULL REFERENCES content_items(id),
        placement_kind TEXT NOT NULL CHECK(placement_kind IN ('WEBSITE','SOCIAL','ADVERTISEMENT','EMAIL','OTHER')),
        channel TEXT NOT NULL CHECK(length(channel) BETWEEN 1 AND 80 AND channel NOT GLOB '*[^a-z0-9._-]*'),
        status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','PAUSED','REMOVED')),
        external_reference_id TEXT CHECK(external_reference_id IS NULL OR length(external_reference_id) BETWEEN 1 AND 200),
        created_by_user_id TEXT NOT NULL REFERENCES users(id),
        operation_kind TEXT NOT NULL CHECK(operation_kind='creative_placement.create'),
        idempotency_key TEXT NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 200),
        request_hash TEXT NOT NULL CHECK(length(request_hash)=64 AND request_hash NOT GLOB '*[^0-9a-f]*'),
        created_at TEXT NOT NULL CHECK(length(created_at) BETWEEN 20 AND 40),
        updated_at TEXT NOT NULL CHECK(length(updated_at) BETWEEN 20 AND 40),
        CHECK(updated_at>=created_at)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uq_creative_placements_idempotency
        ON creative_placements(workspace_id,created_by_user_id,operation_kind,idempotency_key);
      CREATE INDEX IF NOT EXISTS idx_creative_placements_content_history
        ON creative_placements(workspace_id,content_item_id,created_at DESC,id DESC);

      CREATE TRIGGER IF NOT EXISTS trg_creative_placements_insert_guard BEFORE INSERT ON creative_placements BEGIN
        SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM workspaces WHERE id=NEW.workspace_id AND status='active') THEN RAISE(ABORT,'creative placement workspace must be active') END;
        SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.created_by_user_id AND status='active') THEN RAISE(ABORT,'creative placement user must be active') END;
        SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM workspace_memberships WHERE workspace_id=NEW.workspace_id AND user_id=NEW.created_by_user_id AND status='active') THEN RAISE(ABORT,'creative placement membership must be active') END;
        SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM content_items WHERE id=NEW.content_item_id AND workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'creative placement content item mismatch') END;
      END;
      CREATE TRIGGER IF NOT EXISTS trg_creative_placements_identity_immutable BEFORE UPDATE ON creative_placements WHEN
        NEW.id IS NOT OLD.id OR NEW.workspace_id IS NOT OLD.workspace_id OR NEW.content_item_id IS NOT OLD.content_item_id OR
        NEW.placement_kind IS NOT OLD.placement_kind OR NEW.channel IS NOT OLD.channel OR
        NEW.external_reference_id IS NOT OLD.external_reference_id OR NEW.created_by_user_id IS NOT OLD.created_by_user_id OR
        NEW.operation_kind IS NOT OLD.operation_kind OR NEW.idempotency_key IS NOT OLD.idempotency_key OR
        NEW.request_hash IS NOT OLD.request_hash OR NEW.created_at IS NOT OLD.created_at
      BEGIN SELECT RAISE(ABORT,'creative placement identity is immutable'); END;
      CREATE TRIGGER IF NOT EXISTS trg_creative_placements_status_guard BEFORE UPDATE ON creative_placements WHEN
        NEW.updated_at<=OLD.updated_at OR NOT(
          (OLD.status='ACTIVE' AND NEW.status IN ('PAUSED','REMOVED')) OR
          (OLD.status='PAUSED' AND NEW.status IN ('ACTIVE','REMOVED'))
        )
      BEGIN SELECT RAISE(ABORT,'creative placement status transition invalid'); END;
      CREATE TRIGGER IF NOT EXISTS trg_creative_placements_delete_reject BEFORE DELETE ON creative_placements
      BEGIN SELECT RAISE(ABORT,'creative placements cannot be deleted'); END;
    `);
  },
};
