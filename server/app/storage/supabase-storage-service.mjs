const DEFAULT_BUCKET = "site-assets";
const MAX_PATH_LENGTH = 512;
const MAX_UPLOAD_TTL = 60 * 60 * 2;
const MAX_DOWNLOAD_TTL = 60 * 60 * 24;

export class SiteStorageError extends Error {
  constructor(message, status = 500, code = "SITE_STORAGE_ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const cleanSegment = (value) => String(value ?? "").trim().replace(/^\/+|\/+$/g, "");

const assertPath = (path) => {
  const value = String(path ?? "").trim();
  if (!value || value.length > MAX_PATH_LENGTH || value.includes("..") || value.startsWith("/") || value.includes("\\")) {
    throw new SiteStorageError("Storage path is invalid.", 400, "SITE_STORAGE_PATH_INVALID");
  }
  return value;
};

const ttl = (value, max) => {
  const n = Number(value ?? max);
  if (!Number.isInteger(n) || n < 60 || n > max) {
    throw new SiteStorageError("Storage URL expiry is invalid.", 400, "SITE_STORAGE_TTL_INVALID");
  }
  return n;
};

export function createSupabaseStorageService({ projectUrl = process.env.SUPABASE_URL, serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY, bucket = process.env.SUPABASE_SITE_ASSET_BUCKET || DEFAULT_BUCKET, fetchImpl = globalThis.fetch } = {}) {
  if (!projectUrl || !serviceRoleKey) {
    return Object.freeze({ configured: false, createUploadUrl() { throw new SiteStorageError("Supabase Storage is not configured.", 503, "SITE_STORAGE_NOT_CONFIGURED"); }, createDownloadUrl() { throw new SiteStorageError("Supabase Storage is not configured.", 503, "SITE_STORAGE_NOT_CONFIGURED"); } });
  }
  if (typeof fetchImpl !== "function") throw new TypeError("fetchImpl is required.");
  const base = `${String(projectUrl).replace(/\/+$/, "")}/storage/v1`;
  const headers = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" };
  const bucketName = cleanSegment(bucket) || DEFAULT_BUCKET;
  async function request(path, options = {}) {
    const response = await fetchImpl(`${base}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
    const text = await response.text(); let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = { message: text }; }
    if (!response.ok) throw new SiteStorageError(body?.message || body?.error || "Supabase Storage request failed.", response.status >= 400 && response.status < 500 ? response.status : 502, "SITE_STORAGE_UPSTREAM_ERROR");
    return body;
  }
  async function createUploadUrl({ workspaceId, siteProjectId, filename, contentType, expiresIn, upsert = false }) {
    const safeWorkspace = cleanSegment(workspaceId), safeProject = cleanSegment(siteProjectId), safeFilename = cleanSegment(filename).replace(/[^a-zA-Z0-9._-]/g, "-");
    if (!safeWorkspace || !safeProject || !safeFilename) throw new SiteStorageError("Storage upload metadata is incomplete.", 400, "SITE_STORAGE_METADATA_INVALID");
    const path = assertPath(`${safeWorkspace}/${safeProject}/${safeFilename}`);
    const data = await request(`/object/upload/sign/${encodeURIComponent(bucketName)}/${path}`, { method: "POST", headers: upsert ? { "x-upsert": "true" } : undefined });
    const relative = data?.url || data?.signedURL;
    if (!relative) throw new SiteStorageError("Supabase did not return an upload URL.", 502, "SITE_STORAGE_UPSTREAM_INVALID");
    const signedUrl = new URL(relative, `${String(projectUrl).replace(/\/+$/, "")}/storage/v1`).toString();
    return { bucket: bucketName, path, signedUrl, token: new URL(signedUrl).searchParams.get("token"), contentType: contentType || null, expiresIn: ttl(expiresIn, MAX_UPLOAD_TTL) };
  }
  async function createDownloadUrl({ path, expiresIn }) {
    const safePath = assertPath(path); const expiry = ttl(expiresIn, MAX_DOWNLOAD_TTL);
    const data = await request(`/object/sign/${encodeURIComponent(bucketName)}/${safePath}`, { method: "POST", body: JSON.stringify({ expiresIn: expiry }) });
    const relative = data?.signedURL;
    if (!relative) throw new SiteStorageError("Supabase did not return a download URL.", 502, "SITE_STORAGE_UPSTREAM_INVALID");
    return { bucket: bucketName, path: safePath, signedUrl: new URL(relative, `${String(projectUrl).replace(/\/+$/, "")}/storage/v1`).toString(), expiresIn: expiry };
  }
  return Object.freeze({ configured: true, bucket: bucketName, createUploadUrl, createDownloadUrl });
}
