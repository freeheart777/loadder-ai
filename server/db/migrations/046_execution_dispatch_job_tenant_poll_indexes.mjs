export const migration046ExecutionDispatchJobTenantPollIndexes = {
  version: 46,
  name: "execution_dispatch_job_tenant_poll_indexes",
  up(db) {
    db.exec(`
      DROP INDEX IF EXISTS idx_execution_dispatch_jobs_pending;
      DROP INDEX IF EXISTS idx_execution_dispatch_jobs_expired;

      CREATE INDEX IF NOT EXISTS idx_execution_dispatch_jobs_pending
        ON execution_dispatch_jobs(workspace_id,job_kind,available_at,id)
        WHERE completed_at IS NULL
          AND blocked_reason_code IS NULL
          AND lease_token IS NULL;

      CREATE INDEX IF NOT EXISTS idx_execution_dispatch_jobs_expired
        ON execution_dispatch_jobs(workspace_id,job_kind,lease_expires_at,id)
        WHERE completed_at IS NULL
          AND blocked_reason_code IS NULL
          AND lease_token IS NOT NULL;
    `);
  },
};
