import path from "node:path";

const PLACEHOLDER = /^(?:change[-_ ]?me|replace[-_ ]?me|your[-_ ]|example|secret|password|test|todo)/i;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

function issue(list, code) { if (!list.includes(code)) list.push(code); }
function safeHttpsUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && !url.username && !url.password && !LOCAL_HOSTS.has(url.hostname) && !url.hostname.endsWith(".local") && !url.hostname.endsWith(".internal");
  } catch { return false; }
}
function validSecret(value) {
  const secret = String(value || "");
  return secret.length >= 24 && !PLACEHOLDER.test(secret.trim());
}

export function validateFrontendApiBase(value, { production = false } = {}) {
  if (!production && !value) return Object.freeze({ valid: true, value: "http://localhost:3001" });
  if (!safeHttpsUrl(value)) return Object.freeze({ valid: false, code: "CONFIG_API_BASE_INVALID" });
  return Object.freeze({ valid: true, value: String(value).replace(/\/+$/, "") });
}

export function createProductionConfiguration(env = process.env) {
  const nodeEnv = env.NODE_ENV || "development";
  if (!["development", "test", "production"].includes(nodeEnv)) throw new Error("NODE_ENV must be development, test, or production.");
  const production = nodeEnv === "production", requiredMissing = [], invalid = [], optionalUnavailable = [];
  const origins = String(env.CLIENT_ORIGINS || (production ? "" : "http://localhost:5173")).split(",").map((x) => x.trim()).filter(Boolean);
  const authSecretValid = validSecret(env.AUTH_HASH_SECRET);
  const databaseExplicit = Boolean(String(env.DATABASE_PATH || "").trim());
  const databasePath = databaseExplicit ? path.resolve(env.DATABASE_PATH) : null;
  const openaiConfigured = Boolean(String(env.OPENAI_API_KEY || "").trim());
  const landingConfigured = Boolean(env.LANDING_STATIC_DIRECTORY && safeHttpsUrl(env.LANDING_PUBLIC_BASE_URL) && safeHttpsUrl(env.LANDING_PUBLIC_API_BASE_URL) && validSecret(env.LANDING_TRACKING_SECRET));
  const websiteConfigured = Boolean(env.PUBLIC_STATIC_DIRECTORY && safeHttpsUrl(env.PUBLIC_BASE_URL));
  const smsConfigured = Boolean(env.SMS_IR_API_KEY && env.SMS_IR_OTP_TEMPLATE_ID);

  if (production) {
    if (!env.AUTH_HASH_SECRET) issue(requiredMissing, "CONFIG_AUTH_SECRET_MISSING"); else if (!authSecretValid) issue(invalid, "CONFIG_AUTH_SECRET_INVALID");
    if (!origins.length) issue(requiredMissing, "CONFIG_CLIENT_ORIGIN_MISSING");
    if (origins.some((origin) => origin === "*" || !safeHttpsUrl(origin))) issue(invalid, "CONFIG_CLIENT_ORIGIN_INVALID");
    if (env.AUTH_EXPOSE_DEV_OTP === "true") issue(invalid, "CONFIG_DEVELOPMENT_OTP_ENABLED");
    if (env.LOADDER_SEED_DEMO_DATA === "true") issue(invalid, "CONFIG_DEMO_DATA_ENABLED");
    if (!databaseExplicit) issue(requiredMissing, "CONFIG_DATABASE_PATH_MISSING");
  }
  if (!openaiConfigured) issue(optionalUnavailable, "CONFIG_OPENAI_MISSING");
  if (!landingConfigured) issue(optionalUnavailable, "CONFIG_LANDING_PUBLISHING_INCOMPLETE");
  if (!websiteConfigured) issue(optionalUnavailable, "CONFIG_WEBSITE_PUBLISHING_INCOMPLETE");
  issue(optionalUnavailable, smsConfigured ? "CONFIG_SMS_OTP_LIVE_VALIDATION_PENDING" : "CONFIG_SMS_OTP_NOT_CONFIGURED");
  if (!env.R2_ACCOUNT_ID || !env.R2_BUCKET || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) issue(optionalUnavailable, "CONFIG_R2_UNAVAILABLE");

  const bootReady = requiredMissing.length === 0 && invalid.length === 0;
  const smsOtpLiveValidated = false;
  const coreLaunchReady = bootReady && openaiConfigured && landingConfigured && websiteConfigured && smsOtpLiveValidated;
  return Object.freeze({
    nodeEnv, production, bootReady, coreLaunchReady,
    requiredMissing: Object.freeze(requiredMissing), invalid: Object.freeze(invalid), optionalUnavailable: Object.freeze(optionalUnavailable),
    clientOrigins: Object.freeze(origins), authSecretValid, database: Object.freeze({ configured: databaseExplicit, resolvedPath: databasePath, persistenceValidated: false }),
    providers: Object.freeze({ openai: openaiConfigured ? "CONFIGURED" : "NOT_CONFIGURED", smsOtp: smsConfigured ? "CODE_READY_LIVE_VALIDATION_PENDING" : "NOT_CONFIGURED" }),
    publishing: Object.freeze({ landing: landingConfigured ? "CONFIGURED" : "NOT_CONFIGURED", website: websiteConfigured ? "CONFIGURED" : "NOT_CONFIGURED" }),
  });
}

export function assertBootReady(configuration) {
  if (!configuration.bootReady) {
    const codes = [...configuration.requiredMissing, ...configuration.invalid];
    if (codes.includes("CONFIG_DEVELOPMENT_OTP_ENABLED")) throw new Error("AUTH_EXPOSE_DEV_OTP must be disabled in production. [CONFIG_DEVELOPMENT_OTP_ENABLED]");
    throw new Error(`Production configuration invalid: ${codes.join(",")}`);
  }
}
