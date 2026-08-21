export const providerAccountIdentitiesMigration = {
  version: 41,
  name: "provider_account_identities",
  up(db) {
    db.exec(`
CREATE TABLE IF NOT EXISTS provider_account_identities(
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL,
 connection_id TEXT NOT NULL,
 connector_id TEXT NOT NULL,
 connector_version INTEGER NOT NULL CHECK(connector_version>0),
 provider_kind TEXT NOT NULL CHECK(length(provider_kind) BETWEEN 1 AND 100),
 external_account_type TEXT NOT NULL CHECK(length(external_account_type) BETWEEN 1 AND 100),
 external_account_key_hash TEXT NOT NULL CHECK(length(external_account_key_hash)=64 AND external_account_key_hash NOT GLOB '*[^0-9a-f]*'),
 external_parent_tenant_key_hash TEXT CHECK(external_parent_tenant_key_hash IS NULL OR(length(external_parent_tenant_key_hash)=64 AND external_parent_tenant_key_hash NOT GLOB '*[^0-9a-f]*')),
 external_account_scope_hash TEXT CHECK(external_account_scope_hash IS NULL OR(length(external_account_scope_hash)=64 AND external_account_scope_hash NOT GLOB '*[^0-9a-f]*')),
 safe_display_label TEXT CHECK(safe_display_label IS NULL OR length(safe_display_label) BETWEEN 1 AND 200),
 identity_version INTEGER NOT NULL CHECK(identity_version>0),
 verification_method TEXT NOT NULL CHECK(verification_method IN('PROVIDER_SELF_ENDPOINT','OAUTH_IDENTITY_CLAIM','SIGNED_PROVIDER_METADATA','SANDBOX_ACCOUNT_VERIFICATION')),
 verification_version INTEGER NOT NULL CHECK(verification_version>0),
 verification_evidence_hash TEXT CHECK(verification_evidence_hash IS NULL OR(length(verification_evidence_hash)=64 AND verification_evidence_hash NOT GLOB '*[^0-9a-f]*')),
 verified_by_user_id TEXT NOT NULL,
 verified_by_membership_id TEXT NOT NULL,
 verified_by_role TEXT NOT NULL CHECK(verified_by_role IN('owner','admin')),
 operation_kind TEXT NOT NULL CHECK(operation_kind='provider_identity.verify'),
 idempotency_key TEXT NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 200),
 request_hash TEXT NOT NULL CHECK(length(request_hash)=64 AND request_hash NOT GLOB '*[^0-9a-f]*'),
 verified_at TEXT NOT NULL,
 created_at TEXT NOT NULL,
 FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
 FOREIGN KEY(workspace_id,connection_id) REFERENCES connector_connections(workspace_id,id),
 FOREIGN KEY(verified_by_user_id) REFERENCES users(id),
 FOREIGN KEY(verified_by_membership_id) REFERENCES workspace_memberships(id),
 UNIQUE(workspace_id,verified_by_user_id,operation_kind,idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_provider_account_identities_connection_page ON provider_account_identities(workspace_id,connection_id,verified_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_provider_account_identities_account_page ON provider_account_identities(workspace_id,provider_kind,external_account_type,external_account_key_hash,verified_at DESC,id DESC);
CREATE TRIGGER IF NOT EXISTS trg_provider_account_identities_insert_guard BEFORE INSERT ON provider_account_identities BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM connector_connections c WHERE c.id=NEW.connection_id AND c.workspace_id=NEW.workspace_id AND c.connector_id=NEW.connector_id AND c.connector_version=NEW.connector_version)
  THEN RAISE(ABORT,'provider identity connection mismatch') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM users u WHERE u.id=NEW.verified_by_user_id)
  THEN RAISE(ABORT,'provider identity user mismatch') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM workspace_memberships m WHERE m.id=NEW.verified_by_membership_id AND m.workspace_id=NEW.workspace_id AND m.user_id=NEW.verified_by_user_id AND m.status='active' AND m.role=NEW.verified_by_role AND m.role IN('owner','admin'))
  THEN RAISE(ABORT,'provider identity membership mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_provider_account_identities_update BEFORE UPDATE ON provider_account_identities BEGIN SELECT RAISE(ABORT,'provider account identities are immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_provider_account_identities_delete BEFORE DELETE ON provider_account_identities BEGIN SELECT RAISE(ABORT,'provider account identities are immutable'); END;
`);
  },
};
