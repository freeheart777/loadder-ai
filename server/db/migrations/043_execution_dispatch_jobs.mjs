export const migration043ExecutionDispatchJobs={version:43,name:"execution_dispatch_jobs",up(db){db.exec(`
CREATE TABLE IF NOT EXISTS execution_dispatch_jobs(
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL,
 execution_request_id TEXT NOT NULL,
 execution_attempt_id TEXT,
 job_kind TEXT NOT NULL CHECK(job_kind IN('DISPATCH','RECONCILIATION')),
 job_generation INTEGER NOT NULL CHECK(job_generation>0),
 available_at TEXT NOT NULL,
 lease_owner TEXT CHECK(lease_owner IS NULL OR length(lease_owner) BETWEEN 1 AND 200),
 lease_token TEXT CHECK(lease_token IS NULL OR length(lease_token) BETWEEN 32 AND 200),
 lease_generation INTEGER NOT NULL DEFAULT 0 CHECK(lease_generation>=0),
 lease_expires_at TEXT,
 claimed_at TEXT,
 processing_attempts INTEGER NOT NULL DEFAULT 0 CHECK(processing_attempts>=0),
 last_scheduling_error_code TEXT CHECK(last_scheduling_error_code IS NULL OR(length(last_scheduling_error_code) BETWEEN 1 AND 100 AND last_scheduling_error_code NOT GLOB '*[^A-Z0-9_]*' AND last_scheduling_error_code GLOB '[A-Z]*')),
 completed_at TEXT,
 blocked_reason_code TEXT CHECK(blocked_reason_code IS NULL OR blocked_reason_code IN('MANUAL_INTERVENTION_REQUIRED','EXECUTION_UNAVAILABLE','UNKNOWN_UNRESOLVED','RECONCILIATION_UNAVAILABLE','POLICY_UNAVAILABLE')),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
 FOREIGN KEY(execution_request_id) REFERENCES execution_requests(id),
 FOREIGN KEY(execution_attempt_id) REFERENCES execution_attempts(id),
 CHECK((job_kind='DISPATCH' AND execution_attempt_id IS NULL) OR(job_kind='RECONCILIATION' AND execution_attempt_id IS NOT NULL)),
 CHECK(NOT(completed_at IS NOT NULL AND blocked_reason_code IS NOT NULL)),
 CHECK((lease_owner IS NULL AND lease_token IS NULL AND lease_expires_at IS NULL AND claimed_at IS NULL) OR(lease_owner IS NOT NULL AND lease_token IS NOT NULL AND lease_expires_at IS NOT NULL AND claimed_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_execution_dispatch_jobs_dispatch ON execution_dispatch_jobs(workspace_id,execution_request_id,job_kind,job_generation) WHERE job_kind='DISPATCH';
CREATE UNIQUE INDEX IF NOT EXISTS uq_execution_dispatch_jobs_reconciliation ON execution_dispatch_jobs(workspace_id,execution_attempt_id,job_kind,job_generation) WHERE execution_attempt_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_execution_dispatch_jobs_pending ON execution_dispatch_jobs(job_kind,available_at,id) WHERE completed_at IS NULL AND blocked_reason_code IS NULL AND lease_token IS NULL;
CREATE INDEX IF NOT EXISTS idx_execution_dispatch_jobs_expired ON execution_dispatch_jobs(job_kind,lease_expires_at,id) WHERE completed_at IS NULL AND blocked_reason_code IS NULL AND lease_token IS NOT NULL;
CREATE TRIGGER IF NOT EXISTS trg_execution_dispatch_jobs_insert_guard BEFORE INSERT ON execution_dispatch_jobs BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM execution_requests r WHERE r.id=NEW.execution_request_id AND r.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'dispatch job request lineage mismatch') END;
 SELECT CASE WHEN NEW.job_kind='RECONCILIATION' AND NOT EXISTS(SELECT 1 FROM execution_attempts a WHERE a.id=NEW.execution_attempt_id AND a.workspace_id=NEW.workspace_id AND a.execution_request_id=NEW.execution_request_id) THEN RAISE(ABORT,'dispatch job attempt lineage mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_execution_dispatch_jobs_identity_immutable BEFORE UPDATE ON execution_dispatch_jobs WHEN
 NEW.id!=OLD.id OR NEW.workspace_id!=OLD.workspace_id OR NEW.execution_request_id!=OLD.execution_request_id OR NEW.execution_attempt_id IS NOT OLD.execution_attempt_id OR NEW.job_kind!=OLD.job_kind OR NEW.job_generation!=OLD.job_generation OR NEW.created_at!=OLD.created_at
BEGIN SELECT RAISE(ABORT,'dispatch job identity is immutable'); END;
`);}};
