export const migration070BusinessBuilderCommerceOutbox={version:70,name:"business_builder_commerce_outbox",up(db){db.exec(`
CREATE TABLE IF NOT EXISTS business_builder_commerce_outbox(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  site_project_id TEXT NOT NULL,
  business_builder_project_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  order_id TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','delivered')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  available_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  delivered_at TEXT,
  UNIQUE(workspace_id,event_id),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY(site_project_id) REFERENCES site_projects(id) ON DELETE CASCADE,
  FOREIGN KEY(business_builder_project_id) REFERENCES business_builder_projects(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_bb_commerce_outbox_pending ON business_builder_commerce_outbox(workspace_id,status,available_at,created_at);
CREATE TRIGGER IF NOT EXISTS trg_bb_commerce_outbox_tenant_guard
BEFORE INSERT ON business_builder_commerce_outbox
BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM site_projects s WHERE s.id=NEW.site_project_id AND s.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'commerce outbox site workspace mismatch') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM business_builder_projects p WHERE p.id=NEW.business_builder_project_id AND p.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'commerce outbox app workspace mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_bb_commerce_outbox_identity_immutable
BEFORE UPDATE OF workspace_id,site_project_id,business_builder_project_id,event_id,event_type,order_id,payload_json,created_at ON business_builder_commerce_outbox
BEGIN SELECT RAISE(ABORT,'commerce outbox event identity is immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_bb_commerce_outbox_no_delete
BEFORE DELETE ON business_builder_commerce_outbox
BEGIN SELECT RAISE(ABORT,'commerce outbox is append-preserved'); END;
`);}};
