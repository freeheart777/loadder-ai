// Structured draft patches: the proposal, its per-operation validation and the
// revision it eventually produced. The V16 document itself is untouched —
// site_projects.content_json stays the canonical current draft and
// site_document_revisions stays the immutable history.
export const migration091SiteDocumentPatches = {
  version: 91,
  name: "site_document_patches",
  up(db) {
    db.exec(`
CREATE TABLE IF NOT EXISTS site_document_patches(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  site_project_id TEXT NOT NULL,
  base_revision INTEGER NOT NULL CHECK(base_revision >= 0),
  idempotency_key TEXT NOT NULL CHECK(length(trim(idempotency_key)) BETWEEN 1 AND 200),
  patch_hash TEXT NOT NULL CHECK(length(trim(patch_hash)) = 64),
  operations_json TEXT NOT NULL,
  validation_json TEXT NOT NULL,
  preview_hash TEXT CHECK(preview_hash IS NULL OR length(trim(preview_hash)) = 64),
  status TEXT NOT NULL CHECK(status IN('PROPOSED','VALIDATED','PREVIEWED','APPLIED','PARTIALLY_APPLIED','REJECTED','CONFLICTED')),
  applied_revision_id TEXT,
  actor_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(site_project_id) REFERENCES site_projects(id) ON DELETE RESTRICT,
  FOREIGN KEY(applied_revision_id) REFERENCES site_document_revisions(id) ON DELETE RESTRICT,
  UNIQUE(workspace_id,site_project_id,idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_site_document_patches_project
  ON site_document_patches(workspace_id,site_project_id,created_at);

-- A patch may only reference a site project in its own workspace.
CREATE TRIGGER IF NOT EXISTS trg_site_document_patch_project_workspace
BEFORE INSERT ON site_document_patches
BEGIN
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM site_projects p WHERE p.id=NEW.site_project_id AND p.workspace_id=NEW.workspace_id
  ) THEN RAISE(ABORT,'site document patch project workspace mismatch') END;
END;

-- The revision a patch produced must belong to the same workspace and site.
CREATE TRIGGER IF NOT EXISTS trg_site_document_patch_revision_workspace
BEFORE UPDATE OF applied_revision_id ON site_document_patches
WHEN NEW.applied_revision_id IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM site_document_revisions r
    WHERE r.id=NEW.applied_revision_id AND r.workspace_id=NEW.workspace_id AND r.site_project_id=NEW.site_project_id
  ) THEN RAISE(ABORT,'site document patch revision workspace mismatch') END;
END;

-- Identity is immutable for the life of a patch. The operations are part of
-- that identity: what was validated is what applies, and patch_hash stays true.
CREATE TRIGGER IF NOT EXISTS trg_site_document_patch_identity_immutable
BEFORE UPDATE ON site_document_patches
WHEN OLD.workspace_id<>NEW.workspace_id OR OLD.site_project_id<>NEW.site_project_id
  OR OLD.idempotency_key<>NEW.idempotency_key OR OLD.patch_hash<>NEW.patch_hash
  OR OLD.operations_json<>NEW.operations_json
  OR OLD.base_revision<>NEW.base_revision OR OLD.created_at<>NEW.created_at
BEGIN
  SELECT RAISE(ABORT,'site document patch identity is immutable');
END;

-- A settled patch is history: its outcome is never silently rewritten.
CREATE TRIGGER IF NOT EXISTS trg_site_document_patch_terminal_immutable
BEFORE UPDATE ON site_document_patches
WHEN OLD.status IN('APPLIED','PARTIALLY_APPLIED','REJECTED') AND (
  OLD.status<>NEW.status OR COALESCE(OLD.applied_revision_id,'')<>COALESCE(NEW.applied_revision_id,'')
)
BEGIN
  SELECT RAISE(ABORT,'settled site document patch is immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_site_document_patch_no_delete
BEFORE DELETE ON site_document_patches
BEGIN
  SELECT RAISE(ABORT,'site document patches cannot be deleted');
END;
`);
  },
};
