export const migration069BusinessBuilderCommerceBindings={version:69,name:"business_builder_commerce_bindings",up(db){db.exec(`
CREATE TABLE IF NOT EXISTS business_builder_commerce_bindings(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  site_project_id TEXT NOT NULL,
  business_builder_project_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(workspace_id,site_project_id),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY(site_project_id) REFERENCES site_projects(id) ON DELETE CASCADE,
  FOREIGN KEY(business_builder_project_id) REFERENCES business_builder_projects(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_bb_commerce_bindings_app ON business_builder_commerce_bindings(workspace_id,business_builder_project_id,status);
CREATE TRIGGER IF NOT EXISTS trg_bb_commerce_bindings_tenant_guard
BEFORE INSERT ON business_builder_commerce_bindings
BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM site_projects s WHERE s.id=NEW.site_project_id AND s.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'commerce binding site workspace mismatch') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM business_builder_projects p WHERE p.id=NEW.business_builder_project_id AND p.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'commerce binding app workspace mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_bb_commerce_bindings_update_tenant_guard
BEFORE UPDATE OF site_project_id,business_builder_project_id,workspace_id ON business_builder_commerce_bindings
BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM site_projects s WHERE s.id=NEW.site_project_id AND s.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'commerce binding site workspace mismatch') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM business_builder_projects p WHERE p.id=NEW.business_builder_project_id AND p.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'commerce binding app workspace mismatch') END;
END;
`);}};
