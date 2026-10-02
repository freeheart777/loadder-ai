// Per-doctor care modes (ADR-005, Phase 2B). The service decides which modes
// exist at all; a provider-service link may only RESTRICT them. NULL means "all
// of the service's modes" so every existing link keeps its behavior.
export const migration101BookingProviderServiceModalities = {
  version: 101,
  name: "booking_provider_service_modalities",
  up(db) {
    db.exec(`ALTER TABLE booking_provider_services ADD COLUMN modalities_json TEXT CHECK(modalities_json IS NULL OR json_valid(modalities_json));`);
  },
};
