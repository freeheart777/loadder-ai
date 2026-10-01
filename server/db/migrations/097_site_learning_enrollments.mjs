// Student entitlement for Education sites. The student identity is the existing
// business-builder app user (role "customer"); this table only records which
// app users may read an Education site's private learning resources.
export const migration097SiteLearningEnrollments = {
  version: 97,
  name: "site_learning_enrollments",
  up(db) {
    db.exec(`
CREATE TABLE IF NOT EXISTS site_learning_enrollments(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  site_project_id TEXT NOT NULL,
  auth_project_id TEXT NOT NULL,
  app_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN('active','revoked')),
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revoked_at TEXT,
  UNIQUE(workspace_id,site_project_id,auth_project_id,app_user_id),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY(site_project_id) REFERENCES site_projects(id) ON DELETE CASCADE,
  FOREIGN KEY(auth_project_id) REFERENCES business_builder_projects(id) ON DELETE CASCADE,
  FOREIGN KEY(app_user_id) REFERENCES business_builder_app_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_site_learning_enrollments_site ON site_learning_enrollments(workspace_id,site_project_id,status);
CREATE TRIGGER IF NOT EXISTS trg_site_learning_enrollments_guard
BEFORE INSERT ON site_learning_enrollments
BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM site_projects s WHERE s.id=NEW.site_project_id AND s.workspace_id=NEW.workspace_id AND s.site_type='EDUCATION') THEN RAISE(ABORT,'learning enrollment requires an education site in this workspace') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM business_builder_app_users u WHERE u.id=NEW.app_user_id AND u.workspace_id=NEW.workspace_id AND u.project_id=NEW.auth_project_id AND u.role='customer') THEN RAISE(ABORT,'learning enrollment requires a customer app user of the auth project') END;
END;
`);
  },
};
