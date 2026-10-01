export const migration095BookingCustomerJourneyFoundation = {
  version: 95,
  name: "booking_customer_journey_foundation",
  up(db) {
    db.exec(`
ALTER TABLE booking_services ADD COLUMN modalities_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE booking_services ADD COLUMN price_amount INTEGER;
ALTER TABLE booking_services ADD COLUMN price_currency TEXT;
ALTER TABLE booking_availability ADD COLUMN capacity INTEGER NOT NULL DEFAULT 1 CHECK(capacity > 0);
ALTER TABLE booking_availability ADD COLUMN status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','CANCELLED'));
ALTER TABLE booking_appointments ADD COLUMN customer_contact TEXT;
ALTER TABLE booking_appointments ADD COLUMN modality TEXT;
ALTER TABLE booking_appointments ADD COLUMN booking_reference TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_appointments_reference_workspace ON booking_appointments(workspace_id, booking_reference) WHERE booking_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_booking_appointments_slot ON booking_appointments(workspace_id, provider_id, starts_at, status);
`);
  },
};
