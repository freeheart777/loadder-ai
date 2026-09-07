export const migration082GrowthContent = {
  version: 82,
  name: 'growth_content',
  up(db) {
    db.transaction(() => db.exec(`
CREATE TABLE IF NOT EXISTS growth_content_briefs(
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id),
 experiment_id TEXT NOT NULL REFERENCES experiments(id),
 goal_context_version_id TEXT NOT NULL REFERENCES business_context_versions(id), goal_ref TEXT NOT NULL,
 version INTEGER NOT NULL CHECK(version>0), predecessor_id TEXT REFERENCES growth_content_briefs(id),
 contract_json TEXT NOT NULL CHECK(json_valid(contract_json)), provenance_json TEXT NOT NULL CHECK(json_valid(provenance_json)),
 created_by TEXT NOT NULL, created_at TEXT NOT NULL,
 payload_hash TEXT NOT NULL CHECK(length(payload_hash)=64), idempotency_key TEXT NOT NULL,
 UNIQUE(workspace_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_growth_brief_page ON growth_content_briefs(workspace_id,experiment_id,created_at,id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_growth_brief_successor ON growth_content_briefs(predecessor_id) WHERE predecessor_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS growth_content_candidates(
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), brief_id TEXT NOT NULL REFERENCES growth_content_briefs(id),
 predecessor_id TEXT REFERENCES growth_content_candidates(id),
 input_hash TEXT NOT NULL CHECK(length(input_hash)=64), input_json TEXT NOT NULL CHECK(json_valid(input_json)),
 idempotency_key TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN('PENDING','VALIDATED','PROVIDER_FAILED','VALIDATION_FAILED','RECONCILIATION_REQUIRED','APPROVED','REJECTED')),
 body TEXT, provider TEXT, model TEXT, usage_json TEXT CHECK(usage_json IS NULL OR json_valid(usage_json)),
 validation_code TEXT, decided_by TEXT, decided_at TEXT,
 UNIQUE(workspace_id,idempotency_key),
 CHECK((state IN('VALIDATED','APPROVED','REJECTED') AND length(body) BETWEEN 1 AND 12000 AND provider IS NOT NULL AND model IS NOT NULL AND validation_code='PASS') OR
       (state IN('PENDING','PROVIDER_FAILED','VALIDATION_FAILED','RECONCILIATION_REQUIRED') AND body IS NULL)),
 CHECK((state IN('APPROVED','REJECTED') AND decided_by IS NOT NULL AND decided_at IS NOT NULL) OR
       (state NOT IN('APPROVED','REJECTED') AND decided_by IS NULL AND decided_at IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_growth_candidate_page ON growth_content_candidates(workspace_id,brief_id,created_at,id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_growth_candidate_successor ON growth_content_candidates(predecessor_id) WHERE predecessor_id IS NOT NULL;
CREATE TRIGGER IF NOT EXISTS trg_growth_brief_insert BEFORE INSERT ON growth_content_briefs BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM experiments e JOIN business_context_versions c ON c.id=e.goal_context_version_id AND c.workspace_id=e.workspace_id WHERE e.id=NEW.experiment_id AND e.workspace_id=NEW.workspace_id AND e.goal_contract_version=1 AND e.goal_context_version_id=NEW.goal_context_version_id AND e.goal_ref=NEW.goal_ref AND c.status='active') THEN RAISE(ABORT,'growth brief context mismatch') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM workspace_memberships WHERE workspace_id=NEW.workspace_id AND user_id=NEW.created_by AND status='active' AND role IN('owner','admin')) THEN RAISE(ABORT,'growth brief author denied') END;
 SELECT CASE WHEN (NEW.predecessor_id IS NULL AND NEW.version<>1) OR (NEW.predecessor_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM growth_content_briefs WHERE id=NEW.predecessor_id AND workspace_id=NEW.workspace_id AND experiment_id=NEW.experiment_id AND goal_context_version_id=NEW.goal_context_version_id AND goal_ref=NEW.goal_ref AND version+1=NEW.version AND created_at<=NEW.created_at)) THEN RAISE(ABORT,'growth brief predecessor mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_growth_brief_update BEFORE UPDATE ON growth_content_briefs BEGIN SELECT RAISE(ABORT,'Growth brief immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_growth_brief_delete BEFORE DELETE ON growth_content_briefs BEGIN SELECT RAISE(ABORT,'Growth brief append-only'); END;
CREATE TRIGGER IF NOT EXISTS trg_growth_candidate_insert BEFORE INSERT ON growth_content_candidates BEGIN
 SELECT CASE WHEN NEW.state<>'PENDING' OR NOT EXISTS(SELECT 1 FROM growth_content_briefs WHERE id=NEW.brief_id AND workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'growth candidate brief mismatch') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM workspace_memberships WHERE workspace_id=NEW.workspace_id AND user_id=NEW.created_by AND status='active' AND role IN('owner','admin')) THEN RAISE(ABORT,'growth candidate author denied') END;
 SELECT CASE WHEN NEW.predecessor_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM growth_content_candidates WHERE id=NEW.predecessor_id AND workspace_id=NEW.workspace_id AND brief_id=NEW.brief_id AND state IN('VALIDATED','APPROVED','REJECTED') AND created_at<=NEW.created_at) THEN RAISE(ABORT,'growth candidate predecessor mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_growth_candidate_update BEFORE UPDATE ON growth_content_candidates BEGIN
 SELECT CASE WHEN NEW.id IS NOT OLD.id OR NEW.workspace_id IS NOT OLD.workspace_id OR NEW.brief_id IS NOT OLD.brief_id OR NEW.predecessor_id IS NOT OLD.predecessor_id OR NEW.input_hash IS NOT OLD.input_hash OR NEW.input_json IS NOT OLD.input_json OR NEW.idempotency_key IS NOT OLD.idempotency_key OR NEW.created_by IS NOT OLD.created_by OR NEW.created_at IS NOT OLD.created_at OR NEW.updated_at<OLD.updated_at THEN RAISE(ABORT,'Growth candidate identity immutable') END;
 SELECT CASE WHEN NOT ((OLD.state='PENDING' AND NEW.state IN('VALIDATED','PROVIDER_FAILED','VALIDATION_FAILED','RECONCILIATION_REQUIRED')) OR (OLD.state='VALIDATED' AND NEW.state IN('APPROVED','REJECTED'))) THEN RAISE(ABORT,'Growth candidate transition forbidden') END;
 SELECT CASE WHEN OLD.state='VALIDATED' AND (NEW.body IS NOT OLD.body OR NEW.provider IS NOT OLD.provider OR NEW.model IS NOT OLD.model OR NEW.usage_json IS NOT OLD.usage_json OR NEW.validation_code IS NOT OLD.validation_code) THEN RAISE(ABORT,'Growth candidate content immutable') END;
 SELECT CASE WHEN NEW.state IN('APPROVED','REJECTED') AND (NEW.decided_at<OLD.updated_at OR NOT EXISTS(SELECT 1 FROM workspace_memberships WHERE workspace_id=NEW.workspace_id AND user_id=NEW.decided_by AND status='active' AND role IN('owner','admin'))) THEN RAISE(ABORT,'Growth candidate decision denied') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_growth_candidate_delete BEFORE DELETE ON growth_content_candidates BEGIN SELECT RAISE(ABORT,'Growth candidate append-only'); END;
`)).immediate();
  },
};
