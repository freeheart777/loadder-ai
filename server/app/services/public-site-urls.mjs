// User-facing site URLs. Visitors reach a published site at
// PUBLIC_SITE_BASE_URL + /s/:slug; /sites/:id stays an internal route.
// Pure: the base URL is passed in, so callers and tests control it.
const trimBase = (baseUrl) => String(baseUrl || "").replace(/\/+$/, "");

export function publicSiteUrl(baseUrl, slug) {
  if (!baseUrl || typeof slug !== "string" || !slug) return null;
  return `${trimBase(baseUrl)}/s/${encodeURIComponent(slug)}`;
}

export function previewSiteUrl(baseUrl, projectId, token) {
  if (!baseUrl || !projectId || !token) return null;
  return `${trimBase(baseUrl)}/preview/sites/${encodeURIComponent(projectId)}?token=${encodeURIComponent(token)}`;
}

// The public URL of a project, or null while it has never been published.
export function projectPublicUrl(baseUrl, project) {
  return project?.status === "PUBLISHED" ? publicSiteUrl(baseUrl, project.slug) : null;
}
