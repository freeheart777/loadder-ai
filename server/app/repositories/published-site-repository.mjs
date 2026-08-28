import { requireWorkspaceId } from "../tenant-context.mjs";

const mapProject = (row) => row && ({ id: row.id, workspaceId: row.workspace_id, contextVersionId: row.context_version_id, name: row.name, siteType: row.site_type, slug: row.slug, status: row.status, content: JSON.parse(row.content_json || "{}"), publishedAt: row.published_at, createdAt: row.created_at, updatedAt: row.updated_at });
const mapAsset = (row) => row && ({ id: row.id, workspaceId: row.workspace_id, siteProjectId: row.site_project_id, kind: row.kind, name: row.name, url: row.url, altText: row.alt_text, createdAt: row.created_at });

export function createPublishedSiteRepository(db) {
  const workspace = () => requireWorkspaceId();
  function getForWorkspace(id) { return mapProject(db.prepare("SELECT * FROM site_projects WHERE id=? AND workspace_id=?").get(id, workspace())); }
  function getPublished(id) { return mapProject(db.prepare("SELECT * FROM site_projects WHERE id=? AND status='PUBLISHED'").get(id)); }
  function listPublishedAssets(id) { return db.prepare("SELECT a.* FROM site_assets a JOIN site_projects p ON p.id=a.site_project_id AND p.workspace_id=a.workspace_id WHERE a.site_project_id=? AND p.status='PUBLISHED' ORDER BY a.created_at DESC").all(id).map(mapAsset); }
  return Object.freeze({ getForWorkspace, getPublished, listPublishedAssets });
}
