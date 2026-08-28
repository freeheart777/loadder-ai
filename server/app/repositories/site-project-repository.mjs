import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";

const mapProject = (row) => row && ({
  id: row.id,
  workspaceId: row.workspace_id,
  contextVersionId: row.context_version_id,
  name: row.name,
  siteType: row.site_type,
  slug: row.slug,
  status: row.status,
  content: JSON.parse(row.content_json || "{}"),
  publishedAt: row.published_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapAsset = (row) => row && ({
  id: row.id,
  workspaceId: row.workspace_id,
  siteProjectId: row.site_project_id,
  kind: row.kind,
  name: row.name,
  url: row.url,
  altText: row.alt_text,
  createdAt: row.created_at,
});

export function createSiteProjectRepository(db) {
  const workspace = () => requireWorkspaceId();

  function list() {
    return db.prepare("SELECT * FROM site_projects WHERE workspace_id=? ORDER BY updated_at DESC").all(workspace()).map(mapProject);
  }

  function get(id) {
    return mapProject(db.prepare("SELECT * FROM site_projects WHERE id=? AND workspace_id=?").get(id, workspace()));
  }

  function create({ name, siteType, slug, contextVersionId = null, content = {}, now }) {
    const id = crypto.randomUUID();
    db.prepare("INSERT INTO site_projects(id,workspace_id,context_version_id,name,site_type,slug,status,content_json,created_at,updated_at) VALUES(?,?,?,?,?,?, 'DRAFT',?,?,?)")
      .run(id, workspace(), contextVersionId, name, siteType, slug, JSON.stringify(content), now, now);
    return get(id);
  }

  function update(id, { name, siteType, slug, contextVersionId, content, status, now }) {
    const current = get(id);
    if (!current) return null;
    db.prepare("UPDATE site_projects SET name=COALESCE(?,name),site_type=COALESCE(?,site_type),slug=COALESCE(?,slug),context_version_id=COALESCE(?,context_version_id),content_json=COALESCE(?,content_json),status=COALESCE(?,status),updated_at=? WHERE id=? AND workspace_id=?")
      .run(name ?? null, siteType ?? null, slug ?? null, contextVersionId ?? null, content === undefined ? null : JSON.stringify(content), status ?? null, now, id, workspace());
    return get(id);
  }

  function publish(id, now) {
    const result = db.prepare("UPDATE site_projects SET status='PUBLISHED',published_at=COALESCE(published_at,?),updated_at=? WHERE id=? AND workspace_id=?").run(now, now, id, workspace());
    return result.changes === 1 ? get(id) : null;
  }

  function remove(id) {
    return db.prepare("DELETE FROM site_projects WHERE id=? AND workspace_id=?").run(id, workspace()).changes === 1;
  }

  function listAssets(siteProjectId) {
    return db.prepare("SELECT * FROM site_assets WHERE site_project_id=? AND workspace_id=? ORDER BY created_at DESC").all(siteProjectId, workspace()).map(mapAsset);
  }

  function addAsset(siteProjectId, { kind, name, url, altText = null, now }) {
    if (!get(siteProjectId)) return null;
    const id = crypto.randomUUID();
    db.prepare("INSERT INTO site_assets(id,workspace_id,site_project_id,kind,name,url,alt_text,created_at) VALUES(?,?,?,?,?,?,?,?)")
      .run(id, workspace(), siteProjectId, kind, name, url, altText, now);
    return mapAsset(db.prepare("SELECT * FROM site_assets WHERE id=? AND workspace_id=?").get(id, workspace()));
  }

  function removeAsset(id) {
    return db.prepare("DELETE FROM site_assets WHERE id=? AND workspace_id=?").run(id, workspace()).changes === 1;
  }

  return Object.freeze({ list, get, create, update, publish, remove, listAssets, addAsset, removeAsset });
}
