export const migration042ExecutionAttemptResultLedger={version:42,name:"execution_attempt_result_ledger",up(db){db.exec(`
CREATE TABLE IF NOT EXISTS execution_attempts(
 id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,execution_request_id TEXT NOT NULL,
 attempt_number INTEGER NOT NULL CHECK(attempt_number>0),dispatch_claim_key TEXT NOT NULL CHECK(length(dispatch_claim_key)=64 AND dispatch_claim_key NOT GLOB '*[^0-9a-f]*'),
 request_fingerprint TEXT NOT NULL CHECK(length(request_fingerprint)=64 AND request_fingerprint NOT GLOB '*[^0-9a-f]*'),
 provider_capability TEXT NOT NULL CHECK(length(provider_capability) BETWEEN 1 AND 200),provider_capability_version INTEGER NOT NULL CHECK(provider_capability_version>0),
 provider_connection_id TEXT NOT NULL,provider_account_identity_id TEXT NOT NULL,
 provider_idempotency_key TEXT NOT NULL CHECK(length(provider_idempotency_key)=64 AND provider_idempotency_key NOT GLOB '*[^0-9a-f]*'),
 attempt_policy TEXT NOT NULL CHECK(length(attempt_policy) BETWEEN 1 AND 200),attempt_policy_version INTEGER NOT NULL CHECK(attempt_policy_version>0),
 dispatch_kind TEXT NOT NULL CHECK(dispatch_kind IN('INITIAL','RETRY')),started_at TEXT NOT NULL,timeout_at TEXT NOT NULL CHECK(timeout_at>started_at),created_at TEXT NOT NULL,
 FOREIGN KEY(workspace_id) REFERENCES workspaces(id),FOREIGN KEY(execution_request_id) REFERENCES execution_requests(id),FOREIGN KEY(provider_account_identity_id) REFERENCES provider_account_identities(id),
 UNIQUE(workspace_id,execution_request_id,attempt_number),UNIQUE(workspace_id,execution_request_id,dispatch_claim_key)
);
CREATE INDEX IF NOT EXISTS idx_execution_attempts_request_page ON execution_attempts(workspace_id,execution_request_id,started_at DESC,id DESC);
CREATE TRIGGER IF NOT EXISTS trg_execution_attempts_insert_guard BEFORE INSERT ON execution_attempts BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM execution_requests r JOIN provider_account_identities i ON i.id=NEW.provider_account_identity_id WHERE r.id=NEW.execution_request_id AND r.workspace_id=NEW.workspace_id AND r.request_fingerprint=NEW.request_fingerprint AND r.provider_capability=NEW.provider_capability AND r.provider_connection_id=NEW.provider_connection_id AND r.provider_account_identity=NEW.provider_account_identity_id AND i.workspace_id=NEW.workspace_id AND i.connection_id=r.provider_connection_id AND NEW.started_at<r.request_expires_at AND NEW.timeout_at<=r.request_expires_at AND NEW.timeout_at<=r.authorization_expires_at) THEN RAISE(ABORT,'execution attempt lineage mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_execution_attempts_update BEFORE UPDATE ON execution_attempts BEGIN SELECT RAISE(ABORT,'execution attempts are immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_execution_attempts_delete BEFORE DELETE ON execution_attempts BEGIN SELECT RAISE(ABORT,'execution attempts are immutable'); END;

CREATE TABLE IF NOT EXISTS provider_invocation_events(
 id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,execution_request_id TEXT NOT NULL,execution_attempt_id TEXT NOT NULL,
 event_kind TEXT NOT NULL CHECK(event_kind='INVOCATION_COMMITTED'),provider_capability TEXT NOT NULL,provider_capability_version INTEGER NOT NULL CHECK(provider_capability_version>0),
 provider_account_identity_id TEXT NOT NULL,provider_idempotency_key TEXT NOT NULL CHECK(length(provider_idempotency_key)=64 AND provider_idempotency_key NOT GLOB '*[^0-9a-f]*'),committed_at TEXT NOT NULL,created_at TEXT NOT NULL,
 FOREIGN KEY(workspace_id) REFERENCES workspaces(id),FOREIGN KEY(execution_request_id) REFERENCES execution_requests(id),FOREIGN KEY(execution_attempt_id) REFERENCES execution_attempts(id),FOREIGN KEY(provider_account_identity_id) REFERENCES provider_account_identities(id),UNIQUE(workspace_id,execution_attempt_id)
);
CREATE INDEX IF NOT EXISTS idx_provider_invocation_events_request ON provider_invocation_events(workspace_id,execution_request_id,committed_at DESC,id DESC);
CREATE TRIGGER IF NOT EXISTS trg_provider_invocation_events_insert_guard BEFORE INSERT ON provider_invocation_events BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM execution_attempts a WHERE a.id=NEW.execution_attempt_id AND a.workspace_id=NEW.workspace_id AND a.execution_request_id=NEW.execution_request_id AND a.provider_capability=NEW.provider_capability AND a.provider_capability_version=NEW.provider_capability_version AND a.provider_account_identity_id=NEW.provider_account_identity_id AND a.provider_idempotency_key=NEW.provider_idempotency_key) THEN RAISE(ABORT,'provider invocation lineage mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_provider_invocation_events_update BEFORE UPDATE ON provider_invocation_events BEGIN SELECT RAISE(ABORT,'provider invocation events are immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_provider_invocation_events_delete BEFORE DELETE ON provider_invocation_events BEGIN SELECT RAISE(ABORT,'provider invocation events are immutable'); END;

CREATE TABLE IF NOT EXISTS execution_results(
 id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,execution_request_id TEXT NOT NULL,execution_attempt_id TEXT NOT NULL,
 observation_kind TEXT NOT NULL CHECK(observation_kind IN('DISPATCH','RECONCILIATION')),result_type TEXT NOT NULL CHECK(result_type IN('SUCCEEDED','FAILED','UNKNOWN','REJECTED_BEFORE_EXECUTION')),
 normalized_result_code TEXT NOT NULL CHECK(length(normalized_result_code) BETWEEN 1 AND 200),provider_reference_hash TEXT CHECK(provider_reference_hash IS NULL OR(length(provider_reference_hash)=64 AND provider_reference_hash NOT GLOB '*[^0-9a-f]*')),
 response_hash TEXT CHECK(response_hash IS NULL OR(length(response_hash)=64 AND response_hash NOT GLOB '*[^0-9a-f]*')),observed_at TEXT NOT NULL,result_hash TEXT NOT NULL CHECK(length(result_hash)=64 AND result_hash NOT GLOB '*[^0-9a-f]*'),created_at TEXT NOT NULL,
 FOREIGN KEY(workspace_id) REFERENCES workspaces(id),FOREIGN KEY(execution_request_id) REFERENCES execution_requests(id),FOREIGN KEY(execution_attempt_id) REFERENCES execution_attempts(id),UNIQUE(workspace_id,result_hash)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_execution_results_dispatch ON execution_results(workspace_id,execution_attempt_id) WHERE observation_kind='DISPATCH';
CREATE INDEX IF NOT EXISTS idx_execution_results_attempt_page ON execution_results(workspace_id,execution_attempt_id,observed_at DESC,id DESC);
CREATE TRIGGER IF NOT EXISTS trg_execution_results_insert_guard BEFORE INSERT ON execution_results BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM execution_attempts a WHERE a.id=NEW.execution_attempt_id AND a.workspace_id=NEW.workspace_id AND a.execution_request_id=NEW.execution_request_id) THEN RAISE(ABORT,'execution result lineage mismatch') END;
 SELECT CASE WHEN NEW.result_type='REJECTED_BEFORE_EXECUTION' AND(NEW.observation_kind!='DISPATCH' OR EXISTS(SELECT 1 FROM provider_invocation_events v WHERE v.workspace_id=NEW.workspace_id AND v.execution_attempt_id=NEW.execution_attempt_id)) THEN RAISE(ABORT,'rejected result invocation mismatch') END;
 SELECT CASE WHEN NEW.result_type!='REJECTED_BEFORE_EXECUTION' AND NOT EXISTS(SELECT 1 FROM provider_invocation_events v WHERE v.workspace_id=NEW.workspace_id AND v.execution_attempt_id=NEW.execution_attempt_id) THEN RAISE(ABORT,'execution result requires invocation') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM execution_results r WHERE r.workspace_id=NEW.workspace_id AND r.execution_attempt_id=NEW.execution_attempt_id AND r.result_type='SUCCEEDED') THEN RAISE(ABORT,'execution success is terminal') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_execution_results_update BEFORE UPDATE ON execution_results BEGIN SELECT RAISE(ABORT,'execution results are immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_execution_results_delete BEFORE DELETE ON execution_results BEGIN SELECT RAISE(ABORT,'execution results are immutable'); END;
`);}};
