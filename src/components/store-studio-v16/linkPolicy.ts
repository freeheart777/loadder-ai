// Client mirror of the server's public link policy (server/app/services/public-link-policy.mjs).
// The SERVER is the authority for what gets published; this keeps the live React
// runtime from rendering a link the server-rendered page would have refused.

const ALLOWED_PROTOCOLS = new Set(["https:", "mailto:", "tel:"]);
const CONTROL = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;
const UNSAFE_PATH = /[\x00-\x20"'<>\\]/;

function canonicalize(value: string): string | null {
  let raw = String(value ?? "").trim().replace(CONTROL, "");
  for (let pass = 0; pass < 3; pass += 1) {
    let decoded: string;
    try { decoded = decodeURIComponent(raw); } catch { return null; }
    decoded = decoded.replace(CONTROL, "").trim();
    if (decoded === raw) break;
    raw = decoded;
  }
  return raw;
}

/** A safe public href, or null when the link must not be rendered. */
export function safePublicHref(value: string | undefined): string | null {
  const raw = canonicalize(value ?? "");
  if (raw === null || !raw) return null;
  const own = String(value ?? "").trim().replace(CONTROL, "");
  if (raw.startsWith("//") || own.startsWith("//")) return null;
  if (raw.startsWith("#")) return /^#[A-Za-z0-9_\-\p{Script=Arabic}]*$/u.test(raw) && own.startsWith("#") ? own : null;
  if (raw.startsWith("/")) return UNSAFE_PATH.test(own) || !own.startsWith("/") ? null : own;
  const hasScheme = (text: string) => /^[a-z][a-z0-9+.-]*:/i.test(text);
  if (!hasScheme(raw)) return /^[A-Za-z0-9_\-./\p{Script=Arabic}]+$/u.test(raw) && !raw.includes("..") && !hasScheme(own) && !UNSAFE_PATH.test(own) ? own : null;
  let decoded: URL;
  try { decoded = new URL(raw); } catch { return null; }
  if (!ALLOWED_PROTOCOLS.has(decoded.protocol)) return null;
  if (decoded.protocol === "https:" && !decoded.hostname) return null;
  try {
    const parsed = new URL(own);
    return parsed.protocol === decoded.protocol ? parsed.href : null;
  } catch { return null; }
}
