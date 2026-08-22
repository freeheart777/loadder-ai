export const migration051UploadedCreativeLinkage = {
  version: 51,
  name: "uploaded_creative_linkage",
  up(db) {
    const columns = new Set(db.prepare("PRAGMA table_info(content_items)").all().map(({ name }) => name));
    if (!columns.has("primary_asset_id")) {
      const source = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='content_items'").get().sql;
      const tableSql = source
        .replace(/^CREATE TABLE "?content_items"?/, "CREATE TABLE content_items_v51")
        .replace("context_version_id TEXT REFERENCES business_context_versions(id),", "context_version_id TEXT REFERENCES business_context_versions(id),\n        primary_asset_id TEXT REFERENCES content_assets(id),")
        .replace("'content_item.manual')", "'content_item.manual','content_item.from_asset')")
        .replace("CHECK(updated_at >= created_at)", "CHECK((media_type='TEXT' AND primary_asset_id IS NULL) OR(media_type IN ('IMAGE','VIDEO') AND primary_asset_id IS NOT NULL)),\n        CHECK(updated_at >= created_at)")
        .replace("source_type IN ('CLIENT_UPLOADED','EXTERNAL_IMPORTED') AND source_generation_id IS NULL AND context_version_id IS NULL AND operation_kind='content_item.duplicate'", "source_type='CLIENT_UPLOADED' AND media_type IN ('IMAGE','VIDEO') AND source_generation_id IS NULL AND context_version_id IS NULL AND operation_kind IN ('content_item.from_asset','content_item.duplicate') OR\n          (source_type='EXTERNAL_IMPORTED' AND source_generation_id IS NULL AND context_version_id IS NULL AND operation_kind='content_item.duplicate')")
        .replace(/\)\s*$/, ")");
      db.exec(tableSql);
      db.exec(`INSERT INTO content_items_v51(id,workspace_id,created_by_user_id,source_type,source_generation_id,source_variant_index,media_type,contract_id,contract_version,placement_id,placement_version,context_version_id,title,content_json,revision,operation_kind,idempotency_key,request_hash,created_at,updated_at)
        SELECT id,workspace_id,created_by_user_id,source_type,source_generation_id,source_variant_index,media_type,contract_id,contract_version,placement_id,placement_version,context_version_id,title,content_json,revision,operation_kind,idempotency_key,request_hash,created_at,updated_at FROM content_items;
        DROP TABLE content_items; ALTER TABLE content_items_v51 RENAME TO content_items;`);
    }
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_content_items_idempotency ON content_items(workspace_id,created_by_user_id,operation_kind,idempotency_key);
      CREATE INDEX IF NOT EXISTS idx_content_items_workspace_updated ON content_items(workspace_id,updated_at DESC,id DESC);
      CREATE INDEX IF NOT EXISTS idx_content_items_workspace_primary_asset ON content_items(workspace_id,primary_asset_id,id);
      CREATE TRIGGER IF NOT EXISTS trg_content_items_insert_guard BEFORE INSERT ON content_items BEGIN
        SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM workspaces WHERE id=NEW.workspace_id AND status='active') THEN RAISE(ABORT,'content item workspace must be active') END;
        SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.created_by_user_id AND status='active') THEN RAISE(ABORT,'content item user must be active') END;
        SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM workspace_memberships WHERE workspace_id=NEW.workspace_id AND user_id=NEW.created_by_user_id AND status='active') THEN RAISE(ABORT,'content item membership must be active') END;
        SELECT CASE WHEN NEW.context_version_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM business_context_versions WHERE id=NEW.context_version_id AND workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'content item context workspace mismatch') END;
        SELECT CASE WHEN NEW.source_type='AI_GENERATED' AND NOT EXISTS(SELECT 1 FROM content_generations g WHERE g.id=NEW.source_generation_id AND g.workspace_id=NEW.workspace_id AND g.status='SUCCEEDED' AND NEW.source_variant_index<json_array_length(g.normalized_result_json,'$.variants') AND g.media_type=NEW.media_type AND g.contract_id=NEW.contract_id AND g.contract_version=NEW.contract_version AND g.placement_id=NEW.placement_id AND g.placement_version=NEW.placement_version AND g.context_version_id=NEW.context_version_id) THEN RAISE(ABORT,'content item generation lineage invalid') END;
        SELECT CASE WHEN NEW.primary_asset_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM content_assets a WHERE a.id=NEW.primary_asset_id AND a.workspace_id=NEW.workspace_id AND a.status='READY' AND a.media_type=NEW.media_type) THEN RAISE(ABORT,'content item asset lineage invalid') END;
      END;
      CREATE TRIGGER IF NOT EXISTS trg_content_items_lineage_immutable BEFORE UPDATE ON content_items WHEN NEW.id IS NOT OLD.id OR NEW.workspace_id IS NOT OLD.workspace_id OR NEW.created_by_user_id IS NOT OLD.created_by_user_id OR NEW.source_type IS NOT OLD.source_type OR NEW.source_generation_id IS NOT OLD.source_generation_id OR NEW.source_variant_index IS NOT OLD.source_variant_index OR NEW.media_type IS NOT OLD.media_type OR NEW.contract_id IS NOT OLD.contract_id OR NEW.contract_version IS NOT OLD.contract_version OR NEW.placement_id IS NOT OLD.placement_id OR NEW.placement_version IS NOT OLD.placement_version OR NEW.context_version_id IS NOT OLD.context_version_id OR NEW.primary_asset_id IS NOT OLD.primary_asset_id OR NEW.operation_kind IS NOT OLD.operation_kind OR NEW.idempotency_key IS NOT OLD.idempotency_key OR NEW.request_hash IS NOT OLD.request_hash OR NEW.created_at IS NOT OLD.created_at BEGIN SELECT RAISE(ABORT,'content item lineage is immutable'); END;
      CREATE TRIGGER IF NOT EXISTS trg_content_items_revision_guard BEFORE UPDATE ON content_items WHEN NEW.revision!=OLD.revision+1 OR NEW.updated_at<=OLD.updated_at BEGIN SELECT RAISE(ABORT,'content item revision must advance'); END;
      CREATE TRIGGER IF NOT EXISTS trg_content_items_delete_reject BEFORE DELETE ON content_items BEGIN SELECT RAISE(ABORT,'content items cannot be deleted'); END;
    `);
  },
};
