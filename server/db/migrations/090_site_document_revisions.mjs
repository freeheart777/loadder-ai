// An append-only history of the V16 draft document.
//
// site_projects.content_json stays the canonical materialised current draft;
// this table records the complete document state behind each tracked save, so
// history and exact restore are deterministic. Gate 01 stores full snapshots
// deliberately — there is no patch representation yet.
export const migration090SiteDocumentRevisions = {
  version: 90,
  name: "site_document_revisions",
  up(db) {
    db.exec(`
CREATE TABLE IF NOT EXISTS site_document_revisions(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  site_project_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK(revision >= 1),
  parent_revision_id TEXT,
  document_json TEXT NOT NULL,
  document_hash TEXT NOT NULL CHECK(length(trim(document_hash)) = 64),
  actor_user_id TEXT,
  idempotency_key TEXT NOT NULL CHECK(length(trim(idempotency_key)) BETWEEN 1 AND 200),
  created_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(site_project_id) REFERENCES site_projects(id) ON DELETE RESTRICT,
  FOREIGN KEY(parent_revision_id) REFERENCES site_document_revisions(id) ON DELETE RESTRICT,
  UNIQUE(workspace_id,site_project_id,revision),
  UNIQUE(workspace_id,site_project_id,idempotency_key)
);

-- Listing a site's history in order. The UNIQUE(workspace,site,revision)
-- constraint already indexes the revision lookup, so only the time-ordered
-- read needs its own index.
CREATE INDEX IF NOT EXISTS idx_site_document_revisions_created
  ON site_document_revisions(workspace_id,site_project_id,created_at);

-- A revision may only reference a site project in its own workspace.
CREATE TRIGGER IF NOT EXISTS trg_site_document_revision_project_workspace
BEFORE INSERT ON site_document_revisions
BEGIN
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM site_projects p WHERE p.id=NEW.site_project_id AND p.workspace_id=NEW.workspace_id
  ) THEN RAISE(ABORT,'site document revision project workspace mismatch') END;
END;

-- A parent revision must belong to the same workspace AND the same site.
CREATE TRIGGER IF NOT EXISTS trg_site_document_revision_parent_workspace
BEFORE INSERT ON site_document_revisions
WHEN NEW.parent_revision_id IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM site_document_revisions r
    WHERE r.id=NEW.parent_revision_id
      AND r.workspace_id=NEW.workspace_id
      AND r.site_project_id=NEW.site_project_id
  ) THEN RAISE(ABORT,'site document revision parent workspace mismatch') END;
END;

-- History is append-only: a recorded revision can never be changed or removed.
-- Undo appends a new revision instead.
CREATE TRIGGER IF NOT EXISTS trg_site_document_revision_no_update
BEFORE UPDATE ON site_document_revisions
BEGIN
  SELECT RAISE(ABORT,'site document revisions are append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_site_document_revision_no_delete
BEFORE DELETE ON site_document_revisions
BEGIN
  SELECT RAISE(ABORT,'site document revisions cannot be deleted');
END;
`);
  },
};
