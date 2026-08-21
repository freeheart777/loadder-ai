export const migration017FeatureValueGuards = {
  version: 17,
  name: "feature_value_guards",
  up(db) {
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS trg_feature_values_source_integrity
      BEFORE INSERT ON feature_values
      WHEN NOT EXISTS (
        SELECT 1 FROM business_context_versions context
        WHERE context.id=NEW.context_version_id AND context.workspace_id=NEW.workspace_id
      ) OR (
        json_array_length(NEW.source_observation_ids_json) +
        json_array_length(NEW.source_signal_ids_json)
      ) < 1 OR EXISTS (
        SELECT 1 FROM json_each(NEW.source_observation_ids_json) source
        WHERE NOT EXISTS (
          SELECT 1 FROM normalized_observations observation
          WHERE observation.id=source.value
            AND observation.workspace_id=NEW.workspace_id
            AND observation.context_version_id=NEW.context_version_id
            AND observation.subject_type=NEW.subject_type
            AND observation.subject_id=NEW.subject_id
        )
      ) OR EXISTS (
        SELECT 1 FROM json_each(NEW.source_signal_ids_json) source
        WHERE NOT EXISTS (
          SELECT 1 FROM derived_signals signal
          WHERE signal.id=source.value
            AND signal.workspace_id=NEW.workspace_id
            AND signal.context_version_id=NEW.context_version_id
            AND signal.subject_type=NEW.subject_type
            AND signal.subject_id=NEW.subject_id
        )
      )
      BEGIN
        SELECT RAISE(ABORT, 'invalid or cross-workspace Feature provenance');
      END;

      CREATE TRIGGER IF NOT EXISTS trg_feature_values_immutable_update
      BEFORE UPDATE ON feature_values
      BEGIN SELECT RAISE(ABORT, 'Feature Values are immutable'); END;

      CREATE TRIGGER IF NOT EXISTS trg_feature_values_immutable_delete
      BEFORE DELETE ON feature_values
      BEGIN SELECT RAISE(ABORT, 'Feature Values cannot be deleted'); END;
    `);
  },
};
