// Links a Booking provider (a doctor) to an existing employee app user of the
// site's identity project (ADR-005, Phase 4). One identity per provider; the
// link never changes target, only its status.
export const migration103BookingProviderIdentity = {
  version: 103,
  name: "booking_provider_identity",
  up(db) {
    db.exec(`
CREATE TABLE IF NOT EXISTS booking_provider_identities(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  site_project_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  auth_project_id TEXT NOT NULL,
  app_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN('active','disabled')),
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(provider_id),
  UNIQUE(app_user_id),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY(provider_id) REFERENCES booking_providers(id) ON DELETE CASCADE,
  FOREIGN KEY(app_user_id) REFERENCES business_builder_app_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_booking_provider_identities_site ON booking_provider_identities(workspace_id,site_project_id,status);
CREATE TRIGGER IF NOT EXISTS trg_booking_provider_identities_guard
BEFORE INSERT ON booking_provider_identities
BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM booking_providers p WHERE p.id=NEW.provider_id AND p.workspace_id=NEW.workspace_id AND p.site_project_id=NEW.site_project_id) THEN RAISE(ABORT,'doctor identity requires a provider scoped to this site') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM site_identity_bindings b WHERE b.workspace_id=NEW.workspace_id AND b.site_project_id=NEW.site_project_id AND b.auth_project_id=NEW.auth_project_id) THEN RAISE(ABORT,'doctor identity requires the site identity project') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM business_builder_app_users u WHERE u.id=NEW.app_user_id AND u.workspace_id=NEW.workspace_id AND u.project_id=NEW.auth_project_id AND u.role='employee') THEN RAISE(ABORT,'doctor identity requires an employee app user') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_booking_provider_identities_immutable
BEFORE UPDATE OF workspace_id,site_project_id,provider_id,auth_project_id,app_user_id ON booking_provider_identities
BEGIN
  SELECT RAISE(ABORT,'doctor identity targets are immutable');
END;`);
  },
};
