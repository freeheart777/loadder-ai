export const CONTENT_ASSET_MEDIA_TYPES = Object.freeze(["IMAGE", "VIDEO"]);
export const CONTENT_ASSET_MIME_TYPES = Object.freeze({ IMAGE: Object.freeze(["image/jpeg", "image/png", "image/webp"]), VIDEO: Object.freeze(["video/mp4"]) });
export const CONTENT_ASSET_MAX_BYTES = Object.freeze({ IMAGE: 20 * 1024 * 1024, VIDEO: 200 * 1024 * 1024 });
export const CONTENT_ASSET_QUOTA = Object.freeze({ workspaceBytes: 1024 * 1024 * 1024, assetCount: 1000 });
export const CONTENT_ASSET_RETENTION_MS = Object.freeze({ UPLOADING: 24 * 60 * 60 * 1000, FAILED: 72 * 60 * 60 * 1000, REJECTED: 24 * 60 * 60 * 1000 });

export class ContentAssetPolicyError extends Error {
  constructor(code) { super(code); this.name = "ContentAssetPolicyError"; this.code = code; this.status = code === "CONTENT_ASSET_TOO_LARGE" || code === "CONTENT_ASSET_QUOTA_EXCEEDED" ? 413 : 400; }
}
const fail = (code) => { throw new ContentAssetPolicyError(code); };
const unsafeFilenameControl = (character) => {
  const code = character.codePointAt(0);
  return code <= 0x1f || (code >= 0x7f && code <= 0x9f) || code === 0x061c || code === 0x200e || code === 0x200f || (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069);
};

export function validateDeclaredAsset({ mediaType, declaredMimeType, declaredByteSize, declaredSha256 }) {
  if (!CONTENT_ASSET_MEDIA_TYPES.includes(mediaType)) fail("CONTENT_ASSET_MEDIA_UNSUPPORTED");
  if (!CONTENT_ASSET_MIME_TYPES[mediaType].includes(declaredMimeType)) fail("CONTENT_ASSET_MEDIA_UNSUPPORTED");
  if (!Number.isInteger(declaredByteSize) || declaredByteSize <= 0) fail("CONTENT_ASSET_INVALID");
  if (declaredByteSize > CONTENT_ASSET_MAX_BYTES[mediaType]) fail("CONTENT_ASSET_TOO_LARGE");
  if (typeof declaredSha256 !== "string" || !/^[0-9a-f]{64}$/.test(declaredSha256)) fail("CONTENT_ASSET_INVALID");
  return Object.freeze({ mediaType, declaredMimeType, declaredByteSize, declaredSha256 });
}

export function sanitizeOriginalFilename(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") fail("CONTENT_ASSET_INVALID");
  let filename = value.normalize("NFC").replaceAll("\\", "/").split("/").pop() || "";
  filename = [...filename].filter((character) => !unsafeFilenameControl(character)).join("").replace(/\s+/gu, " ").replace(/^\.+|[.\s]+$/gu, "");
  let result = "";
  for (const character of [...filename].slice(0, 180)) { if (Buffer.byteLength(result + character, "utf8") > 255) break; result += character; }
  if (!result) fail("CONTENT_ASSET_INVALID");
  return result;
}

export function calculateContentAssetQuotaUsage(assets) {
  let bytes = 0; let count = 0;
  for (const asset of assets) if (asset.status !== "DELETED") { count += 1; bytes += Math.max(asset.declaredByteSize || 0, asset.byteSize || 0); }
  return Object.freeze({ bytes, count });
}

export function assertContentAssetQuota(usage, declaredByteSize) {
  if (usage.count + 1 > CONTENT_ASSET_QUOTA.assetCount || usage.bytes + declaredByteSize > CONTENT_ASSET_QUOTA.workspaceBytes) fail("CONTENT_ASSET_QUOTA_EXCEEDED");
}

export function contentAssetRetentionDecision(asset, now = new Date()) {
  if (asset.status === "DELETING") return Object.freeze({ eligible: true, action: "RETRY_DELETE" });
  const retention = CONTENT_ASSET_RETENTION_MS[asset.status];
  if (!retention) return Object.freeze({ eligible: false, action: null });
  const basis = Date.parse(asset.updatedAt || asset.createdAt);
  return Object.freeze({ eligible: Number.isFinite(basis) && now.getTime() >= basis + retention, action: "REQUEST_DELETE" });
}
