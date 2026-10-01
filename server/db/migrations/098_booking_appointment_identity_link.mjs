// Additive, nullable link from an appointment to the existing app-user identity.
// Historical and anonymous appointments keep NULLs and are never back-filled:
// ownership is only ever recorded at creation from a verified app-user session.
export const migration098BookingAppointmentIdentityLink = {
  version: 98,
  name: "booking_appointment_identity_link",
  up(db) {
    db.exec(`
ALTER TABLE booking_appointments ADD COLUMN app_user_id TEXT;
ALTER TABLE booking_appointments ADD COLUMN auth_project_id TEXT;
CREATE INDEX IF NOT EXISTS idx_booking_appointments_identity ON booking_appointments(workspace_id,auth_project_id,app_user_id,starts_at);
CREATE TRIGGER IF NOT EXISTS trg_booking_appointments_identity_insert
BEFORE INSERT ON booking_appointments
WHEN NEW.app_user_id IS NOT NULL OR NEW.auth_project_id IS NOT NULL
BEGIN
  SELECT CASE WHEN NEW.app_user_id IS NULL OR NEW.auth_project_id IS NULL OR NOT EXISTS(SELECT 1 FROM business_builder_app_users u WHERE u.id=NEW.app_user_id AND u.workspace_id=NEW.workspace_id AND u.project_id=NEW.auth_project_id AND u.role='customer') THEN RAISE(ABORT,'appointment identity must be a customer app user of this workspace') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_booking_appointments_identity_immutable
BEFORE UPDATE OF app_user_id,auth_project_id ON booking_appointments
WHEN OLD.app_user_id IS NOT NEW.app_user_id OR OLD.auth_project_id IS NOT NEW.auth_project_id
BEGIN
  SELECT RAISE(ABORT,'appointment identity link is immutable');
END;
`);
  },
};
