export const migration048ContentItemSourceIdentity = {
  version: 48,
  name: "content_item_source_identity",
  up(db) {
    db.exec(`
      CREATE TABLE content_items_v48 (
        id TEXT PRIMARY KEY CHECK(length(id) BETWEEN 1 AND 100),
        workspace_id TEXT NOT NULL REFERENCES workspaces(id),
        created_by_user_id TEXT NOT NULL REFERENCES users(id),
        source_type TEXT NOT NULL CHECK(source_type IN ('AI_GENERATED','CLIENT_UPLOADED','MANUAL_TEXT','EXTERNAL_IMPORTED')),
        source_generation_id TEXT REFERENCES content_generations(id),
        source_variant_index INTEGER,
        media_type TEXT NOT NULL CHECK(media_type IN ('TEXT','IMAGE','VIDEO')),
        contract_id TEXT CHECK(contract_id IS NULL OR length(contract_id) BETWEEN 1 AND 100),
        contract_version INTEGER CHECK(contract_version IS NULL OR contract_version > 0),
        placement_id TEXT CHECK(placement_id IS NULL OR length(placement_id) BETWEEN 1 AND 100),
        placement_version INTEGER CHECK(placement_version IS NULL OR placement_version > 0),
        context_version_id TEXT REFERENCES business_context_versions(id),
        title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
        content_json TEXT NOT NULL CHECK(json_valid(content_json) AND length(content_json) <= 35000),
        revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0),
        operation_kind TEXT NOT NULL CHECK(operation_kind IN ('content_item.save','content_item.duplicate','content_item.manual')),
        idempotency_key TEXT NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 200),
        request_hash TEXT NOT NULL CHECK(length(request_hash)=64 AND request_hash NOT GLOB '*[^0-9a-f]*'),
        created_at TEXT NOT NULL CHECK(length(created_at) BETWEEN 20 AND 40),
        updated_at TEXT NOT NULL CHECK(length(updated_at) BETWEEN 20 AND 40),
        CHECK((source_generation_id IS NULL AND source_variant_index IS NULL) OR
              (source_generation_id IS NOT NULL AND source_variant_index IS NOT NULL AND source_variant_index >= 0)),
        CHECK((contract_id IS NULL AND contract_version IS NULL) OR (contract_id IS NOT NULL AND contract_version IS NOT NULL)),
        CHECK((placement_id IS NULL AND placement_version IS NULL) OR (placement_id IS NOT NULL AND placement_version IS NOT NULL)),
        CHECK(
          (source_type='AI_GENERATED' AND source_generation_id IS NOT NULL AND contract_id IS NOT NULL AND placement_id IS NOT NULL AND context_version_id IS NOT NULL AND operation_kind IN ('content_item.save','content_item.duplicate')) OR
          (source_type='MANUAL_TEXT' AND media_type='TEXT' AND source_generation_id IS NULL AND contract_id IS NOT NULL AND placement_id IS NOT NULL AND context_version_id IS NULL AND operation_kind IN ('content_item.manual','content_item.duplicate')) OR
          (source_type IN ('CLIENT_UPLOADED','EXTERNAL_IMPORTED') AND source_generation_id IS NULL AND context_version_id IS NULL AND operation_kind='content_item.duplicate')
        ),
        CHECK(updated_at >= created_at)
      );

      INSERT INTO content_items_v48(
        id,workspace_id,created_by_user_id,source_type,source_generation_id,source_variant_index,media_type,
        contract_id,contract_version,placement_id,placement_version,context_version_id,title,content_json,
        revision,operation_kind,idempotency_key,request_hash,created_at,updated_at
      ) SELECT
        id,workspace_id,created_by_user_id,'AI_GENERATED',source_generation_id,source_variant_index,media_type,
        contract_id,contract_version,placement_id,placement_version,context_version_id,title,content_json,
        revision,operation_kind,idempotency_key,request_hash,created_at,updated_at
      FROM content_items;

      DROP TABLE content_items;
      ALTER TABLE content_items_v48 RENAME TO content_items;

      CREATE UNIQUE INDEX uq_content_items_idempotency
        ON content_items(workspace_id,created_by_user_id,operation_kind,idempotency_key);
      CREATE INDEX idx_content_items_workspace_updated
        ON content_items(workspace_id,updated_at DESC,id DESC);

      CREATE TRIGGER trg_content_items_insert_guard
      BEFORE INSERT ON content_items BEGIN
        SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM workspaces WHERE id=NEW.workspace_id AND status='active')
          THEN RAISE(ABORT,'content item workspace must be active') END;
        SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.created_by_user_id AND status='active')
          THEN RAISE(ABORT,'content item user must be active') END;
        SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM workspace_memberships WHERE workspace_id=NEW.workspace_id AND user_id=NEW.created_by_user_id AND status='active')
          THEN RAISE(ABORT,'content item membership must be active') END;
        SELECT CASE WHEN NEW.context_version_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM business_context_versions WHERE id=NEW.context_version_id AND workspace_id=NEW.workspace_id)
          THEN RAISE(ABORT,'content item context workspace mismatch') END;
        SELECT CASE WHEN NEW.source_type='AI_GENERATED' AND NOT EXISTS(
          SELECT 1 FROM content_generations g WHERE g.id=NEW.source_generation_id AND g.workspace_id=NEW.workspace_id
            AND g.status='SUCCEEDED' AND NEW.source_variant_index < json_array_length(g.normalized_result_json,'$.variants')
            AND g.media_type=NEW.media_type AND g.contract_id=NEW.contract_id AND g.contract_version=NEW.contract_version
            AND g.placement_id=NEW.placement_id AND g.placement_version=NEW.placement_version AND g.context_version_id=NEW.context_version_id
        ) THEN RAISE(ABORT,'content item generation lineage invalid') END;
      END;

      CREATE TRIGGER trg_content_items_lineage_immutable
      BEFORE UPDATE ON content_items WHEN
        NEW.id IS NOT OLD.id OR NEW.workspace_id IS NOT OLD.workspace_id OR NEW.created_by_user_id IS NOT OLD.created_by_user_id OR
        NEW.source_type IS NOT OLD.source_type OR NEW.source_generation_id IS NOT OLD.source_generation_id OR NEW.source_variant_index IS NOT OLD.source_variant_index OR
        NEW.media_type IS NOT OLD.media_type OR NEW.contract_id IS NOT OLD.contract_id OR NEW.contract_version IS NOT OLD.contract_version OR
        NEW.placement_id IS NOT OLD.placement_id OR NEW.placement_version IS NOT OLD.placement_version OR
        NEW.context_version_id IS NOT OLD.context_version_id OR NEW.operation_kind IS NOT OLD.operation_kind OR
        NEW.idempotency_key IS NOT OLD.idempotency_key OR NEW.request_hash IS NOT OLD.request_hash OR NEW.created_at IS NOT OLD.created_at
      BEGIN SELECT RAISE(ABORT,'content item lineage is immutable'); END;

      CREATE TRIGGER trg_content_items_revision_guard
      BEFORE UPDATE ON content_items WHEN NEW.revision != OLD.revision + 1 OR NEW.updated_at <= OLD.updated_at
      BEGIN SELECT RAISE(ABORT,'content item revision must advance'); END;

      CREATE TRIGGER trg_content_items_delete_reject
      BEFORE DELETE ON content_items BEGIN SELECT RAISE(ABORT,'content items cannot be deleted'); END;
    `);
  },
};
