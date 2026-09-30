export const migration092BookingOperationalBaseline = {
  version: 92,
  name: "booking_operational_baseline",
  up(db) {
    db.exec(`
CREATE TABLE IF NOT EXISTS booking_services (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, name TEXT NOT NULL, duration_minutes INTEGER NOT NULL CHECK(duration_minutes > 0), active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(workspace_id) REFERENCES workspaces(id));
CREATE TABLE IF NOT EXISTS booking_providers (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(workspace_id) REFERENCES workspaces(id));
CREATE TABLE IF NOT EXISTS booking_provider_services (workspace_id TEXT NOT NULL, provider_id TEXT NOT NULL, service_id TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(workspace_id,provider_id,service_id), FOREIGN KEY(provider_id) REFERENCES booking_providers(id) ON DELETE CASCADE, FOREIGN KEY(service_id) REFERENCES booking_services(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS booking_availability (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, provider_id TEXT NOT NULL, weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6), starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(provider_id) REFERENCES booking_providers(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS booking_appointments (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, service_id TEXT NOT NULL, provider_id TEXT NOT NULL, customer_name TEXT NOT NULL, starts_at TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('PENDING','CONFIRMED','CANCELLED','COMPLETED')), created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(service_id) REFERENCES booking_services(id), FOREIGN KEY(provider_id) REFERENCES booking_providers(id));
CREATE INDEX IF NOT EXISTS idx_booking_services_workspace ON booking_services(workspace_id);
CREATE INDEX IF NOT EXISTS idx_booking_providers_workspace ON booking_providers(workspace_id);
CREATE INDEX IF NOT EXISTS idx_booking_appointments_workspace ON booking_appointments(workspace_id,starts_at);
CREATE TRIGGER IF NOT EXISTS trg_booking_provider_service_workspace BEFORE INSERT ON booking_provider_services BEGIN SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM booking_providers WHERE id=NEW.provider_id AND workspace_id=NEW.workspace_id) OR NOT EXISTS(SELECT 1 FROM booking_services WHERE id=NEW.service_id AND workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'booking association workspace mismatch') END; END;
CREATE TRIGGER IF NOT EXISTS trg_booking_availability_workspace BEFORE INSERT ON booking_availability BEGIN SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM booking_providers WHERE id=NEW.provider_id AND workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'booking availability workspace mismatch') END; END;
CREATE TRIGGER IF NOT EXISTS trg_booking_appointment_workspace BEFORE INSERT ON booking_appointments BEGIN SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM booking_providers WHERE id=NEW.provider_id AND workspace_id=NEW.workspace_id) OR NOT EXISTS(SELECT 1 FROM booking_services WHERE id=NEW.service_id AND workspace_id=NEW.workspace_id) OR NOT EXISTS(SELECT 1 FROM booking_provider_services WHERE workspace_id=NEW.workspace_id AND provider_id=NEW.provider_id AND service_id=NEW.service_id) THEN RAISE(ABORT,'booking appointment workspace mismatch') END; END;
`);
  },
};
