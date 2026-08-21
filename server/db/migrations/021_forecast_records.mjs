export const migration021ForecastRecords={version:21,name:"forecast_records",up(db){db.exec(`
CREATE TABLE IF NOT EXISTS forecast_records(
 id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,forecast_specification_id TEXT NOT NULL,forecast_specification_version INTEGER NOT NULL CHECK(forecast_specification_version>0),
 model_input_snapshot_id TEXT NOT NULL,context_version_id TEXT NOT NULL,subject_type TEXT NOT NULL,subject_id TEXT NOT NULL,target_name TEXT NOT NULL,
 target_type TEXT NOT NULL CHECK(target_type IN('numeric','probability','categorical')),prediction_horizon INTEGER NOT NULL CHECK(prediction_horizon>0),horizon_unit TEXT NOT NULL,
 forecast_origin TEXT NOT NULL,forecast_for TEXT NOT NULL,output_schema_version TEXT NOT NULL,point_estimate REAL,lower_bound REAL,upper_bound REAL,probability REAL CHECK(probability BETWEEN 0 AND 1),
 predicted_class TEXT,class_probabilities_json TEXT,uncertainty_json TEXT NOT NULL,forecasting_method_id TEXT NOT NULL,forecasting_method_version TEXT NOT NULL,
 producer_key TEXT NOT NULL,provenance_json TEXT NOT NULL,created_at TEXT NOT NULL,
 UNIQUE(workspace_id,forecasting_method_id,forecasting_method_version,producer_key),FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
 FOREIGN KEY(model_input_snapshot_id) REFERENCES model_input_snapshots(id),FOREIGN KEY(context_version_id) REFERENCES business_context_versions(id),
 CHECK(forecast_for>forecast_origin),CHECK(json_valid(uncertainty_json)),CHECK(json_valid(provenance_json)),CHECK(class_probabilities_json IS NULL OR json_valid(class_probabilities_json)),
 CHECK((target_type='numeric' AND point_estimate IS NOT NULL AND probability IS NULL AND predicted_class IS NULL) OR
 (target_type='probability' AND point_estimate IS NULL AND probability IS NOT NULL AND predicted_class IS NULL) OR
 (target_type='categorical' AND point_estimate IS NULL AND probability IS NULL AND predicted_class IS NOT NULL AND class_probabilities_json IS NOT NULL)));
CREATE INDEX IF NOT EXISTS idx_forecasts_workspace_spec_subject ON forecast_records(workspace_id,forecast_specification_id,subject_type,subject_id,forecast_origin DESC);
CREATE INDEX IF NOT EXISTS idx_forecasts_input ON forecast_records(model_input_snapshot_id);CREATE INDEX IF NOT EXISTS idx_forecasts_context ON forecast_records(context_version_id);
CREATE INDEX IF NOT EXISTS idx_forecasts_target ON forecast_records(workspace_id,target_name,forecast_for);`);}};
