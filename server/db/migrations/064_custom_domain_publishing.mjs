export const migration064CustomDomainPublishing = { version: 64, name: "custom_domain_publishing", up(db) { db.exec(`
CREATE TABLE IF NOT EXISTS custom_domains(
 id TEXT PRIMARY KEY CHECK(length(id) BETWEEN 1 AND 100), workspace_id TEXT NOT NULL REFERENCES workspaces(id), created_by_user_id TEXT NOT NULL REFERENCES users(id),
 hostname TEXT NOT NULL CHECK(length(hostname) BETWEEN 3 AND 253 AND hostname=lower(hostname)), status TEXT NOT NULL CHECK(status IN('PENDING_VERIFICATION','VERIFIED','ACTIVE','FAILED','DISABLED')),
 verification_method TEXT NOT NULL CHECK(verification_method='DNS_TXT'), verification_record_name TEXT NOT NULL CHECK(length(verification_record_name)<=253), verification_token TEXT NOT NULL CHECK(length(verification_token) BETWEEN 32 AND 200),
 verified_at TEXT, last_checked_at TEXT, tls_status TEXT NOT NULL CHECK(tls_status IN('UNKNOWN','PENDING','READY','FAILED')), disabled_at TEXT,
 idempotency_key TEXT NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 200), request_hash TEXT NOT NULL CHECK(length(request_hash)=64), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_custom_domains_hostname ON custom_domains(hostname);
CREATE UNIQUE INDEX IF NOT EXISTS uq_custom_domains_create ON custom_domains(workspace_id,created_by_user_id,idempotency_key);
CREATE INDEX IF NOT EXISTS idx_custom_domains_history ON custom_domains(workspace_id,updated_at DESC,id DESC);
CREATE TRIGGER IF NOT EXISTS trg_custom_domains_insert_guard BEFORE INSERT ON custom_domains BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM workspace_memberships WHERE workspace_id=NEW.workspace_id AND user_id=NEW.created_by_user_id AND status='active') THEN RAISE(ABORT,'domain membership inactive') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_custom_domains_identity_guard BEFORE UPDATE ON custom_domains WHEN NEW.id IS NOT OLD.id OR NEW.workspace_id IS NOT OLD.workspace_id OR NEW.created_by_user_id IS NOT OLD.created_by_user_id OR NEW.hostname IS NOT OLD.hostname OR NEW.verification_method IS NOT OLD.verification_method OR NEW.verification_record_name IS NOT OLD.verification_record_name OR NEW.created_at IS NOT OLD.created_at BEGIN SELECT RAISE(ABORT,'domain identity immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_custom_domains_delete_reject BEFORE DELETE ON custom_domains BEGIN SELECT RAISE(ABORT,'domains cannot be deleted'); END;

CREATE TABLE IF NOT EXISTS public_domain_bindings(
 id TEXT PRIMARY KEY CHECK(length(id) BETWEEN 1 AND 100), workspace_id TEXT NOT NULL REFERENCES workspaces(id), custom_domain_id TEXT NOT NULL REFERENCES custom_domains(id), created_by_user_id TEXT NOT NULL REFERENCES users(id),
 target_type TEXT NOT NULL CHECK(target_type IN('WEBSITE','LANDING','STOREFRONT')), target_id TEXT NOT NULL CHECK(length(target_id) BETWEEN 1 AND 100), base_path TEXT NOT NULL CHECK(length(base_path) BETWEEN 1 AND 200 AND substr(base_path,1,1)='/'),
 status TEXT NOT NULL CHECK(status IN('INACTIVE','ACTIVE','DISABLED')), current_activation_id TEXT REFERENCES public_binding_activations(id), canonical INTEGER NOT NULL CHECK(canonical IN(0,1)), revision INTEGER NOT NULL CHECK(revision>0), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_public_domain_binding_path ON public_domain_bindings(custom_domain_id,base_path);
CREATE UNIQUE INDEX IF NOT EXISTS uq_public_domain_binding_target ON public_domain_bindings(workspace_id,target_type,target_id,custom_domain_id,base_path);
CREATE INDEX IF NOT EXISTS idx_public_domain_bindings_workspace ON public_domain_bindings(workspace_id,updated_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_public_domain_bindings_route ON public_domain_bindings(custom_domain_id,status,base_path);
CREATE TRIGGER IF NOT EXISTS trg_public_domain_bindings_insert_guard BEFORE INSERT ON public_domain_bindings BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM custom_domains d WHERE d.id=NEW.custom_domain_id AND d.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'binding domain mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_public_domain_bindings_identity_guard BEFORE UPDATE ON public_domain_bindings WHEN NEW.id IS NOT OLD.id OR NEW.workspace_id IS NOT OLD.workspace_id OR NEW.custom_domain_id IS NOT OLD.custom_domain_id OR NEW.target_type IS NOT OLD.target_type OR NEW.target_id IS NOT OLD.target_id OR NEW.base_path IS NOT OLD.base_path OR NEW.created_at IS NOT OLD.created_at BEGIN SELECT RAISE(ABORT,'binding identity immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_public_domain_bindings_delete_reject BEFORE DELETE ON public_domain_bindings BEGIN SELECT RAISE(ABORT,'bindings cannot be deleted'); END;

CREATE TABLE IF NOT EXISTS public_binding_activations(
 id TEXT PRIMARY KEY CHECK(length(id) BETWEEN 1 AND 100), workspace_id TEXT NOT NULL REFERENCES workspaces(id), binding_id TEXT NOT NULL REFERENCES public_domain_bindings(id), activated_by_user_id TEXT NOT NULL REFERENCES users(id),
 activation_version INTEGER NOT NULL CHECK(activation_version>0), source_publication_id TEXT NOT NULL CHECK(length(source_publication_id) BETWEEN 1 AND 100), source_checksum TEXT NOT NULL CHECK(length(source_checksum)=64),
 artifact_root TEXT NOT NULL CHECK(length(artifact_root) BETWEEN 1 AND 500), artifact_checksum TEXT NOT NULL CHECK(length(artifact_checksum)=64), manifest_json TEXT NOT NULL CHECK(json_valid(manifest_json) AND length(manifest_json)<=262144), canonical_url TEXT NOT NULL CHECK(length(canonical_url)<=500),
 supersedes_activation_id TEXT REFERENCES public_binding_activations(id), activation_kind TEXT NOT NULL CHECK(activation_kind IN('PUBLISH','ROLLBACK')), created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_public_binding_activation_version ON public_binding_activations(workspace_id,binding_id,activation_version);
CREATE INDEX IF NOT EXISTS idx_public_binding_activation_history ON public_binding_activations(workspace_id,binding_id,activation_version DESC,id DESC);
CREATE TRIGGER IF NOT EXISTS trg_public_binding_activation_insert_guard BEFORE INSERT ON public_binding_activations BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM public_domain_bindings b WHERE b.id=NEW.binding_id AND b.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'activation binding mismatch') END;
 SELECT CASE WHEN NEW.activation_version<>COALESCE((SELECT MAX(activation_version)+1 FROM public_binding_activations WHERE binding_id=NEW.binding_id AND workspace_id=NEW.workspace_id),1) THEN RAISE(ABORT,'activation version invalid') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_public_binding_activations_update_reject BEFORE UPDATE ON public_binding_activations BEGIN SELECT RAISE(ABORT,'binding activations are immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_public_binding_activations_delete_reject BEFORE DELETE ON public_binding_activations BEGIN SELECT RAISE(ABORT,'binding activations are immutable'); END;

CREATE TABLE IF NOT EXISTS published_asset_derivatives(
 id TEXT PRIMARY KEY CHECK(length(id) BETWEEN 1 AND 100), workspace_id TEXT NOT NULL REFERENCES workspaces(id), content_asset_id TEXT NOT NULL REFERENCES content_assets(id), published_by_user_id TEXT NOT NULL REFERENCES users(id),
 content_sha256 TEXT NOT NULL CHECK(length(content_sha256)=64), public_object_key TEXT NOT NULL CHECK(length(public_object_key) BETWEEN 1 AND 500), public_url TEXT NOT NULL CHECK(length(public_url)<=1000), mime_type TEXT NOT NULL CHECK(length(mime_type)<=100), byte_size INTEGER NOT NULL CHECK(byte_size>=0), status TEXT NOT NULL CHECK(status IN('PUBLISHED','REVOKED')), created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_published_asset_content ON published_asset_derivatives(workspace_id,content_asset_id,content_sha256);
CREATE UNIQUE INDEX IF NOT EXISTS uq_published_asset_key ON published_asset_derivatives(public_object_key);
CREATE INDEX IF NOT EXISTS idx_published_assets_workspace ON published_asset_derivatives(workspace_id,created_at DESC,id DESC);
CREATE TRIGGER IF NOT EXISTS trg_published_assets_insert_guard BEFORE INSERT ON published_asset_derivatives BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM content_assets a WHERE a.id=NEW.content_asset_id AND a.workspace_id=NEW.workspace_id AND a.status='READY' AND COALESCE(a.canonical_sha256,a.content_sha256)=NEW.content_sha256) THEN RAISE(ABORT,'published asset not ready') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_published_assets_update_reject BEFORE UPDATE ON published_asset_derivatives BEGIN SELECT RAISE(ABORT,'published asset derivatives are immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_published_assets_delete_reject BEFORE DELETE ON published_asset_derivatives BEGIN SELECT RAISE(ABORT,'published asset derivatives are immutable'); END;
`); } };
