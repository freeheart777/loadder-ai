export const migration042SiteBuilderControlPlane = {
  version: 42,
  name: "site_builder_control_plane",
  up(db) {
    db.exec(`
CREATE TABLE IF NOT EXISTS site_projects(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  context_version_id TEXT,
  name TEXT NOT NULL CHECK(length(trim(name))>0),
  site_type TEXT NOT NULL CHECK(site_type IN('BUSINESS','STORE','NEWS','LEGAL','MEDICAL')),
  slug TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN('DRAFT','PUBLISHED','ARCHIVED')) DEFAULT 'DRAFT',
  content_json TEXT NOT NULL DEFAULT '{}',
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(context_version_id) REFERENCES business_context_versions(id),
  UNIQUE(workspace_id,slug)
);
CREATE INDEX IF NOT EXISTS idx_site_projects_workspace ON site_projects(workspace_id,updated_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_site_projects_published ON site_projects(workspace_id,status,slug);

CREATE TABLE IF NOT EXISTS site_assets(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  site_project_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN('logo','hero','banner','product','gallery','favicon')),
  name TEXT NOT NULL CHECK(length(trim(name))>0),
  url TEXT NOT NULL CHECK(length(trim(url))>0),
  storage_key TEXT,
  alt_text TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(site_project_id) REFERENCES site_projects(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_site_assets_project ON site_assets(workspace_id,site_project_id,created_at DESC);

CREATE TABLE IF NOT EXISTS site_integrations(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  site_project_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK(provider IN('CRM','PAYMENT','ANALYTICS','BOOKING','DOMAIN')),
  status TEXT NOT NULL CHECK(status IN('DISCONNECTED','PENDING','CONNECTED','ERROR')) DEFAULT 'DISCONNECTED',
  external_id TEXT,
  config_json TEXT NOT NULL DEFAULT '{}',
  credential_reference TEXT,
  last_synced_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(site_project_id) REFERENCES site_projects(id) ON DELETE CASCADE,
  UNIQUE(workspace_id,site_project_id,provider)
);
CREATE INDEX IF NOT EXISTS idx_site_integrations_workspace ON site_integrations(workspace_id,site_project_id,provider);

CREATE TRIGGER IF NOT EXISTS trg_site_assets_workspace_guard BEFORE INSERT ON site_assets BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM site_projects p WHERE p.id=NEW.site_project_id AND p.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'site asset workspace mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_site_integrations_workspace_guard BEFORE INSERT ON site_integrations BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM site_projects p WHERE p.id=NEW.site_project_id AND p.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'site integration workspace mismatch') END;
END;
CREATE TRIGGER IF NOT EXISTS trg_site_projects_identity_update BEFORE UPDATE ON site_projects BEGIN
  SELECT CASE WHEN OLD.workspace_id<>NEW.workspace_id OR OLD.id<>NEW.id THEN RAISE(ABORT,'site project identity is immutable') END;
END;
`);
  }
};
