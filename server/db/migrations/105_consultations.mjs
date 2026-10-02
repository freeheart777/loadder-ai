// Provider-independent consultation contract (ADR-005, Phase 7): a record tied to
// a remote (VIDEO/AUDIO) appointment with a lifecycle and an optional join-link
// SLOT that only a human fills. Nothing here talks to a video/audio provider or
// generates a URL, and asynchronous TEXT consultation is deliberately absent.
export const migration105Consultations = {
  version: 105,
  name: "consultations",
  up(db) {
    db.exec(`
CREATE TABLE IF NOT EXISTS consultations(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  site_project_id TEXT NOT NULL,
  appointment_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  modality TEXT NOT NULL CHECK(modality IN('VIDEO','AUDIO')),
  state TEXT NOT NULL DEFAULT 'scheduled' CHECK(state IN('scheduled','in_progress','completed','missed','cancelled')),
  join_link TEXT,
  join_link_set_at TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(appointment_id),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(appointment_id) REFERENCES booking_appointments(id)
);
CREATE INDEX IF NOT EXISTS idx_consultations_provider ON consultations(workspace_id,provider_id,state);
CREATE TRIGGER IF NOT EXISTS trg_consultations_guard
BEFORE INSERT ON consultations
BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM booking_appointments a WHERE a.id=NEW.appointment_id AND a.workspace_id=NEW.workspace_id AND a.site_project_id=NEW.site_project_id AND a.provider_id=NEW.provider_id AND a.modality=NEW.modality) THEN RAISE(ABORT,'a consultation must match its remote appointment') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_consultations_immutable
BEFORE UPDATE OF workspace_id,site_project_id,appointment_id,provider_id,modality,created_at ON consultations
BEGIN
  SELECT RAISE(ABORT,'consultation ownership is immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_consultations_no_delete
BEFORE DELETE ON consultations
BEGIN
  SELECT RAISE(ABORT,'consultations are never deleted');
END;`);
  },
};
