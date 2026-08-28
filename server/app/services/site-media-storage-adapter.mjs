export class SiteMediaStorageError extends Error {
  constructor(message, code = "SITE_MEDIA_STORAGE_ERROR", status = 500) {
    super(message); this.name = "SiteMediaStorageError"; this.code = code; this.status = status;
  }
}

export function createSiteMediaStorageAdapter({ fetchImpl = fetch, env = process.env } = {}) {
  const baseUrl = String(env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
  const bucket = env.SITE_MEDIA_BUCKET || "site-media";
  const requireConfig = () => {
    if (!baseUrl || !serviceRoleKey) throw new SiteMediaStorageError("Supabase Storage is not configured.", "SITE_MEDIA_STORAGE_NOT_CONFIGURED", 503);
  };
  async function signedUpload({ workspaceId, siteProjectId, assetType, fileName, upsert = false }) {
    requireConfig();
    if (!workspaceId || !siteProjectId || !assetType || !fileName) throw new SiteMediaStorageError("workspaceId, siteProjectId, assetType and fileName are required.", "SITE_MEDIA_UPLOAD_INPUT_INVALID", 400);
    const safeName = String(fileName).split(/[\\/]/).pop().replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${workspaceId}/${siteProjectId}/${assetType}/${crypto.randomUUID()}-${safeName}`;
    const response = await fetchImpl(`${baseUrl}/storage/v1/object/upload/sign/${encodeURIComponent(bucket)}/${path}`, {
      method: "POST", headers: { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey, "Content-Type": "application/json" }, body: JSON.stringify({ upsert })
    });
    if (!response.ok) throw new SiteMediaStorageError("Unable to create signed upload URL.", "SITE_MEDIA_SIGNED_UPLOAD_FAILED", 502);
    const payload = await response.json();
    return { bucket, path, token: payload.token, signedUrl: `${baseUrl}/storage/v1/object/upload/sign/${encodeURIComponent(bucket)}/${path}?token=${encodeURIComponent(payload.token)}` };
  }
  function publicAssetUrl(storageKey) { requireConfig(); return `${baseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${storageKey}`; }
  return { signedUpload, publicAssetUrl, bucket };
}
