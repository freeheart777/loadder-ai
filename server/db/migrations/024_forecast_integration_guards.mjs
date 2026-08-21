export const migration024ForecastIntegrationGuards={version:24,name:"forecast_integration_guards",up(db){db.exec(`
CREATE TRIGGER IF NOT EXISTS trg_forecast_integrity BEFORE INSERT ON forecast_records WHEN NOT EXISTS(
 SELECT 1 FROM model_input_snapshots s WHERE s.id=NEW.model_input_snapshot_id AND s.workspace_id=NEW.workspace_id AND s.context_version_id=NEW.context_version_id
 AND s.subject_type=NEW.subject_type AND s.subject_id=NEW.subject_id AND s.status='ready') BEGIN SELECT RAISE(ABORT,'invalid Forecast input');END;
CREATE TRIGGER IF NOT EXISTS trg_forecast_update BEFORE UPDATE ON forecast_records BEGIN SELECT RAISE(ABORT,'Forecasts are immutable');END;
CREATE TRIGGER IF NOT EXISTS trg_forecast_delete BEFORE DELETE ON forecast_records BEGIN SELECT RAISE(ABORT,'Forecasts cannot be deleted');END;
CREATE TRIGGER IF NOT EXISTS trg_import_record_integrity BEFORE INSERT ON canonical_import_records WHEN NOT EXISTS(
 SELECT 1 FROM import_batches b WHERE b.id=NEW.batch_id AND b.workspace_id=NEW.workspace_id AND b.connection_id=NEW.connection_id) BEGIN SELECT RAISE(ABORT,'invalid import provenance');END;
CREATE TRIGGER IF NOT EXISTS trg_import_record_update BEFORE UPDATE ON canonical_import_records BEGIN SELECT RAISE(ABORT,'Imported facts are immutable');END;
CREATE TRIGGER IF NOT EXISTS trg_import_record_delete BEFORE DELETE ON canonical_import_records BEGIN SELECT RAISE(ABORT,'Imported facts cannot be deleted');END;
CREATE TRIGGER IF NOT EXISTS trg_artifact_version_integrity BEFORE INSERT ON knowledge_artifact_versions WHEN NOT EXISTS(
 SELECT 1 FROM knowledge_artifacts a WHERE a.id=NEW.artifact_id AND a.workspace_id=NEW.workspace_id) BEGIN SELECT RAISE(ABORT,'invalid artifact ownership');END;
CREATE TRIGGER IF NOT EXISTS trg_artifact_version_update BEFORE UPDATE ON knowledge_artifact_versions BEGIN SELECT RAISE(ABORT,'Artifact versions are immutable');END;
CREATE TRIGGER IF NOT EXISTS trg_artifact_version_delete BEFORE DELETE ON knowledge_artifact_versions BEGIN SELECT RAISE(ABORT,'Artifact versions cannot be deleted');END;
CREATE TRIGGER IF NOT EXISTS trg_kpi_measurement_integrity BEFORE INSERT ON kpi_measurements WHEN NOT EXISTS(
 SELECT 1 FROM kpi_definitions k WHERE k.id=NEW.kpi_definition_id AND k.workspace_id=NEW.workspace_id) OR (NEW.context_version_id IS NOT NULL AND NOT EXISTS(
 SELECT 1 FROM business_context_versions c WHERE c.id=NEW.context_version_id AND c.workspace_id=NEW.workspace_id)) BEGIN SELECT RAISE(ABORT,'invalid KPI provenance');END;
CREATE TRIGGER IF NOT EXISTS trg_kpi_measurement_update BEFORE UPDATE ON kpi_measurements BEGIN SELECT RAISE(ABORT,'KPI measurements are immutable');END;
CREATE TRIGGER IF NOT EXISTS trg_kpi_definition_update BEFORE UPDATE ON kpi_definitions BEGIN SELECT RAISE(ABORT,'KPI definitions are versioned and immutable');END;
CREATE TRIGGER IF NOT EXISTS trg_kpi_definition_delete BEFORE DELETE ON kpi_definitions BEGIN SELECT RAISE(ABORT,'KPI definitions cannot be deleted');END;
CREATE TRIGGER IF NOT EXISTS trg_kpi_measurement_delete BEFORE DELETE ON kpi_measurements BEGIN SELECT RAISE(ABORT,'KPI measurements cannot be deleted');END;`);}};
