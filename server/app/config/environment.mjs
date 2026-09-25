import dotenv from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const configDirectory = dirname(fileURLToPath(import.meta.url));
const serverDirectory = join(configDirectory, "../..");
const projectDirectory = join(serverDirectory, "..");

dotenv.config({ path: [join(projectDirectory, ".env"), join(serverDirectory, ".env"), join(serverDirectory, ".env.cloudflare")], quiet: true });

function parsePort(value, fallback) { const port = Number(value); return Number.isInteger(port) && port > 0 && port <= 65535 ? port : fallback; }
// Express "trust proxy" as an exact proxy hop count. Off by default; true/"*"/IP lists are refused
// because trusting every hop lets clients forge X-Forwarded-For and dodge per-IP rate limits.
export function parseTrustProxy(value) {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "0" || raw.toLowerCase() === "false") return false;
  const hops = Number(raw);
  if (!/^\d+$/.test(raw) || hops < 1 || hops > 10) throw new Error(`TRUST_PROXY must be a proxy hop count between 1 and 10 (got "${raw}").`);
  return hops;
}
// Public-site runtime (server/public-site-server.mjs). PUBLIC_SITE_BASE_URL is the
// origin visitors use; it is what published /s/:slug and preview URLs are built on.
export function parsePublicSiteBaseUrl(value, fallback) {
  const raw = String(value ?? "").trim() || fallback;
  let url;
  try { url = new URL(raw); } catch { throw new Error(`PUBLIC_SITE_BASE_URL must be an absolute http(s) URL (got "${raw}").`); }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error(`PUBLIC_SITE_BASE_URL must use http or https (got "${raw}").`);
  return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
}
function parseOrigins(value) { return String(value || "http://localhost:5173").split(",").map((origin) => origin.trim()).filter(Boolean); }

const nodeEnv = process.env.NODE_ENV || "development";
const apiHost = process.env.API_HOST || "127.0.0.1";
const apiPort = parsePort(process.env.API_PORT || process.env.PORT, 3001);
const publicSiteHost = process.env.PUBLIC_SITE_HOST || apiHost;
const publicSitePort = parsePort(process.env.PUBLIC_SITE_PORT, apiPort + 1);
const authHashSecret = process.env.AUTH_HASH_SECRET || (nodeEnv === "production" ? null : "loadder-development-only-otp-secret");
if (!authHashSecret) throw new Error("AUTH_HASH_SECRET is required in production.");

export const environment = Object.freeze({
  nodeEnv,
  apiHost,
  apiPort,
  publicSiteHost,
  publicSitePort,
  publicSiteBaseUrl: parsePublicSiteBaseUrl(process.env.PUBLIC_SITE_BASE_URL, `http://${publicSiteHost}:${publicSitePort}`),
  clientOrigins: parseOrigins(process.env.CLIENT_ORIGINS),
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  openAIConfigured: Boolean(process.env.OPENAI_API_KEY),
  cloudflareAIConfigured: Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN),
  supabaseStorageConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
  supabaseUrl: process.env.SUPABASE_URL || null,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || null,
  supabaseSiteAssetBucket: process.env.SUPABASE_SITE_ASSET_BUCKET || "site-assets",
  authHashSecret,
  exposeDevelopmentOtp: nodeEnv !== "production" && process.env.AUTH_EXPOSE_DEV_OTP === "true",
});
