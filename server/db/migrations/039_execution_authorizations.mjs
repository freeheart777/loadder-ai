export const migration039ExecutionAuthorizations={version:39,name:"execution_authorizations",up(db){db.exec(`
CREATE TABLE IF NOT EXISTS execution_authorizations(
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL,
 action_proposal_id TEXT NOT NULL,
 proposal_hash TEXT NOT NULL CHECK(length(proposal_hash)=64 AND proposal_hash NOT GLOB '*[^0-9a-f]*'),
 authorization_policy TEXT NOT NULL CHECK(length(authorization_policy) BETWEEN 1 AND 200),
 authorization_policy_version INTEGER NOT NULL CHECK(authorization_policy_version>0),
 authorizer_user_id TEXT NOT NULL,
 authorizer_membership_id TEXT NOT NULL,
 authorizer_role TEXT NOT NULL CHECK(authorizer_role='owner'),
 acknowledgement_code TEXT NOT NULL CHECK(length(acknowledgement_code) BETWEEN 1 AND 200),
 confirmation_hash TEXT NOT NULL CHECK(length(confirmation_hash)=64 AND confirmation_hash NOT GLOB '*[^0-9a-f]*'),
 execution_authorizing INTEGER NOT NULL CHECK(execution_authorizing=1),
 authorized_at TEXT NOT NULL,
 expires_at TEXT NOT NULL CHECK(expires_at>authorized_at),
 operation_kind TEXT NOT NULL CHECK(operation_kind='authorization.create'),
 idempotency_key TEXT NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 200),
 request_hash TEXT NOT NULL CHECK(length(request_hash)=64 AND request_hash NOT GLOB '*[^0-9a-f]*'),
 created_at TEXT NOT NULL,
 FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
 FOREIGN KEY(action_proposal_id) REFERENCES action_proposals(id),
 FOREIGN KEY(authorizer_user_id) REFERENCES users(id),
 FOREIGN KEY(authorizer_membership_id) REFERENCES workspace_memberships(id),
 UNIQUE(workspace_id,authorizer_user_id,idempotency_key),
 UNIQUE(workspace_id,action_proposal_id,authorization_policy,authorization_policy_version)
);
CREATE INDEX IF NOT EXISTS idx_execution_authorizations_page ON execution_authorizations(workspace_id,action_proposal_id,authorized_at DESC,id DESC);
CREATE TRIGGER IF NOT EXISTS trg_execution_authorizations_insert_guard BEFORE INSERT ON execution_authorizations BEGIN
 SELECT CASE WHEN NOT EXISTS(
  SELECT 1 FROM action_proposals p WHERE p.id=NEW.action_proposal_id AND p.workspace_id=NEW.workspace_id
   AND p.proposal_hash=NEW.proposal_hash AND p.execution_eligible=1 AND p.executable=1
   AND p.requires_authorization=1 AND p.risk_class='LOW'
 ) THEN RAISE(ABORT,'authorization proposal identity or eligibility mismatch') END;
 SELECT CASE WHEN NOT EXISTS(
  SELECT 1 FROM workspace_memberships m WHERE m.id=NEW.authorizer_membership_id
   AND m.workspace_id=NEW.workspace_id AND m.user_id=NEW.authorizer_user_id
   AND m.status='active' AND m.role=NEW.authorizer_role AND m.role='owner'
 ) THEN RAISE(ABORT,'authorization membership mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_execution_authorizations_update BEFORE UPDATE ON execution_authorizations BEGIN SELECT RAISE(ABORT,'execution authorizations are immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_execution_authorizations_delete BEFORE DELETE ON execution_authorizations BEGIN SELECT RAISE(ABORT,'execution authorizations are immutable'); END;
`);}};
