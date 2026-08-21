export const migration047ContentItems = {
  version: 47,
  name: "content_items",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS content_items (
        id TEXT PRIMARY KEY CHECK(length(id) BETWEEN 1 AND 100),
        workspace_id TEXT NOT NULL REFERENCES workspaces(id),
        created_by_user_id TEXT NOT NULL REFERENCES users(id),
        source_generation_id TEXT REFERENCES content_generations(id),
        source_variant_index INTEGER,
        media_type TEXT NOT NULL CHECK(media_type IN ('TEXT','IMAGE','VIDEO')),
        contract_id TEXT NOT NULL CHECK(length(contract_id) BETWEEN 1 AND 100),
        contract_version INTEGER NOT NULL CHECK(contract_version > 0),
        placement_id TEXT NOT NULL CHECK(length(placement_id) BETWEEN 1 AND 100),
        placement_version INTEGER NOT NULL CHECK(placement_version > 0),
        context_version_id TEXT NOT NULL REFERENCES business_context_versions(id),
        title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
        content_json TEXT NOT NULL CHECK(json_valid(content_json) AND length(content_json) <= 35000),
        revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0),
        operation_kind TEXT NOT NULL CHECK(operation_kind IN ('content_item.save','content_item.duplicate')),
        idempotency_key TEXT NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 200),
        request_hash TEXT NOT NULL CHECK(length(request_hash)=64 AND request_hash NOT GLOB '*[^0-9a-f]*'),
        created_at TEXT NOT NULL CHECK(length(created_at) BETWEEN 20 AND 40),
        updated_at TEXT NOT NULL CHECK(length(updated_at) BETWEEN 20 AND 40),
        CHECK((source_generation_id IS NULL AND source_variant_index IS NULL) OR
              (source_generation_id IS NOT NULL AND source_variant_index IS NOT NULL AND source_variant_index >= 0)),
        CHECK(updated_at >= created_at)
      );

      CREATE UNIQUE INDEX IF NOT EXISTS uq_content_items_idempotency
        ON content_items(workspace_id,created_by_user_id,operation_kind,idempotency_key);
      CREATE INDEX IF NOT EXISTS idx_content_items_workspace_updated
        ON content_items(workspace_id,updated_at DESC,id DESC);

      CREATE TRIGGER IF NOT EXISTS trg_content_items_insert_guard
      BEFORE INSERT ON content_items BEGIN
        SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM workspaces WHERE id=NEW.workspace_id AND status='active')
          THEN RAISE(ABORT,'content item workspace must be active') END;
        SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.created_by_user_id AND status='active')
          THEN RAISE(ABORT,'content item user must be active') END;
        SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM workspace_memberships WHERE workspace_id=NEW.workspace_id AND user_id=NEW.created_by_user_id AND status='active')
          THEN RAISE(ABORT,'content item membership must be active') END;
        SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM business_context_versions WHERE id=NEW.context_version_id AND workspace_id=NEW.workspace_id)
          THEN RAISE(ABORT,'content item context workspace mismatch') END;
        SELECT CASE WHEN NEW.source_generation_id IS NOT NULL AND NOT EXISTS(
          SELECT 1 FROM content_generations g WHERE g.id=NEW.source_generation_id AND g.workspace_id=NEW.workspace_id
            AND g.status='SUCCEEDED' AND NEW.source_variant_index < json_array_length(g.normalized_result_json,'$.variants')
            AND g.media_type=NEW.media_type AND g.contract_id=NEW.contract_id AND g.contract_version=NEW.contract_version
            AND g.placement_id=NEW.placement_id AND g.placement_version=NEW.placement_version AND g.context_version_id=NEW.context_version_id
        ) THEN RAISE(ABORT,'content item generation lineage invalid') END;
      END;

      CREATE TRIGGER IF NOT EXISTS trg_content_items_lineage_immutable
      BEFORE UPDATE ON content_items WHEN
        NEW.id IS NOT OLD.id OR NEW.workspace_id IS NOT OLD.workspace_id OR NEW.created_by_user_id IS NOT OLD.created_by_user_id OR
        NEW.source_generation_id IS NOT OLD.source_generation_id OR NEW.source_variant_index IS NOT OLD.source_variant_index OR
        NEW.media_type IS NOT OLD.media_type OR NEW.contract_id IS NOT OLD.contract_id OR NEW.contract_version IS NOT OLD.contract_version OR
        NEW.placement_id IS NOT OLD.placement_id OR NEW.placement_version IS NOT OLD.placement_version OR
        NEW.context_version_id IS NOT OLD.context_version_id OR NEW.operation_kind IS NOT OLD.operation_kind OR
        NEW.idempotency_key IS NOT OLD.idempotency_key OR NEW.request_hash IS NOT OLD.request_hash OR NEW.created_at IS NOT OLD.created_at
      BEGIN SELECT RAISE(ABORT,'content item lineage is immutable'); END;

      CREATE TRIGGER IF NOT EXISTS trg_content_items_revision_guard
      BEFORE UPDATE ON content_items WHEN NEW.revision != OLD.revision + 1 OR NEW.updated_at <= OLD.updated_at
      BEGIN SELECT RAISE(ABORT,'content item revision must advance'); END;

      CREATE TRIGGER IF NOT EXISTS trg_content_items_delete_reject
      BEFORE DELETE ON content_items BEGIN SELECT RAISE(ABORT,'content items cannot be deleted'); END;
    `);
  },
};
