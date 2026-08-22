export const migration057LandingBuilderCore={version:57,name:"landing_builder_core",up(db){db.exec(`
CREATE TABLE IF NOT EXISTS landing_projects(
 id TEXT PRIMARY KEY CHECK(length(id) BETWEEN 1 AND 100),workspace_id TEXT NOT NULL REFERENCES workspaces(id),created_by_user_id TEXT NOT NULL REFERENCES users(id),name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 200),slug TEXT NOT NULL CHECK(length(slug) BETWEEN 1 AND 80 AND slug NOT GLOB '*[^a-z0-9-]*'),creative_intent_id TEXT NOT NULL REFERENCES creative_intents(id),status TEXT NOT NULL CHECK(status IN('DRAFT','PUBLISHED','ARCHIVED')),current_draft_blueprint_id TEXT REFERENCES landing_blueprint_versions(id),current_published_blueprint_id TEXT REFERENCES landing_blueprint_versions(id),idempotency_key TEXT NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 200),request_hash TEXT NOT NULL CHECK(length(request_hash)=64),created_at TEXT NOT NULL,updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_landing_projects_slug ON landing_projects(workspace_id,slug);
CREATE UNIQUE INDEX IF NOT EXISTS uq_landing_projects_create ON landing_projects(workspace_id,created_by_user_id,idempotency_key);
CREATE INDEX IF NOT EXISTS idx_landing_projects_history ON landing_projects(workspace_id,updated_at DESC,id DESC);
CREATE TRIGGER IF NOT EXISTS trg_landing_projects_insert_guard BEFORE INSERT ON landing_projects BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM workspaces WHERE id=NEW.workspace_id AND status='active') THEN RAISE(ABORT,'landing workspace inactive') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM workspace_memberships WHERE workspace_id=NEW.workspace_id AND user_id=NEW.created_by_user_id AND status='active') THEN RAISE(ABORT,'landing membership inactive') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM creative_intents WHERE id=NEW.creative_intent_id AND workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'landing intent mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_landing_projects_tenant_guard BEFORE UPDATE ON landing_projects WHEN NEW.id IS NOT OLD.id OR NEW.workspace_id IS NOT OLD.workspace_id OR NEW.created_by_user_id IS NOT OLD.created_by_user_id OR NEW.creative_intent_id IS NOT OLD.creative_intent_id OR NEW.slug IS NOT OLD.slug OR NEW.created_at IS NOT OLD.created_at BEGIN SELECT RAISE(ABORT,'landing project identity immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_landing_projects_pointer_guard BEFORE UPDATE ON landing_projects WHEN
 (NEW.current_draft_blueprint_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM landing_blueprint_versions b WHERE b.id=NEW.current_draft_blueprint_id AND b.project_id=OLD.id AND b.workspace_id=OLD.workspace_id)) OR
 (NEW.current_published_blueprint_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM landing_blueprint_versions b WHERE b.id=NEW.current_published_blueprint_id AND b.project_id=OLD.id AND b.workspace_id=OLD.workspace_id))
 BEGIN SELECT RAISE(ABORT,'landing blueprint pointer mismatch'); END;
CREATE TRIGGER IF NOT EXISTS trg_landing_projects_delete_reject BEFORE DELETE ON landing_projects BEGIN SELECT RAISE(ABORT,'landing projects cannot be deleted'); END;

CREATE TABLE IF NOT EXISTS landing_blueprint_versions(
 id TEXT PRIMARY KEY CHECK(length(id) BETWEEN 1 AND 100),workspace_id TEXT NOT NULL REFERENCES workspaces(id),project_id TEXT NOT NULL REFERENCES landing_projects(id),created_by_user_id TEXT NOT NULL REFERENCES users(id),version INTEGER NOT NULL CHECK(version>0),business_context_version_id TEXT NOT NULL REFERENCES business_context_versions(id),creative_intent_id TEXT NOT NULL REFERENCES creative_intents(id),schema_version INTEGER NOT NULL CHECK(schema_version>0),component_registry_version INTEGER NOT NULL CHECK(component_registry_version>0),design_token_version INTEGER NOT NULL CHECK(design_token_version>0),tracking_contract_version INTEGER NOT NULL CHECK(tracking_contract_version>0),renderer_version INTEGER NOT NULL CHECK(renderer_version>0),locale TEXT NOT NULL CHECK(length(locale) BETWEEN 2 AND 20),direction TEXT NOT NULL CHECK(direction IN('rtl','ltr')),blueprint_json TEXT NOT NULL CHECK(json_valid(blueprint_json) AND length(blueprint_json)<=131072),content_hash TEXT NOT NULL CHECK(length(content_hash)=64),supersedes_blueprint_id TEXT REFERENCES landing_blueprint_versions(id),idempotency_key TEXT NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 200),request_hash TEXT NOT NULL CHECK(length(request_hash)=64),created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_landing_blueprint_version ON landing_blueprint_versions(workspace_id,project_id,version);
CREATE UNIQUE INDEX IF NOT EXISTS uq_landing_blueprint_create ON landing_blueprint_versions(workspace_id,project_id,created_by_user_id,idempotency_key);
CREATE INDEX IF NOT EXISTS idx_landing_blueprint_history ON landing_blueprint_versions(workspace_id,project_id,version DESC,id DESC);
CREATE TRIGGER IF NOT EXISTS trg_landing_blueprint_insert_guard BEFORE INSERT ON landing_blueprint_versions BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM landing_projects p WHERE p.id=NEW.project_id AND p.workspace_id=NEW.workspace_id AND p.creative_intent_id=NEW.creative_intent_id) THEN RAISE(ABORT,'landing blueprint project mismatch') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM business_context_versions c WHERE c.id=NEW.business_context_version_id AND c.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'landing context mismatch') END;
 SELECT CASE WHEN NEW.version<>COALESCE((SELECT MAX(version)+1 FROM landing_blueprint_versions WHERE workspace_id=NEW.workspace_id AND project_id=NEW.project_id),1) THEN RAISE(ABORT,'landing blueprint version invalid') END;
 SELECT CASE WHEN NEW.supersedes_blueprint_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM landing_blueprint_versions b WHERE b.id=NEW.supersedes_blueprint_id AND b.workspace_id=NEW.workspace_id AND b.project_id=NEW.project_id) THEN RAISE(ABORT,'landing supersession mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_landing_blueprint_update_reject BEFORE UPDATE ON landing_blueprint_versions BEGIN SELECT RAISE(ABORT,'landing blueprints are immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_landing_blueprint_delete_reject BEFORE DELETE ON landing_blueprint_versions BEGIN SELECT RAISE(ABORT,'landing blueprints are immutable'); END;

CREATE TABLE IF NOT EXISTS landing_publications(
 id TEXT PRIMARY KEY CHECK(length(id) BETWEEN 1 AND 100),workspace_id TEXT NOT NULL REFERENCES workspaces(id),project_id TEXT NOT NULL REFERENCES landing_projects(id),blueprint_id TEXT NOT NULL REFERENCES landing_blueprint_versions(id),published_by_user_id TEXT NOT NULL REFERENCES users(id),publication_version INTEGER NOT NULL CHECK(publication_version>0),host TEXT CHECK(host IS NULL OR length(host)<=255),path TEXT CHECK(path IS NULL OR length(path)<=500),artifact_checksum TEXT CHECK(artifact_checksum IS NULL OR length(artifact_checksum)=64),renderer_version INTEGER NOT NULL CHECK(renderer_version>0),status TEXT NOT NULL CHECK(status IN('PUBLISHED','SUPERSEDED','FAILED')),failure_code TEXT CHECK(failure_code IS NULL OR length(failure_code)<=100),idempotency_key TEXT NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 200),request_hash TEXT NOT NULL CHECK(length(request_hash)=64),created_at TEXT NOT NULL,published_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_landing_publication_version ON landing_publications(workspace_id,project_id,publication_version);
CREATE UNIQUE INDEX IF NOT EXISTS uq_landing_publication_create ON landing_publications(workspace_id,project_id,published_by_user_id,idempotency_key);
CREATE INDEX IF NOT EXISTS idx_landing_publication_history ON landing_publications(workspace_id,project_id,publication_version DESC,id DESC);
CREATE TRIGGER IF NOT EXISTS trg_landing_publication_insert_guard BEFORE INSERT ON landing_publications BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM landing_blueprint_versions b WHERE b.id=NEW.blueprint_id AND b.project_id=NEW.project_id AND b.workspace_id=NEW.workspace_id AND b.renderer_version=NEW.renderer_version) THEN RAISE(ABORT,'landing publication lineage mismatch') END;
 SELECT CASE WHEN NEW.publication_version<>COALESCE((SELECT MAX(publication_version)+1 FROM landing_publications WHERE workspace_id=NEW.workspace_id AND project_id=NEW.project_id),1) THEN RAISE(ABORT,'landing publication version invalid') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_landing_publication_update_reject BEFORE UPDATE ON landing_publications BEGIN SELECT RAISE(ABORT,'landing publications are immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_landing_publication_delete_reject BEFORE DELETE ON landing_publications BEGIN SELECT RAISE(ABORT,'landing publications are immutable'); END;
`);}};
