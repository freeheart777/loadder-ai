export const migration081ExperimentGoalContract = {
  version: 81, name: "experiment_goal_contract",
  up(db) {
    const columns = new Set(db.prepare("PRAGMA table_info(experiments)").all().map(c => c.name));
    for (const [name, type] of Object.entries({ goal_contract_version: "INTEGER", goal_context_version_id: "TEXT REFERENCES business_context_versions(id)", goal_ref: "TEXT", goal_contract_json: "TEXT", supersedes_experiment_id: "TEXT REFERENCES experiments(id)" })) {
      if (!columns.has(name)) db.exec(`ALTER TABLE experiments ADD COLUMN ${name} ${type}`);
    }
    db.exec(`
CREATE INDEX IF NOT EXISTS idx_experiments_goal ON experiments(workspace_id,goal_context_version_id,goal_ref);
CREATE UNIQUE INDEX IF NOT EXISTS idx_experiments_successor ON experiments(supersedes_experiment_id) WHERE supersedes_experiment_id IS NOT NULL;
CREATE TRIGGER IF NOT EXISTS trg_experiment_goal_insert BEFORE INSERT ON experiments BEGIN
 SELECT CASE WHEN NOT ((NEW.goal_contract_version IS NULL AND NEW.goal_context_version_id IS NULL AND NEW.goal_ref IS NULL AND NEW.goal_contract_json IS NULL AND NEW.supersedes_experiment_id IS NULL) OR (NEW.goal_contract_version IS 1 AND NEW.goal_context_version_id IS NOT NULL AND NEW.goal_context_version_id IS NEW.context_version_id AND NEW.goal_ref IS NOT NULL AND NEW.goal_contract_json IS NOT NULL)) THEN RAISE(ABORT,'incomplete experiment goal contract') END;
 SELECT CASE WHEN NEW.goal_contract_version IS NOT NULL AND NOT json_valid(NEW.goal_contract_json) THEN RAISE(ABORT,'invalid experiment goal JSON') END;
 SELECT CASE WHEN NEW.goal_contract_version IS NOT NULL AND NOT EXISTS(SELECT 1 FROM business_context_versions WHERE id=NEW.goal_context_version_id AND workspace_id=NEW.workspace_id AND status='active') THEN RAISE(ABORT,'experiment goal context mismatch') END;
 SELECT CASE WHEN NEW.goal_contract_version IS NOT NULL AND (substr(NEW.goal_ref,1,16)<>'/strategy/goals/' OR length(NEW.goal_ref) NOT BETWEEN 17 AND 20 OR CAST(CAST(substr(NEW.goal_ref,17) AS INTEGER) AS TEXT)<>substr(NEW.goal_ref,17) OR NOT EXISTS(SELECT 1 FROM business_context_versions c WHERE c.id=NEW.goal_context_version_id AND c.workspace_id=NEW.workspace_id AND json_type(c.snapshot_json,'$.strategy.goals['||substr(NEW.goal_ref,17)||']')='text' AND length(trim(json_extract(c.snapshot_json,'$.strategy.goals['||substr(NEW.goal_ref,17)||']')))>0)) THEN RAISE(ABORT,'experiment goal reference invalid') END;
 SELECT CASE WHEN NEW.goal_contract_version IS NOT NULL AND (json_extract(NEW.goal_contract_json,'$.metric') IS NOT NEW.success_metric OR json_extract(NEW.goal_contract_json,'$.measurementWindow.start') IS NOT NEW.starts_at OR json_extract(NEW.goal_contract_json,'$.measurementWindow.end') IS NOT NEW.ends_at OR json_extract(NEW.goal_contract_json,'$.baseline.value') IS NOT NEW.baseline_value) THEN RAISE(ABORT,'experiment measurement linkage mismatch') END;
 SELECT CASE WHEN NEW.goal_contract_version IS NOT NULL AND NOT EXISTS(SELECT 1 FROM decision_records d WHERE d.id=NEW.decision_id AND d.workspace_id=NEW.workspace_id AND d.context_version_id=NEW.context_version_id AND d.decision_type='ADOPT' AND NOT EXISTS(SELECT 1 FROM decision_records s WHERE s.supersedes_decision_id=d.id)) THEN RAISE(ABORT,'experiment goal decision invalid') END;
 SELECT CASE WHEN NEW.supersedes_experiment_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM experiments e WHERE e.id=NEW.supersedes_experiment_id AND e.workspace_id=NEW.workspace_id AND e.goal_contract_version=1 AND e.goal_context_version_id=NEW.goal_context_version_id AND e.goal_ref=NEW.goal_ref AND e.created_at<=NEW.created_at) THEN RAISE(ABORT,'experiment goal predecessor mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_experiment_goal_update BEFORE UPDATE ON experiments BEGIN
 SELECT CASE WHEN OLD.goal_contract_version IS NOT NEW.goal_contract_version OR OLD.goal_context_version_id IS NOT NEW.goal_context_version_id OR OLD.goal_ref IS NOT NEW.goal_ref OR OLD.goal_contract_json IS NOT NEW.goal_contract_json OR OLD.supersedes_experiment_id IS NOT NEW.supersedes_experiment_id OR (OLD.goal_contract_version IS NOT NULL AND (OLD.hypothesis IS NOT NEW.hypothesis OR OLD.objective IS NOT NEW.objective OR OLD.treatment_definition IS NOT NEW.treatment_definition OR OLD.success_metric IS NOT NEW.success_metric OR OLD.baseline_value IS NOT NEW.baseline_value OR OLD.starts_at IS NOT NEW.starts_at OR OLD.ends_at IS NOT NEW.ends_at OR OLD.created_at IS NOT NEW.created_at)) THEN RAISE(ABORT,'authored experiment is immutable') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_experiment_goal_delete BEFORE DELETE ON experiments WHEN OLD.goal_contract_version IS NOT NULL BEGIN SELECT RAISE(ABORT,'authored experiment history is append-only'); END;
`);
  },
};
