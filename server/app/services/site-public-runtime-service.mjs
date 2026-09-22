const mapProject = (row) => row && ({
  id: row.id,
  name: row.name,
  siteType: row.site_type,
  slug: row.slug,
  status: row.status,
  content: JSON.parse(row.content_json || "{}"),
  publishedAt: row.published_at,
  contextVersionId: row.context_version_id,
});

const mapAsset = (row) => ({
  id: row.id,
  kind: row.kind,
  name: row.name,
  url: row.url,
  altText: row.alt_text,
});

export function createSitePublicRuntimeService(db) {
  const getPublished = (slug) => {
    const cleanSlug = String(slug || "").trim().toLowerCase();
    if (!cleanSlug || cleanSlug.length > 80) return null;
    const project = db.prepare("SELECT * FROM site_projects WHERE slug=? AND status='PUBLISHED' LIMIT 1").get(cleanSlug);
    if (!project) return null;
    const assets = db.prepare("SELECT id,kind,name,url,alt_text FROM site_assets WHERE site_project_id=? ORDER BY created_at DESC").all(project.id).map(mapAsset);
    return Object.freeze({ project: mapProject(project), assets });
  };

  return Object.freeze({ getPublished });
}
