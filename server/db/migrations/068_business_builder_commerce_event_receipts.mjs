export const migration068BusinessBuilderCommerceEventReceipts={version:68,name:"business_builder_commerce_event_receipts",up(db){db.exec(`
CREATE TABLE IF NOT EXISTS business_builder_commerce_event_receipts(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  consumer TEXT NOT NULL CHECK(consumer IN ('inventory','crm','accounting','analytics')),
  event_type TEXT NOT NULL,
  order_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('processed','failed')),
  details_json TEXT NOT NULL DEFAULT '{}',
  processed_at TEXT NOT NULL,
  UNIQUE(workspace_id,project_id,event_id,consumer),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY(project_id) REFERENCES business_builder_projects(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_bb_commerce_receipts_lookup ON business_builder_commerce_event_receipts(workspace_id,project_id,event_id,processed_at DESC);
CREATE TRIGGER IF NOT EXISTS trg_bb_commerce_receipts_tenant_guard
BEFORE INSERT ON business_builder_commerce_event_receipts
BEGIN
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM business_builder_projects p
    WHERE p.id=NEW.project_id AND p.workspace_id=NEW.workspace_id
  ) THEN RAISE(ABORT,'commerce receipt project workspace mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_bb_commerce_receipts_immutable_update
BEFORE UPDATE ON business_builder_commerce_event_receipts
BEGIN SELECT RAISE(ABORT,'commerce receipt is immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_bb_commerce_receipts_immutable_delete
BEFORE DELETE ON business_builder_commerce_event_receipts
BEGIN SELECT RAISE(ABORT,'commerce receipt is immutable'); END;
`);}};
