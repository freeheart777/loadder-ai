// One policy for every author-controlled link that reaches a published page.
//
// Escaping makes text safe; it does not make a URL scheme safe. A published
// href is therefore allow-listed, not sanitised: anything outside the supported
// set is REJECTED, never rewritten into something that happens to be valid.
//
// Ported from the audited PR #246 policy; the client mirror is
// src/components/store-studio-v16/linkPolicy.ts.

const ALLOWED_PROTOCOLS = new Set(["https:", "mailto:", "tel:"]);
const CONTROL = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;
const UNSAFE_PATH = /[\x00-\x20"'<>\\]/;

// Strip the obfuscation browsers tolerate when parsing a scheme: surrounding
// whitespace, embedded control characters (ignored inside "java\tscript:") and
// percent-encoding.
function canonicalize(value) {
  let raw = String(value ?? "").trim().replace(CONTROL, "");
  for (let pass = 0; pass < 3; pass += 1) {
    let decoded;
    try { decoded = decodeURIComponent(raw); } catch { return null; }
    decoded = decoded.replace(CONTROL, "").trim();
    if (decoded === raw) break;
    raw = decoded;
  }
  return raw;
}

const hasScheme = (value) => /^[a-z][a-z0-9+.-]*:/i.test(value);

// A safe public href, or null when the link must not be published.
// Supported: an in-page anchor, a site-internal path, https, mailto and tel.
// Everything else (javascript:, data:, vbscript:, file:, about:, and the
// protocol-relative //host form) is rejected. The decision is made on the
// fully decoded form, but the author's own (control-stripped) value is what is
// returned, so an encoded %2F or %26 keeps its meaning.
export function safePublicHref(value) {
  const raw = canonicalize(value);
  if (raw === null || !raw) return null;
  const own = String(value ?? "").trim().replace(CONTROL, "");
  if (raw.startsWith("//") || own.startsWith("//")) return null;
  if (raw.startsWith("#")) return /^#[A-Za-z0-9_\-\p{Script=Arabic}]*$/u.test(raw) && own.startsWith("#") ? own : null;
  if (raw.startsWith("/")) return UNSAFE_PATH.test(own) || !own.startsWith("/") ? null : own;
  if (!hasScheme(raw)) return /^[A-Za-z0-9_\-./\p{Script=Arabic}]+$/u.test(raw) && !raw.includes("..") && !hasScheme(own) && UNSAFE_PATH.test(own) === false ? own : null;
  let decoded;
  try { decoded = new URL(raw); } catch { return null; }
  if (!ALLOWED_PROTOCOLS.has(decoded.protocol)) return null;
  if (decoded.protocol === "https:" && !decoded.hostname) return null;
  let parsed;
  try { parsed = new URL(own); } catch { return null; }
  if (parsed.protocol !== decoded.protocol) return null;
  return parsed.href;
}

export const isSafePublicHref = (value) => safePublicHref(value) !== null;

// Media URLs have a narrower rule: an https URL or an inline raster image (never SVG).
export function safePublicImageUrl(value) {
  const raw = canonicalize(value);
  if (raw === null || !raw) return null;
  if (/^data:image\/(png|jpeg|jpg|webp|gif|avif);base64,[A-Za-z0-9+/=]+$/i.test(raw)) return raw;
  let parsed;
  try { parsed = new URL(raw); } catch { return null; }
  return parsed.protocol === "https:" && parsed.hostname ? parsed.href : null;
}
