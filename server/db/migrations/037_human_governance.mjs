export const migration037HumanGovernance = { version: 37, name: "human_governance", up(db) { db.exec(`
CREATE TABLE IF NOT EXISTS recommendation_reviews(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  recommendation_id TEXT NOT NULL,
  reviewer_user_id TEXT NOT NULL,
  reviewer_membership_id TEXT NOT NULL,
  reviewer_role TEXT NOT NULL CHECK(reviewer_role IN('owner','admin','member')),
  review_type TEXT NOT NULL CHECK(review_type IN('ACKNOWLEDGED','DISMISSED','REQUEST_MORE_EVIDENCE')),
  operation_kind TEXT NOT NULL CHECK(operation_kind='review.create'),
  idempotency_key TEXT NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 200),
  request_hash TEXT NOT NULL CHECK(length(request_hash)=64),
  reviewed_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(recommendation_id) REFERENCES intelligence_recommendations(id),
  FOREIGN KEY(reviewer_user_id) REFERENCES users(id),
  FOREIGN KEY(reviewer_membership_id) REFERENCES workspace_memberships(id),
  UNIQUE(workspace_id,reviewer_user_id,operation_kind,idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_recommendation_reviews_page ON recommendation_reviews(workspace_id,recommendation_id,reviewed_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_recommendation_reviews_actor ON recommendation_reviews(workspace_id,reviewer_user_id,reviewed_at DESC,id DESC);

CREATE TABLE IF NOT EXISTS decision_records(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  recommendation_id TEXT NOT NULL,
  recommendation_version INTEGER NOT NULL CHECK(recommendation_version>0),
  context_version_id TEXT NOT NULL,
  decider_user_id TEXT NOT NULL,
  decider_membership_id TEXT NOT NULL,
  decider_role TEXT NOT NULL CHECK(decider_role IN('owner','admin')),
  decision_type TEXT NOT NULL CHECK(decision_type IN('ADOPT','DECLINE','DEFER')),
  authority_class TEXT NOT NULL CHECK(authority_class='BUSINESS_INTENT'),
  execution_authorizing INTEGER NOT NULL CHECK(execution_authorizing=0),
  observed_freshness TEXT NOT NULL CHECK(observed_freshness IN('CURRENT','SUPERSEDED','STALE_CONTEXT')),
  supersedes_decision_id TEXT,
  operation_kind TEXT NOT NULL CHECK(operation_kind='decision.create'),
  idempotency_key TEXT NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 200),
  request_hash TEXT NOT NULL CHECK(length(request_hash)=64),
  decided_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(recommendation_id) REFERENCES intelligence_recommendations(id),
  FOREIGN KEY(context_version_id) REFERENCES business_context_versions(id),
  FOREIGN KEY(decider_user_id) REFERENCES users(id),
  FOREIGN KEY(decider_membership_id) REFERENCES workspace_memberships(id),
  FOREIGN KEY(supersedes_decision_id) REFERENCES decision_records(id),
  UNIQUE(workspace_id,decider_user_id,operation_kind,idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_decision_records_page ON decision_records(workspace_id,recommendation_id,decided_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_decision_records_actor ON decision_records(workspace_id,decider_user_id,decided_at DESC,id DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_decision_records_one_successor ON decision_records(supersedes_decision_id) WHERE supersedes_decision_id IS NOT NULL;

CREATE TRIGGER IF NOT EXISTS trg_recommendation_reviews_insert_guard BEFORE INSERT ON recommendation_reviews BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM intelligence_recommendations r WHERE r.id=NEW.recommendation_id AND r.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'review recommendation workspace mismatch') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM workspace_memberships m WHERE m.id=NEW.reviewer_membership_id AND m.workspace_id=NEW.workspace_id AND m.user_id=NEW.reviewer_user_id AND m.status='active' AND m.role=NEW.reviewer_role AND m.role IN('owner','admin','member')) THEN RAISE(ABORT,'review membership authorization mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_recommendation_reviews_update BEFORE UPDATE ON recommendation_reviews BEGIN SELECT RAISE(ABORT,'recommendation reviews are immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_recommendation_reviews_delete BEFORE DELETE ON recommendation_reviews BEGIN SELECT RAISE(ABORT,'recommendation reviews are immutable'); END;

CREATE TRIGGER IF NOT EXISTS trg_decision_records_insert_guard BEFORE INSERT ON decision_records BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM intelligence_recommendations r WHERE r.id=NEW.recommendation_id AND r.workspace_id=NEW.workspace_id AND r.recommendation_version=NEW.recommendation_version AND r.context_version_id=NEW.context_version_id) THEN RAISE(ABORT,'decision recommendation identity mismatch') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM workspace_memberships m WHERE m.id=NEW.decider_membership_id AND m.workspace_id=NEW.workspace_id AND m.user_id=NEW.decider_user_id AND m.status='active' AND m.role=NEW.decider_role AND m.role IN('owner','admin')) THEN RAISE(ABORT,'decision membership authorization mismatch') END;
  SELECT CASE WHEN NEW.supersedes_decision_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM decision_records d WHERE d.id=NEW.supersedes_decision_id AND d.workspace_id=NEW.workspace_id AND d.recommendation_id=NEW.recommendation_id) THEN RAISE(ABORT,'superseded decision identity mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_decision_records_update BEFORE UPDATE ON decision_records BEGIN SELECT RAISE(ABORT,'decision records are immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_decision_records_delete BEFORE DELETE ON decision_records BEGIN SELECT RAISE(ABORT,'decision records are immutable'); END;
`); } };
