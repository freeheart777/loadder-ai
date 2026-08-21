export const migration040ExecutionRequests={version:40,name:"execution_requests",up(db){db.exec(`
CREATE TABLE IF NOT EXISTS execution_requests(
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL,
 execution_authorization_id TEXT NOT NULL,
 authorization_confirmation_hash TEXT NOT NULL CHECK(length(authorization_confirmation_hash)=64 AND authorization_confirmation_hash NOT GLOB '*[^0-9a-f]*'),
 authorization_policy TEXT NOT NULL CHECK(length(authorization_policy) BETWEEN 1 AND 200),
 authorization_policy_version INTEGER NOT NULL CHECK(authorization_policy_version>0),
 authorization_expires_at TEXT NOT NULL,
 action_proposal_id TEXT NOT NULL,
 proposal_hash TEXT NOT NULL CHECK(length(proposal_hash)=64 AND proposal_hash NOT GLOB '*[^0-9a-f]*'),
 action_type TEXT NOT NULL CHECK(length(action_type) BETWEEN 1 AND 200),
 action_version INTEGER NOT NULL CHECK(action_version>0),
 target_type TEXT NOT NULL CHECK(length(target_type) BETWEEN 1 AND 200),
 target_id TEXT CHECK(target_id IS NULL OR length(target_id) BETWEEN 1 AND 200),
 parameters_hash TEXT NOT NULL CHECK(length(parameters_hash)=64 AND parameters_hash NOT GLOB '*[^0-9a-f]*'),
 provider_capability TEXT NOT NULL CHECK(length(provider_capability) BETWEEN 1 AND 200),
 provider_connection_id TEXT NOT NULL CHECK(length(provider_connection_id) BETWEEN 1 AND 200),
 provider_account_identity TEXT NOT NULL CHECK(length(provider_account_identity) BETWEEN 1 AND 200),
 risk_class TEXT NOT NULL CHECK(length(risk_class) BETWEEN 1 AND 100),
 request_policy TEXT NOT NULL CHECK(length(request_policy) BETWEEN 1 AND 200),
 request_policy_version INTEGER NOT NULL CHECK(request_policy_version>0),
 request_fingerprint TEXT NOT NULL CHECK(length(request_fingerprint)=64 AND request_fingerprint NOT GLOB '*[^0-9a-f]*'),
 requested_by_user_id TEXT NOT NULL,
 requested_by_membership_id TEXT NOT NULL,
 requested_by_role TEXT NOT NULL CHECK(requested_by_role='owner'),
 operation_kind TEXT NOT NULL CHECK(operation_kind='execution_request.create'),
 idempotency_key TEXT NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 200),
 request_hash TEXT NOT NULL CHECK(length(request_hash)=64 AND request_hash NOT GLOB '*[^0-9a-f]*'),
 requested_at TEXT NOT NULL,
 request_expires_at TEXT NOT NULL CHECK(request_expires_at>requested_at AND request_expires_at<=authorization_expires_at),
 created_at TEXT NOT NULL,
 FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
 FOREIGN KEY(execution_authorization_id) REFERENCES execution_authorizations(id),
 FOREIGN KEY(action_proposal_id) REFERENCES action_proposals(id),
 FOREIGN KEY(requested_by_user_id) REFERENCES users(id),
 FOREIGN KEY(requested_by_membership_id) REFERENCES workspace_memberships(id),
 FOREIGN KEY(workspace_id,provider_connection_id) REFERENCES connector_connections(workspace_id,id),
 UNIQUE(workspace_id,execution_authorization_id),
 UNIQUE(workspace_id,requested_by_user_id,operation_kind,idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_execution_requests_page ON execution_requests(workspace_id,requested_at DESC,id DESC);
CREATE TRIGGER IF NOT EXISTS trg_execution_requests_insert_guard BEFORE INSERT ON execution_requests BEGIN
 SELECT CASE WHEN NOT EXISTS(
  SELECT 1 FROM execution_authorizations a JOIN action_proposals p ON p.id=a.action_proposal_id
  WHERE a.id=NEW.execution_authorization_id AND a.workspace_id=NEW.workspace_id AND a.execution_authorizing=1
   AND a.action_proposal_id=NEW.action_proposal_id AND a.proposal_hash=NEW.proposal_hash
   AND a.confirmation_hash=NEW.authorization_confirmation_hash
   AND a.authorization_policy=NEW.authorization_policy AND a.authorization_policy_version=NEW.authorization_policy_version
   AND a.expires_at=NEW.authorization_expires_at
   AND p.workspace_id=NEW.workspace_id AND p.proposal_hash=NEW.proposal_hash
   AND p.action_type=NEW.action_type AND p.action_version=NEW.action_version
   AND p.target_type=NEW.target_type AND p.target_key IS NEW.target_id
   AND p.risk_class=NEW.risk_class AND p.execution_eligible=1 AND p.executable=1 AND p.requires_authorization=1
 ) THEN RAISE(ABORT,'execution request authorization or proposal mismatch') END;
 SELECT CASE WHEN NOT EXISTS(
  SELECT 1 FROM workspace_memberships m WHERE m.id=NEW.requested_by_membership_id
   AND m.workspace_id=NEW.workspace_id AND m.user_id=NEW.requested_by_user_id
   AND m.status='active' AND m.role=NEW.requested_by_role AND m.role='owner'
 ) THEN RAISE(ABORT,'execution request membership mismatch') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM connector_connections c WHERE c.id=NEW.provider_connection_id AND c.workspace_id=NEW.workspace_id)
  THEN RAISE(ABORT,'execution request provider connection mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_execution_requests_update BEFORE UPDATE ON execution_requests BEGIN SELECT RAISE(ABORT,'execution requests are immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_execution_requests_delete BEFORE DELETE ON execution_requests BEGIN SELECT RAISE(ABORT,'execution requests are immutable'); END;
`);}};
