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
  const pendingUploads = new Map();
  const localApiBaseUrl = String(
    env.SITE_MEDIA_LOCAL_API_BASE_URL ||
    env.API_PUBLIC_URL ||
    `http://localhost:${env.API_PORT || env.PORT || 3001}`
  ).replace(/\/$/, "");
  const storageApiBaseUrl = `${baseUrl}/storage/v1`;

  function safeStorageKey(storageKey) {
    const key = String(storageKey || "").replace(/\\/g, "/").replace(/^\/+/, "");
    if (!key || key.includes("..")) throw new SiteMediaStorageError("Invalid media path.", "SITE_MEDIA_PATH_INVALID", 400);
    return key;
  }

  /**
   * Poka-Yoke upload contract:
   * The browser NEVER talks directly to Supabase Storage. Every upload goes to
   * Loadder's own API first, so CORS, auth/session and provider-specific signed
   * URL behavior cannot diverge between Hero, Banner, Product and Gallery.
   */
  async function signedUpload({ workspaceId, siteProjectId, assetType, fileName, mimeType = "application/octet-stream" }) {
    if (!workspaceId || !siteProjectId || !assetType || !fileName) throw new SiteMediaStorageError("workspaceId, siteProjectId, assetType and fileName are required.", "SITE_MEDIA_UPLOAD_INPUT_INVALID", 400);
    const safeName = String(fileName).split(/[\\/]/).pop().replace(/[^a-zA-Z0-9._-]/g, "-");
    const storagePath = `${workspaceId}/${siteProjectId}/${assetType}/${crypto.randomUUID()}-${safeName}`;
    const token = crypto.randomUUID();
    pendingUploads.set(token, {
      path: storagePath,
      mimeType: String(mimeType || "application/octet-stream"),
      expiresAt: Date.now() + 2 * 60 * 60 * 1000,
    });
    return {
      bucket: remoteConfigured ? bucket : "local",
      path: storagePath,
      token,
      signedUrl: `${localApiBaseUrl}/api/site-media-upload/${token}`,
      local: true,
      proxied: true,
    };
  }

  async function acceptLocalUpload(token, body) {
    const keyToken = String(token || "");
    const pending = pendingUploads.get(keyToken);
    if (!pending || pending.expiresAt < Date.now()) {
      pendingUploads.delete(keyToken);
      throw new SiteMediaStorageError("Upload token is invalid or expired.", "SITE_MEDIA_UPLOAD_TOKEN_INVALID", 403);
    }
    if (!Buffer.isBuffer(body) || body.length === 0) throw new SiteMediaStorageError("Uploaded file is empty.", "SITE_MEDIA_BODY_EMPTY", 400);
    const key = safeStorageKey(pending.path);

    try {
      if (remoteConfigured) {
        const response = await fetchImpl(`${storageApiBaseUrl}/object/${encodeURIComponent(bucket)}/${key}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            apikey: serviceRoleKey,
            "Content-Type": pending.mimeType,
            "x-upsert": "false",
          },
          body,
        });
        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          throw new SiteMediaStorageError(
            `Unable to store media${detail ? `: ${detail.slice(0, 180)}` : "."}`,
            "SITE_MEDIA_PROVIDER_UPLOAD_FAILED",
            502,
          );
        }
      } else {
        const target = path.resolve(localRoot, key);
        if (!target.startsWith(`${localRoot}${path.sep}`)) throw new SiteMediaStorageError("Invalid local media path.", "SITE_MEDIA_LOCAL_PATH_INVALID", 400);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, body);
      }
      return { path: key, sizeBytes: body.length };
    } finally {
      pendingUploads.delete(keyToken);
    }
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
