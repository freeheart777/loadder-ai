export const migration084GrowthCopilotRuns = {
  version: 84,
  name: 'growth_copilot_runs',
  up(db) {
    db.exec(`
CREATE TABLE IF NOT EXISTS growth_copilot_runs (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL REFERENCES workspaces(id),
 actor_id TEXT NOT NULL REFERENCES users(id),
 contract_version INTEGER NOT NULL CHECK(contract_version=1),
 mode TEXT NOT NULL CHECK(mode='COPILOT'),
 capability TEXT NOT NULL CHECK(capability IN('READ_GROWTH_CONTEXT','READ_APPROVED_TREATMENT','READ_CRM_OUTCOME_EVIDENCE','PREPARE_NEXT_EXPERIMENT_DRAFT')),
 experiment_id TEXT NOT NULL REFERENCES experiments(id),
 context_version_id TEXT NOT NULL REFERENCES business_context_versions(id),
 goal_ref TEXT NOT NULL CHECK(length(goal_ref) BETWEEN 1 AND 200),
 candidate_id TEXT REFERENCES growth_content_candidates(id),
 idempotency_key TEXT NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 200),
 input_hash TEXT NOT NULL CHECK(length(input_hash)=64),
 input_refs_json TEXT NOT NULL CHECK(json_valid(input_refs_json) AND length(input_refs_json)<=2048),
 result_json TEXT NOT NULL CHECK(json_valid(result_json) AND length(result_json)<=16384),
 status TEXT NOT NULL CHECK(status IN('PREPARED','SUCCEEDED')),
 error_code TEXT CHECK(error_code IS NULL),
 created_at TEXT NOT NULL,
 completed_at TEXT NOT NULL CHECK(completed_at>=created_at),
 UNIQUE(workspace_id,idempotency_key),
 CHECK((capability='PREPARE_NEXT_EXPERIMENT_DRAFT' AND status='PREPARED') OR (capability<>'PREPARE_NEXT_EXPERIMENT_DRAFT' AND status='SUCCEEDED')),
 CHECK(capability='READ_GROWTH_CONTEXT' OR candidate_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_growth_copilot_page ON growth_copilot_runs(workspace_id,created_at DESC,id DESC);
CREATE TRIGGER IF NOT EXISTS trg_growth_copilot_insert BEFORE INSERT ON growth_copilot_runs BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM workspace_memberships WHERE workspace_id=NEW.workspace_id AND user_id=NEW.actor_id AND status='active' AND role IN('owner','admin')) THEN RAISE(ABORT,'copilot actor denied') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM experiments e JOIN business_context_versions c ON c.id=e.goal_context_version_id AND c.workspace_id=e.workspace_id WHERE e.id=NEW.experiment_id AND e.workspace_id=NEW.workspace_id AND e.goal_contract_version=1 AND e.goal_context_version_id=NEW.context_version_id AND e.goal_ref=NEW.goal_ref AND c.status='active') THEN RAISE(ABORT,'copilot context mismatch') END;
 SELECT CASE WHEN NEW.candidate_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM growth_content_candidates c JOIN growth_content_briefs b ON b.id=c.brief_id AND b.workspace_id=c.workspace_id WHERE c.id=NEW.candidate_id AND c.workspace_id=NEW.workspace_id AND c.state='APPROVED' AND b.experiment_id=NEW.experiment_id AND b.goal_context_version_id=NEW.context_version_id AND b.goal_ref=NEW.goal_ref) THEN RAISE(ABORT,'copilot treatment mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_growth_copilot_update BEFORE UPDATE ON growth_copilot_runs BEGIN SELECT RAISE(ABORT,'Copilot receipt immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_growth_copilot_delete BEFORE DELETE ON growth_copilot_runs BEGIN SELECT RAISE(ABORT,'Copilot receipt append-only'); END;
`);
  },
};
