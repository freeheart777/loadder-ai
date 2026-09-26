// Absolute URLs on the public-site runtime (server/public-site-server.mjs).
// The Studio runs on another origin than that runtime, so a relative
// /preview/sites/... path resolved against the API origin, which does not
// serve it (404). Pure: the base URL is passed in.
const trimBase = (baseUrl) => String(baseUrl || "").replace(/\/+$/, "");

export function previewSiteUrl(baseUrl, projectId, token) {
  if (!baseUrl || !projectId || !token) return null;
  return `${trimBase(baseUrl)}/preview/sites/${encodeURIComponent(projectId)}?token=${encodeURIComponent(token)}`;
}
