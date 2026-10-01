// Additive, nullable site scope for the canonical Booking domain (ADR-005 D3).
// Historical rows keep NULL and stay valid; nothing is back-filled. A scoped
// row's service, provider, association and appointment must share one scope,
// the scope must belong to the row's workspace, and it can never change.
const TABLES = ["booking_services", "booking_providers", "booking_appointments"];

export const migration099BookingSiteScope = {
  version: 99,
  name: "booking_site_scope",
  up(db) {
    for (const table of TABLES) {
      db.exec(`
ALTER TABLE ${table} ADD COLUMN site_project_id TEXT REFERENCES site_projects(id);
CREATE INDEX IF NOT EXISTS idx_${table}_site ON ${table}(workspace_id,site_project_id);
CREATE TRIGGER IF NOT EXISTS trg_${table}_site_insert
BEFORE INSERT ON ${table}
WHEN NEW.site_project_id IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM site_projects s WHERE s.id=NEW.site_project_id AND s.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'booking site scope must belong to the workspace') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_${table}_site_immutable
BEFORE UPDATE OF site_project_id ON ${table}
WHEN OLD.site_project_id IS NOT NEW.site_project_id
BEGIN
  SELECT RAISE(ABORT,'booking site scope is immutable');
END;`);
    }
    db.exec(`
CREATE TRIGGER IF NOT EXISTS trg_booking_provider_services_scope
BEFORE INSERT ON booking_provider_services
BEGIN
  SELECT CASE WHEN (SELECT site_project_id FROM booking_providers WHERE id=NEW.provider_id AND workspace_id=NEW.workspace_id) IS NOT (SELECT site_project_id FROM booking_services WHERE id=NEW.service_id AND workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'booking scope mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_booking_appointments_scope
BEFORE INSERT ON booking_appointments
BEGIN
  SELECT CASE WHEN NEW.site_project_id IS NOT (SELECT site_project_id FROM booking_services WHERE id=NEW.service_id AND workspace_id=NEW.workspace_id) OR NEW.site_project_id IS NOT (SELECT site_project_id FROM booking_providers WHERE id=NEW.provider_id AND workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'booking scope mismatch') END;
END;`);
  },
};
