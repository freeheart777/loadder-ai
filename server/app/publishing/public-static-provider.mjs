import { readFileSync } from "node:fs";
import { join } from "node:path";
import { atomicWriteFile } from "../persistence/atomic-file-write.mjs";

const mime = (path) => path.endsWith(".html") || path === "index.html" ? "text/html; charset=utf-8" : path.endsWith(".xml") ? "application/xml; charset=utf-8" : path.endsWith(".txt") ? "text/plain; charset=utf-8" : path.endsWith(".json") ? "application/json; charset=utf-8" : "application/octet-stream";
const safe = (path) => typeof path === "string" && path.length <= 300 && !path.includes("\0") && !path.includes("..") && /^[a-zA-Z0-9/_-]+(?:\.[a-zA-Z0-9]+)?$/.test(path);

export function createPublicStaticProvider({ nodeEnv = "development", staticDirectory = "", publicBaseUrl = "" } = {}) {
  const production = nodeEnv === "production", base = String(publicBaseUrl || "").replace(/\/$/, ""), configured = !production || Boolean(staticDirectory && /^https:\/\//.test(base)), memory = new Map();
  return Object.freeze({ configured, managedDomainConfigured: /^https:\/\//.test(base), publicBaseUrl: base,
    publish({ root, files }) { if (!configured) return { available: false, failureCode: "PUBLIC_PUBLISHING_NOT_CONFIGURED" }; for (const [path, body] of Object.entries(files)) { if (!safe(path) || typeof body !== "string") throw Object.assign(new Error(), { code: "PUBLIC_ARTIFACT_INVALID" }); const key = `${root}/${path}`; if (staticDirectory) atomicWriteFile(join(staticDirectory, key), body); memory.set(key, body); } return { available: true, root }; },
    resolve(key) { if (!safe(key)) return null; let body = memory.get(key); if (body === undefined && staticDirectory) { try { body = readFileSync(join(staticDirectory, key), "utf8"); } catch {} } return body === undefined ? null : { body, contentType: mime(key) }; },
  });
}

export function createUnavailablePublicMediaProvider() { return Object.freeze({ configured: false, kind: "UNAVAILABLE", publish() { return { available: false, failureCode: "PUBLIC_MEDIA_NOT_CONFIGURED" }; } }); }
export function createDeterministicPublicMediaProvider({ publicBaseUrl = "https://media.loadder.test" } = {}) { const base = publicBaseUrl.replace(/\/$/, ""); return Object.freeze({ configured: true, kind: "TEST", publish(asset) { const sha = asset.canonicalSha256 || asset.contentSha256, objectKey = `public/media/${sha.slice(0, 2)}/${sha}`; return { available: true, objectKey, publicUrl: `${base}/${objectKey}` }; } }); }
