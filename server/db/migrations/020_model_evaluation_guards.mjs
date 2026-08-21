export const migration020ModelEvaluationGuards = {
  version: 20,
  name: "model_evaluation_guards",
  up(db) {
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS trg_model_inputs_integrity
      BEFORE INSERT ON model_input_snapshots
      WHEN NOT EXISTS (
        SELECT 1 FROM business_context_versions context
        WHERE context.id=NEW.context_version_id AND context.workspace_id=NEW.workspace_id
      ) OR EXISTS (
        SELECT 1 FROM json_each(NEW.feature_manifest_json) manifest
        WHERE json_extract(manifest.value, '$.featureValueId') IS NULL
           OR NOT EXISTS (
             SELECT 1 FROM feature_values feature
             WHERE feature.id=json_extract(manifest.value, '$.featureValueId')
               AND feature.workspace_id=NEW.workspace_id
               AND feature.context_version_id=NEW.context_version_id
               AND feature.subject_type=NEW.subject_type
               AND feature.subject_id=NEW.subject_id
               AND feature.feature_name=json_extract(manifest.value, '$.featureName')
               AND feature.feature_version=json_extract(manifest.value, '$.featureVersion')
           )
      )
      BEGIN SELECT RAISE(ABORT, 'invalid or cross-workspace Model Input provenance'); END;

      CREATE TRIGGER IF NOT EXISTS trg_model_inputs_immutable_update
      BEFORE UPDATE ON model_input_snapshots
      BEGIN SELECT RAISE(ABORT, 'Model Input Snapshots are immutable'); END;
      CREATE TRIGGER IF NOT EXISTS trg_model_inputs_immutable_delete
      BEFORE DELETE ON model_input_snapshots
      BEGIN SELECT RAISE(ABORT, 'Model Input Snapshots cannot be deleted'); END;

      CREATE TRIGGER IF NOT EXISTS trg_evaluations_integrity
      BEFORE INSERT ON evaluations
      WHEN NOT EXISTS (
        SELECT 1 FROM model_input_snapshots snapshot
        WHERE snapshot.id=NEW.input_snapshot_id
          AND snapshot.workspace_id=NEW.workspace_id
          AND snapshot.context_version_id=NEW.context_version_id
          AND snapshot.specification_id=NEW.specification_id
          AND snapshot.specification_version=NEW.specification_version
          AND snapshot.status='ready'
      )
      BEGIN SELECT RAISE(ABORT, 'invalid or cross-workspace Evaluation input'); END;

      CREATE TRIGGER IF NOT EXISTS trg_evaluations_immutable_update
      BEFORE UPDATE ON evaluations
      BEGIN SELECT RAISE(ABORT, 'Evaluations are immutable'); END;
      CREATE TRIGGER IF NOT EXISTS trg_evaluations_immutable_delete
      BEFORE DELETE ON evaluations
      BEGIN SELECT RAISE(ABORT, 'Evaluations cannot be deleted'); END;
    `);
  },
};
