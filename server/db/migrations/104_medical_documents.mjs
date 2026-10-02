// Private patient documents (ADR-005 D2). Deliberately NOT site_media_assets:
// ownership is the patient + appointment, never a workspace-visibility flag.
// Ownership and content identity are immutable; deletion is a state change (the
// stored object is removed, the row stays as evidence); rows can never be DELETEd.
export const migration104MedicalDocuments = {
  version: 104,
  name: "medical_documents",
  up(db) {
    db.exec(`
CREATE TABLE IF NOT EXISTS medical_documents(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  site_project_id TEXT NOT NULL,
  auth_project_id TEXT NOT NULL,
  owner_app_user_id TEXT NOT NULL,
  appointment_id TEXT NOT NULL,
  title TEXT NOT NULL,
  original_name TEXT,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK(size_bytes>0),
  sha256 TEXT NOT NULL,
  storage_ref TEXT NOT NULL,
  scan_state TEXT NOT NULL DEFAULT 'pending' CHECK(scan_state IN('pending','clean','infected','error','not_scanned')),
  lifecycle_state TEXT NOT NULL DEFAULT 'active' CHECK(lifecycle_state IN('active','deleted')),
  retain_until TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(appointment_id) REFERENCES booking_appointments(id),
  FOREIGN KEY(owner_app_user_id) REFERENCES business_builder_app_users(id)
);
CREATE INDEX IF NOT EXISTS idx_medical_documents_appointment ON medical_documents(workspace_id,appointment_id,lifecycle_state);
CREATE INDEX IF NOT EXISTS idx_medical_documents_owner ON medical_documents(workspace_id,owner_app_user_id,lifecycle_state);
CREATE TRIGGER IF NOT EXISTS trg_medical_documents_guard
BEFORE INSERT ON medical_documents
BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM booking_appointments a WHERE a.id=NEW.appointment_id AND a.workspace_id=NEW.workspace_id AND a.site_project_id=NEW.site_project_id AND a.app_user_id=NEW.owner_app_user_id AND a.auth_project_id=NEW.auth_project_id) THEN RAISE(ABORT,'a medical document must belong to the patient''s own appointment') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_medical_documents_immutable
BEFORE UPDATE OF workspace_id,site_project_id,auth_project_id,owner_app_user_id,appointment_id,title,original_name,mime_type,size_bytes,sha256,storage_ref,created_at ON medical_documents
BEGIN
  SELECT RAISE(ABORT,'medical document ownership and content are immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_medical_documents_no_delete
BEFORE DELETE ON medical_documents
BEGIN
  SELECT RAISE(ABORT,'medical documents are never deleted, only marked deleted');
END;`);
  },
};
