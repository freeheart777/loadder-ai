import crypto from "node:crypto";
import { normalizePublicUrl } from "./public-url-safety.mjs";

const TYPES = new Set(["web_document","news_article","social_post","social_comment","social_mention","review","engagement_metric"]);
const DIRECTIONS = new Set(["rtl","ltr"]);
const clean = (value, max) => value == null || value === "" ? null : String(value).trim().slice(0, max);
const iso = (value, field) => {
  if (value == null || value === "") return null;
  if (!Number.isFinite(Date.parse(value))) throw new Error(`${field} is invalid.`);
  return new Date(value).toISOString();
};
const object = (value, field) => {
  if (value == null) return {};
  if (typeof value !== "object" || Array.isArray(value)) throw new Error(`${field} must be an object.`);
  return value;
};
function safeMetadata(value) {
  const result=object(value,"sourceMetadata"),serialized=JSON.stringify(result);
  if(serialized.length>8000)throw new Error("sourceMetadata is too large.");
  if(/(?:password|secret|token|authorization|api[_-]?key|credential)/i.test(Object.keys(result).join(" ")))throw new Error("Credential fields are forbidden in sourceMetadata.");
  return result;
}
function normalizeEngagement(input) {
  const value = object(input, "engagement");
  const result = {};
  for (const key of ["likes","comments","shares","views","saves","clicks","rating","ratingScale"]) {
    if (value[key] !== undefined && value[key] !== null) {
      const n = Number(value[key]);
      if (!Number.isFinite(n) || n < 0) throw new Error(`engagement.${key} is invalid.`);
      result[key] = n;
    }
  }
  return result;
}
export function normalizeListeningRecord(input, { provider, sourceCategory, collectedAt, maxTextLength, retentionClass, retentionDays }) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Listening item must be an object.");
  if (Object.hasOwn(input,"workspaceId") || Object.hasOwn(input,"workspace_id")) throw new Error("Workspace ownership is server-resolved.");
  const canonicalType = clean(input.canonicalType, 50);
  if (!TYPES.has(canonicalType)) throw new Error("Canonical listening type is unsupported.");
  const externalObjectId = clean(input.externalObjectId, 300);
  const canonicalUrl = normalizePublicUrl(input.canonicalUrl);
  const text = clean(input.text, maxTextLength)?.replace(/\s+/gu," ") || null;
  const title = clean(input.title, 500)?.replace(/\s+/gu," ") || null;
  const contentHash = text || title ? crypto.createHash("sha256").update(`${title || ""}\n${text || ""}`).digest("hex") : null;
  const publishedAt = iso(input.publishedAt,"publishedAt");
  const identityKey = externalObjectId ? `external:${externalObjectId}` : canonicalUrl ? `url:${canonicalUrl}` : contentHash ? `content:${contentHash}:${(publishedAt || collectedAt).slice(0,10)}` : null;
  if (!identityKey) throw new Error("An external ID, canonical URL, or textual identity is required.");
  const scriptDirection = clean(input.scriptDirection,3);
  if (scriptDirection && !DIRECTIONS.has(scriptDirection)) throw new Error("scriptDirection is invalid.");
  const retentionUntil = retentionDays ? new Date(Date.parse(collectedAt) + retentionDays * 86400000).toISOString() : null;
  const objectStorageReference=clean(input.objectStorageReference,1000);
  if(objectStorageReference&&!/^(object|s3|gs|azure):\/\/[A-Za-z0-9._~!$&'()*+,;=:@/-]+$/.test(objectStorageReference))throw new Error("objectStorageReference is invalid.");
  return {
    canonicalType, sourceCategory, provider: provider.toLowerCase(), externalObjectId, identityKey,
    canonicalUrl, parentExternalId: clean(input.parentExternalId,300), authorExternalReference: clean(input.authorExternalReference,300),
    publishedAt, collectedAt, language: clean(input.language,20), locale: clean(input.locale,40), scriptDirection,
    region: clean(input.region,30), title, normalizedText: text, contentHash,
    engagement: normalizeEngagement(input.engagement), sourceMetadata: safeMetadata(input.sourceMetadata),
    objectStorageReference, retentionClass, retentionUntil,
  };
}
