export const migration015IntelligenceDataGuards = {
  version: 15,
  name: "intelligence_data_guards",
  up(db) {
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS trg_business_events_workspace_references
      BEFORE INSERT ON business_events
      WHEN (NEW.customer_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM customers WHERE id=NEW.customer_id AND workspace_id=NEW.workspace_id
      )) OR (NEW.campaign_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM marketing_campaigns WHERE id=NEW.campaign_id AND workspace_id=NEW.workspace_id
      )) OR (NEW.context_version_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM business_context_versions WHERE id=NEW.context_version_id AND workspace_id=NEW.workspace_id
      ))
      BEGIN
        SELECT RAISE(ABORT, 'cross-workspace Business Event reference');
      END;

      CREATE TRIGGER IF NOT EXISTS trg_business_events_immutable_update
      BEFORE UPDATE ON business_events
      BEGIN SELECT RAISE(ABORT, 'Business Events are immutable'); END;
      CREATE TRIGGER IF NOT EXISTS trg_business_events_immutable_delete
      BEFORE DELETE ON business_events
      BEGIN SELECT RAISE(ABORT, 'Business Events are append-only'); END;

      CREATE TRIGGER IF NOT EXISTS trg_observations_workspace_sources
      BEFORE INSERT ON normalized_observations
      WHEN NOT EXISTS (
        SELECT 1 FROM business_context_versions
        WHERE id=NEW.context_version_id AND workspace_id=NEW.workspace_id
      ) OR EXISTS (
        SELECT 1 FROM json_each(NEW.source_manifest_json, '$.eventIds') source
        WHERE NOT EXISTS (
          SELECT 1 FROM business_events event
          WHERE event.id=source.value AND event.workspace_id=NEW.workspace_id
        )
      ) OR json_array_length(NEW.source_manifest_json, '$.eventIds') <> NEW.source_event_count
      BEGIN
        SELECT RAISE(ABORT, 'invalid or cross-workspace Observation provenance');
      END;

      CREATE TRIGGER IF NOT EXISTS trg_observations_immutable_update
      BEFORE UPDATE ON normalized_observations
      BEGIN SELECT RAISE(ABORT, 'Normalized Observations are immutable'); END;
      CREATE TRIGGER IF NOT EXISTS trg_observations_immutable_delete
      BEFORE DELETE ON normalized_observations
      BEGIN SELECT RAISE(ABORT, 'Normalized Observations are append-only'); END;

      CREATE TRIGGER IF NOT EXISTS trg_signals_workspace_sources
      BEFORE INSERT ON derived_signals
      WHEN NOT EXISTS (
        SELECT 1 FROM business_context_versions
        WHERE id=NEW.context_version_id AND workspace_id=NEW.workspace_id
      ) OR EXISTS (
        SELECT 1 FROM json_each(NEW.source_observation_ids) source
        WHERE NOT EXISTS (
          SELECT 1 FROM normalized_observations observation
          WHERE observation.id=source.value
            AND observation.workspace_id=NEW.workspace_id
            AND observation.context_version_id=NEW.context_version_id
        )
      ) OR json_array_length(NEW.source_observation_ids) < 1
      BEGIN
        SELECT RAISE(ABORT, 'invalid or cross-workspace Signal provenance');
      END;

      CREATE TRIGGER IF NOT EXISTS trg_signals_immutable_content
      BEFORE UPDATE OF workspace_id,signal_type,signal_version,subject_type,subject_id,
        context_version_id,state,score,confidence,severity,observed_at,valid_until,
        producer,producer_version,producer_key,source_observation_ids,provenance_json,created_at
      ON derived_signals
      BEGIN SELECT RAISE(ABORT, 'Derived Signal content is immutable'); END;

      CREATE TRIGGER IF NOT EXISTS trg_signals_lifecycle_forward
      BEFORE UPDATE OF lifecycle_status ON derived_signals
      WHEN OLD.lifecycle_status <> NEW.lifecycle_status AND (
        OLD.lifecycle_status IN ('expired','superseded') OR
        (OLD.lifecycle_status='active' AND NEW.lifecycle_status NOT IN ('expired','superseded'))
      )
      BEGIN SELECT RAISE(ABORT, 'Signal lifecycle cannot move backward'); END;
    `);
  },
};
