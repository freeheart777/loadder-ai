// Patient identity on the existing app-user system (ADR-005 D1). A site gets a
// system "site_identity" auth project (hidden from Business Builder lists); a
// binding ties the site to it. Identifiers (mobile now, email/passkey later)
// live beside the app user, never replacing it, and OTP challenges are hashed
// at rest, attempt-limited, expiring and single-use.
export const migration102PatientIdentity = {
  version: 102,
  name: "patient_identity",
  up(db) {
    db.exec(`
ALTER TABLE business_builder_projects ADD COLUMN kind TEXT CHECK(kind IS NULL OR kind IN('site_identity'));

CREATE TABLE IF NOT EXISTS site_identity_bindings(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  site_project_id TEXT NOT NULL,
  auth_project_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN('active','disabled')),
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(workspace_id,site_project_id),
  UNIQUE(auth_project_id),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY(site_project_id) REFERENCES site_projects(id) ON DELETE CASCADE,
  FOREIGN KEY(auth_project_id) REFERENCES business_builder_projects(id) ON DELETE CASCADE
);
CREATE TRIGGER IF NOT EXISTS trg_site_identity_bindings_guard
BEFORE INSERT ON site_identity_bindings
BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM site_projects s WHERE s.id=NEW.site_project_id AND s.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'identity binding site workspace mismatch') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM business_builder_projects p WHERE p.id=NEW.auth_project_id AND p.workspace_id=NEW.workspace_id AND p.kind='site_identity') THEN RAISE(ABORT,'identity binding requires a site identity auth project of this workspace') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_site_identity_bindings_immutable
BEFORE UPDATE OF workspace_id,site_project_id,auth_project_id ON site_identity_bindings
BEGIN
  SELECT RAISE(ABORT,'identity binding targets are immutable');
END;

CREATE TABLE IF NOT EXISTS app_user_identifiers(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  app_user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN('mobile','email')),
  value_normalized TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK(is_primary IN(0,1)),
  verified_at TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN('active','disabled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(workspace_id,project_id,kind,value_normalized),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY(app_user_id) REFERENCES business_builder_app_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_app_user_identifiers_user ON app_user_identifiers(workspace_id,app_user_id);
CREATE TRIGGER IF NOT EXISTS trg_app_user_identifiers_guard
BEFORE INSERT ON app_user_identifiers
BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM business_builder_app_users u WHERE u.id=NEW.app_user_id AND u.workspace_id=NEW.workspace_id AND u.project_id=NEW.project_id) THEN RAISE(ABORT,'identifier must belong to an app user of this project') END;
END;

CREATE TABLE IF NOT EXISTS app_user_otp_challenges(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN('mobile','email')),
  value_normalized TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'signin' CHECK(purpose IN('signin')),
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL CHECK(max_attempts>0),
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY(project_id) REFERENCES business_builder_projects(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_app_user_otp_challenges_lookup ON app_user_otp_challenges(workspace_id,project_id,kind,value_normalized,created_at);
`);
  },
};
