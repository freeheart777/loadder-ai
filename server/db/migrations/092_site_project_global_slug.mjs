// Public site URLs are PUBLIC_SITE_BASE_URL + /s/:slug, with no workspace in
// the path, so a slug must identify exactly one site project globally.
// site_projects already has UNIQUE(workspace_id,slug); this adds a global
// unique index on slug alone.
//
// Existing cross-workspace duplicates are resolved deterministically before
// the index is created: the oldest project (created_at, then id) keeps its
// slug, every later one gets "-" plus a prefix of its own id. Nothing was
// publicly addressable by slug before this migration, so renaming a
// duplicate cannot break a published URL. SQLite cannot drop the old table
// constraint without a table rebuild, and it stays harmless alongside the
// global index.
const SLUG_MAX = 80;

function uniqueCandidate(db, slug, id) {
  for (let length = 6; length <= id.length; length += 2) {
    const suffix = `-${id.replace(/[^a-z0-9]/gi, "").slice(0, length).toLowerCase()}`;
    const candidate = `${slug.slice(0, SLUG_MAX - suffix.length)}${suffix}`;
    if (!db.prepare("SELECT 1 FROM site_projects WHERE slug=?").get(candidate)) return candidate;
  }
  throw new Error(`Unable to derive a unique slug for site project ${id}`);
}

export const migration092SiteProjectGlobalSlug = {
  version: 92,
  name: "site_project_global_slug",
  up(db) {
    const duplicates = db.prepare(`
      SELECT id, slug FROM site_projects p
      WHERE EXISTS (
        SELECT 1 FROM site_projects o
        WHERE o.slug = p.slug
          AND (o.created_at < p.created_at OR (o.created_at = p.created_at AND o.id < p.id))
      )
      ORDER BY created_at, id
    `).all();
    const rename = db.prepare("UPDATE site_projects SET slug=? WHERE id=?");
    for (const row of duplicates) rename.run(uniqueCandidate(db, row.slug, row.id), row.id);
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS ux_site_projects_slug ON site_projects(slug)");
  },
};
