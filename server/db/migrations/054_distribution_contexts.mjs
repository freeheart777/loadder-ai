export const migration054DistributionContexts={version:54,name:"distribution_contexts",up(db){db.exec(`
  CREATE TABLE IF NOT EXISTS distribution_contexts(
    id TEXT PRIMARY KEY CHECK(length(id) BETWEEN 1 AND 100),
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    creative_placement_id TEXT NOT NULL REFERENCES creative_placements(id),
    channel_id TEXT NOT NULL CHECK(length(channel_id) BETWEEN 1 AND 80 AND channel_id NOT GLOB '*[^a-z0-9_]*'),
    channel_version INTEGER NOT NULL CHECK(channel_version>0),
    provider TEXT NOT NULL CHECK(length(provider) BETWEEN 1 AND 80 AND provider NOT GLOB '*[^a-z0-9._-]*'),
    acquisition_mode TEXT NOT NULL CHECK(acquisition_mode IN('PAID','ORGANIC','OWNED','EARNED','REFERRAL','DIRECT')),
    destination_reference TEXT NOT NULL CHECK(length(destination_reference) BETWEEN 1 AND 500 AND destination_reference NOT LIKE '%?%' AND destination_reference NOT LIKE '%#%'),
    tracking_contract_version INTEGER NOT NULL CHECK(tracking_contract_version>0),
    created_by_user_id TEXT NOT NULL REFERENCES users(id),
    operation_kind TEXT NOT NULL CHECK(operation_kind='distribution_context.create'),
    idempotency_key TEXT NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 200),
    request_hash TEXT NOT NULL CHECK(length(request_hash)=64 AND request_hash NOT GLOB '*[^0-9a-f]*'),
    created_at TEXT NOT NULL CHECK(length(created_at) BETWEEN 20 AND 40)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS uq_distribution_contexts_idempotency ON distribution_contexts(workspace_id,created_by_user_id,operation_kind,idempotency_key);
  CREATE INDEX IF NOT EXISTS idx_distribution_contexts_placement_history ON distribution_contexts(workspace_id,creative_placement_id,created_at DESC,id DESC);
  CREATE TRIGGER IF NOT EXISTS trg_distribution_contexts_insert_guard BEFORE INSERT ON distribution_contexts BEGIN
    SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM workspaces WHERE id=NEW.workspace_id AND status='active') THEN RAISE(ABORT,'distribution context workspace must be active') END;
    SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.created_by_user_id AND status='active') THEN RAISE(ABORT,'distribution context user must be active') END;
    SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM workspace_memberships WHERE workspace_id=NEW.workspace_id AND user_id=NEW.created_by_user_id AND status='active') THEN RAISE(ABORT,'distribution context membership must be active') END;
    SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM creative_placements WHERE id=NEW.creative_placement_id AND workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'distribution context placement mismatch') END;
  END;
  CREATE TRIGGER IF NOT EXISTS trg_distribution_contexts_update_reject BEFORE UPDATE ON distribution_contexts BEGIN SELECT RAISE(ABORT,'distribution contexts are immutable'); END;
  CREATE TRIGGER IF NOT EXISTS trg_distribution_contexts_delete_reject BEFORE DELETE ON distribution_contexts BEGIN SELECT RAISE(ABORT,'distribution contexts are immutable'); END;
`);}};
