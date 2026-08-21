import { isIP } from "node:net";

function unsafeIpv4(host) {
  const p = host.split(".").map(Number);
  return p[0] === 10 || p[0] === 127 || p[0] === 0 || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127) || p[0] >= 224;
}

export function normalizePublicUrl(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 2048) throw new Error("Canonical URL is invalid.");
  let url;
  try { url = new URL(value); } catch { throw new Error("Canonical URL is invalid."); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("Unsupported URL protocol.");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host === "metadata.google.internal") throw new Error("Private or local URLs are forbidden.");
  if (isIP(host) === 4 && unsafeIpv4(host)) throw new Error("Private or reserved IP addresses are forbidden.");
  if (isIP(host) === 6 && (host === "::1" || host === "::" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe8") || host.startsWith("fe9") || host.startsWith("fea") || host.startsWith("feb"))) throw new Error("Private or reserved IP addresses are forbidden.");
  url.hash = "";
  url.hostname = isIP(host) === 6 ? `[${host}]` : host;
  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) url.port = "";
  return url.toString();
}
