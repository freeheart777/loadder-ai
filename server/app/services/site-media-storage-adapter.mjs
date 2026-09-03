import fs from "node:fs/promises";
import path from "node:path";

export class SiteMediaStorageError extends Error {
  constructor(message, code = "SITE_MEDIA_STORAGE_ERROR", status = 500) {
    super(message); this.name = "SiteMediaStorageError"; this.code = code; this.status = status;
  }
}

export function createSiteMediaStorageAdapter({ fetchImpl = fetch, env = process.env } = {}) {
  const baseUrl = String(env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
  const bucket = env.SITE_MEDIA_BUCKET || "site-media";
  const remoteConfigured = Boolean(baseUrl && serviceRoleKey);
  const localRoot = path.resolve(env.SITE_MEDIA_LOCAL_DIR || path.join(process.cwd(), "server", "data", "site-media"));
  const localUploads = new Map();
  const localApiBaseUrl = String(
    env.SITE_MEDIA_LOCAL_API_BASE_URL ||
    env.API_PUBLIC_URL ||
    `http://localhost:${env.API_PORT || env.PORT || 3001}`
  ).replace(/\/$/, "");
  const storageApiBaseUrl = `${baseUrl}/storage/v1`;

  function safeStorageKey(storageKey) {
    const key = String(storageKey || "").replace(/\\/g, "/").replace(/^\/+/, "");
    if (!key || key.includes("..")) throw new SiteMediaStorageError("Invalid local media path.", "SITE_MEDIA_LOCAL_PATH_INVALID", 400);
    return key;
  }

  async function signedUpload({ workspaceId, siteProjectId, assetType, fileName, upsert = false }) {
    if (!workspaceId || !siteProjectId || !assetType || !fileName) throw new SiteMediaStorageError("workspaceId, siteProjectId, assetType and fileName are required.", "SITE_MEDIA_UPLOAD_INPUT_INVALID", 400);
    const safeName = String(fileName).split(/[\\/]/).pop().replace(/[^a-zA-Z0-9._-]/g, "-");
    const storagePath = `${workspaceId}/${siteProjectId}/${assetType}/${crypto.randomUUID()}-${safeName}`;

    if (!remoteConfigured) {
      const token = crypto.randomUUID();
      localUploads.set(token, { path: storagePath, expiresAt: Date.now() + 2 * 60 * 60 * 1000 });
      return { bucket: "local", path: storagePath, token, signedUrl: `${localApiBaseUrl}/api/site-media-local/upload/${token}`, local: true };
    }

    const headers = { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey, "Content-Type": "application/json" };
    if (upsert) headers["x-upsert"] = "true";
    const response = await fetchImpl(`${storageApiBaseUrl}/object/upload/sign/${encodeURIComponent(bucket)}/${storagePath}`, {
      method: "POST", headers, body: JSON.stringify({})
    });
    if (!response.ok) throw new SiteMediaStorageError("Unable to create signed upload URL.", "SITE_MEDIA_SIGNED_UPLOAD_FAILED", 502);
    const payload = await response.json();
    const returnedUrl = String(payload.url || "").trim();
    const signedUrl = returnedUrl
      ? (/^https?:\/\//i.test(returnedUrl)
        ? returnedUrl
        : `${storageApiBaseUrl}${returnedUrl.startsWith("/") ? "" : "/"}${returnedUrl}`)
      : `${storageApiBaseUrl}/object/upload/sign/${encodeURIComponent(bucket)}/${storagePath}?token=${encodeURIComponent(payload.token)}`;
    return { bucket, path: storagePath, token: payload.token, signedUrl };
  }

  async function acceptLocalUpload(token, body) {
    const pending = localUploads.get(String(token || ""));
    if (!pending || pending.expiresAt < Date.now()) {
      localUploads.delete(String(token || ""));
      throw new SiteMediaStorageError("Local upload token is invalid or expired.", "SITE_MEDIA_LOCAL_TOKEN_INVALID", 403);
    }
    if (!Buffer.isBuffer(body) || body.length === 0) throw new SiteMediaStorageError("Uploaded file is empty.", "SITE_MEDIA_LOCAL_BODY_EMPTY", 400);
    const key = safeStorageKey(pending.path);
    const target = path.resolve(localRoot, key);
    if (!target.startsWith(`${localRoot}${path.sep}`)) throw new SiteMediaStorageError("Invalid local media path.", "SITE_MEDIA_LOCAL_PATH_INVALID", 400);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, body);
    localUploads.delete(String(token || ""));
    return { path: key, sizeBytes: body.length };
  }

  async function readLocalAsset(encodedKey) {
    if (remoteConfigured) throw new SiteMediaStorageError("Local media is disabled.", "SITE_MEDIA_LOCAL_DISABLED", 404);
    let key;
    try { key = Buffer.from(String(encodedKey || ""), "base64url").toString("utf8"); }
    catch { throw new SiteMediaStorageError("Invalid local media key.", "SITE_MEDIA_LOCAL_KEY_INVALID", 400); }
    key = safeStorageKey(key);
    const target = path.resolve(localRoot, key);
    if (!target.startsWith(`${localRoot}${path.sep}`)) throw new SiteMediaStorageError("Invalid local media path.", "SITE_MEDIA_LOCAL_PATH_INVALID", 400);
    try { return { body: await fs.readFile(target), fileName: path.basename(target) }; }
    catch (error) { if (error?.code === "ENOENT") throw new SiteMediaStorageError("Local media not found.", "SITE_MEDIA_LOCAL_NOT_FOUND", 404); throw error; }
  }

  function publicAssetUrl(storageKey) {
    const key = safeStorageKey(storageKey);
    if (!remoteConfigured) return `${localApiBaseUrl}/api/site-media-local/object/${Buffer.from(key, "utf8").toString("base64url")}`;
    return `${storageApiBaseUrl}/object/public/${encodeURIComponent(bucket)}/${key}`;
  }

  return { signedUpload, publicAssetUrl, acceptLocalUpload, readLocalAsset, bucket, remoteConfigured };
}
