export const migration038ActionProposals = { version: 38, name: "action_proposals", up(db) { db.exec(`
CREATE TABLE IF NOT EXISTS action_proposals(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  decision_id TEXT NOT NULL,
  recommendation_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  action_version INTEGER NOT NULL CHECK(action_version>0),
  schema_version INTEGER NOT NULL CHECK(schema_version>0),
  subject_type TEXT NOT NULL,
  subject_id TEXT,
  subject_key TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_key TEXT NOT NULL,
  context_version_id TEXT NOT NULL,
  point_in_time_cutoff TEXT NOT NULL,
  risk_class TEXT NOT NULL CHECK(risk_class='NON_EXECUTING'),
  execution_eligible INTEGER NOT NULL CHECK(execution_eligible=0),
  executable INTEGER NOT NULL CHECK(executable=0),
  requires_authorization INTEGER NOT NULL CHECK(requires_authorization=1),
  producer TEXT NOT NULL,
  producer_version TEXT NOT NULL,
  producer_key TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  created_by_membership_id TEXT NOT NULL,
  created_by_role TEXT NOT NULL CHECK(created_by_role IN('owner','admin')),
  operation_kind TEXT NOT NULL CHECK(operation_kind='action_proposal.create'),
  idempotency_key TEXT NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 200),
  request_hash TEXT NOT NULL CHECK(length(request_hash)=64),
  input_manifest_hash TEXT NOT NULL CHECK(length(input_manifest_hash)=64),
  proposal_hash TEXT NOT NULL CHECK(length(proposal_hash)=64),
  created_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(decision_id) REFERENCES decision_records(id),
  FOREIGN KEY(recommendation_id) REFERENCES intelligence_recommendations(id),
  FOREIGN KEY(context_version_id) REFERENCES business_context_versions(id),
  FOREIGN KEY(created_by_user_id) REFERENCES users(id),
  FOREIGN KEY(created_by_membership_id) REFERENCES workspace_memberships(id),
  UNIQUE(workspace_id,created_by_user_id,idempotency_key),
  UNIQUE(workspace_id,producer,producer_version,producer_key)
);
CREATE INDEX IF NOT EXISTS idx_action_proposals_page ON action_proposals(workspace_id,created_at DESC,id DESC);

CREATE TRIGGER IF NOT EXISTS trg_action_proposals_insert_guard BEFORE INSERT ON action_proposals BEGIN
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM decision_records d
    JOIN intelligence_recommendations r ON r.id=d.recommendation_id
    WHERE d.id=NEW.decision_id AND d.workspace_id=NEW.workspace_id
      AND d.decision_type='ADOPT' AND d.execution_authorizing=0
      AND r.id=NEW.recommendation_id AND r.workspace_id=NEW.workspace_id
      AND r.context_version_id=NEW.context_version_id
      AND r.subject_type=NEW.subject_type AND r.subject_id IS NEW.subject_id
      AND r.subject_key=NEW.subject_key AND r.point_in_time_cutoff=NEW.point_in_time_cutoff
  ) THEN RAISE(ABORT,'action proposal governance identity mismatch') END;
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM workspace_memberships m
    WHERE m.id=NEW.created_by_membership_id AND m.workspace_id=NEW.workspace_id
      AND m.user_id=NEW.created_by_user_id AND m.status='active'
      AND m.role=NEW.created_by_role AND m.role IN('owner','admin')
  ) THEN RAISE(ABORT,'action proposal membership authorization mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_action_proposals_update BEFORE UPDATE ON action_proposals BEGIN SELECT RAISE(ABORT,'action proposals are immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_action_proposals_delete BEFORE DELETE ON action_proposals BEGIN SELECT RAISE(ABORT,'action proposals are immutable'); END;
`); } };
