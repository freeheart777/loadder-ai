export const migration033ListeningGuards = {
  version: 33,
  name: "listening_guards",
  up(db) {
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS trg_listening_version_workspace_insert BEFORE INSERT ON listening_monitor_versions BEGIN
        SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM listening_monitors m WHERE m.id=NEW.monitor_id AND m.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'cross-workspace listening monitor') END;
      END;
      CREATE TRIGGER IF NOT EXISTS trg_listening_monitor_identity_immutable BEFORE UPDATE OF id,workspace_id,monitor_type,created_by_user_id,created_at ON listening_monitors BEGIN SELECT RAISE(ABORT,'listening monitor identity is immutable'); END;
      CREATE TRIGGER IF NOT EXISTS trg_listening_run_workspace_insert BEFORE INSERT ON listening_collection_runs BEGIN
        SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM listening_monitor_versions v WHERE v.id=NEW.monitor_version_id AND v.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'cross-workspace listening monitor version') END;
      END;
      CREATE TRIGGER IF NOT EXISTS trg_listening_run_workspace_update BEFORE UPDATE OF workspace_id,monitor_version_id ON listening_collection_runs BEGIN
        SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM listening_monitor_versions v WHERE v.id=NEW.monitor_version_id AND v.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'cross-workspace listening monitor version') END;
      END;
      CREATE TRIGGER IF NOT EXISTS trg_listening_record_workspace_insert BEFORE INSERT ON canonical_listening_records BEGIN
        SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM listening_monitor_versions v WHERE v.id=NEW.monitor_version_id AND v.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'cross-workspace listening monitor version') END;
        SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM listening_collection_runs r WHERE r.id=NEW.collection_run_id AND r.workspace_id=NEW.workspace_id AND r.monitor_version_id=NEW.monitor_version_id) THEN RAISE(ABORT,'cross-workspace listening collection run') END;
      END;
      CREATE TRIGGER IF NOT EXISTS trg_listening_link_workspace_insert BEFORE INSERT ON listening_record_event_links BEGIN
        SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM canonical_listening_records r WHERE r.id=NEW.listening_record_id AND r.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'cross-workspace listening record') END;
        SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM business_events e WHERE e.id=NEW.business_event_id AND e.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'cross-workspace listening event') END;
      END;
      CREATE TRIGGER IF NOT EXISTS trg_listening_versions_immutable_update BEFORE UPDATE ON listening_monitor_versions BEGIN SELECT RAISE(ABORT,'listening monitor versions are immutable'); END;
      CREATE TRIGGER IF NOT EXISTS trg_listening_versions_immutable_delete BEFORE DELETE ON listening_monitor_versions BEGIN SELECT RAISE(ABORT,'listening monitor versions are immutable'); END;
      CREATE TRIGGER IF NOT EXISTS trg_listening_records_immutable_update BEFORE UPDATE ON canonical_listening_records BEGIN SELECT RAISE(ABORT,'listening records are immutable'); END;
      CREATE TRIGGER IF NOT EXISTS trg_listening_records_immutable_delete BEFORE DELETE ON canonical_listening_records BEGIN SELECT RAISE(ABORT,'listening records are immutable'); END;
      CREATE TRIGGER IF NOT EXISTS trg_listening_links_immutable_update BEFORE UPDATE ON listening_record_event_links BEGIN SELECT RAISE(ABORT,'listening event links are immutable'); END;
      CREATE TRIGGER IF NOT EXISTS trg_listening_links_immutable_delete BEFORE DELETE ON listening_record_event_links BEGIN SELECT RAISE(ABORT,'listening event links are immutable'); END;
      CREATE TRIGGER IF NOT EXISTS trg_listening_runs_terminal_update BEFORE UPDATE ON listening_collection_runs WHEN OLD.status IN ('COMPLETED','PARTIAL','RATE_LIMITED','FAILED') BEGIN SELECT RAISE(ABORT,'terminal listening runs are immutable'); END;
      CREATE TRIGGER IF NOT EXISTS trg_listening_runs_immutable_delete BEFORE DELETE ON listening_collection_runs BEGIN SELECT RAISE(ABORT,'listening runs are immutable'); END;
    `);
  },
};
