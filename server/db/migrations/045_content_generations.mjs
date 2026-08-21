export const migration045ContentGenerations = {
  version: 45,
  name: "content_generations",
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS content_generations (
        id TEXT PRIMARY KEY CHECK(length(id) BETWEEN 1 AND 100),
        workspace_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        media_type TEXT NOT NULL CHECK(media_type IN ('TEXT','IMAGE','VIDEO')),
        contract_id TEXT NOT NULL CHECK(length(contract_id) BETWEEN 1 AND 100),
        contract_version INTEGER NOT NULL CHECK(contract_version > 0),
        placement_id TEXT NOT NULL CHECK(length(placement_id) BETWEEN 1 AND 100),
        placement_version INTEGER NOT NULL CHECK(placement_version > 0),
        context_version_id TEXT NOT NULL,
        template_version INTEGER NOT NULL CHECK(template_version > 0),
        provider_binding TEXT NOT NULL CHECK(length(provider_binding) BETWEEN 1 AND 100),
        provider_binding_version INTEGER NOT NULL CHECK(provider_binding_version > 0),
        provider_model TEXT NOT NULL CHECK(length(provider_model) BETWEEN 1 AND 120),
        brief_hash TEXT NOT NULL CHECK(length(brief_hash)=64 AND brief_hash NOT GLOB '*[^0-9a-f]*'),
        request_fingerprint TEXT NOT NULL CHECK(length(request_fingerprint)=64 AND request_fingerprint NOT GLOB '*[^0-9a-f]*'),
        operation_kind TEXT NOT NULL CHECK(operation_kind='content.generate'),
        idempotency_key TEXT NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 200),
        request_hash TEXT NOT NULL CHECK(length(request_hash)=64 AND request_hash NOT GLOB '*[^0-9a-f]*'),
        status TEXT NOT NULL CHECK(status IN ('SUCCEEDED','FAILED')),
        normalized_result_json TEXT CHECK(normalized_result_json IS NULL OR (json_valid(normalized_result_json) AND length(normalized_result_json)<=35000)),
        input_tokens INTEGER CHECK(input_tokens IS NULL OR input_tokens>=0),
        output_tokens INTEGER CHECK(output_tokens IS NULL OR output_tokens>=0),
        estimated_cost_minor INTEGER CHECK(estimated_cost_minor IS NULL OR estimated_cost_minor>=0),
        cost_currency TEXT CHECK(cost_currency IS NULL OR length(cost_currency) BETWEEN 3 AND 12),
        error_code TEXT CHECK(error_code IS NULL OR length(error_code) BETWEEN 1 AND 100),
        created_at TEXT NOT NULL CHECK(length(created_at) BETWEEN 20 AND 40),
        completed_at TEXT NOT NULL CHECK(length(completed_at) BETWEEN 20 AND 40),
        FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(context_version_id) REFERENCES business_context_versions(id),
        CHECK((status='SUCCEEDED' AND normalized_result_json IS NOT NULL AND error_code IS NULL) OR
              (status='FAILED' AND normalized_result_json IS NULL AND error_code IS NOT NULL))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uq_content_generations_idempotency
        ON content_generations(workspace_id,user_id,operation_kind,idempotency_key);
      CREATE INDEX IF NOT EXISTS idx_content_generations_workspace_history
        ON content_generations(workspace_id,created_at DESC,id DESC);
      CREATE TRIGGER IF NOT EXISTS trg_content_generations_insert_guard BEFORE INSERT ON content_generations BEGIN
        SELECT CASE WHEN NOT EXISTS(
          SELECT 1 FROM workspaces w JOIN workspace_memberships m ON m.workspace_id=w.id
          JOIN users u ON u.id=m.user_id
          WHERE w.id=NEW.workspace_id AND w.status='active' AND m.user_id=NEW.user_id
            AND m.status='active' AND u.status='active'
        ) THEN RAISE(ABORT,'content generation actor mismatch') END;
        SELECT CASE WHEN NOT EXISTS(
          SELECT 1 FROM business_context_versions c
          WHERE c.id=NEW.context_version_id AND c.workspace_id=NEW.workspace_id
        ) THEN RAISE(ABORT,'content generation context mismatch') END;
      END;
      CREATE TRIGGER IF NOT EXISTS trg_content_generations_update BEFORE UPDATE ON content_generations BEGIN
        SELECT RAISE(ABORT,'content generations are immutable');
      END;
      CREATE TRIGGER IF NOT EXISTS trg_content_generations_delete BEFORE DELETE ON content_generations BEGIN
        SELECT RAISE(ABORT,'content generations are immutable');
      END;
    `);
  },
};
