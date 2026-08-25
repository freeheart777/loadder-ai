import dotenv from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { assertBootReady, createProductionConfiguration } from "./production-configuration.mjs";

const configDirectory = dirname(fileURLToPath(import.meta.url));
const serverDirectory = join(configDirectory, "../..");
const projectDirectory = join(serverDirectory, "..");

dotenv.config({
  path: [
    join(projectDirectory, ".env"),
    join(serverDirectory, ".env"),
    join(serverDirectory, ".env.cloudflare"),
  ],
  quiet: true,
});

function parsePort(value, fallback) {
  const port = Number(value);

  if (Number.isInteger(port) && port > 0 && port <= 65535) {
    return port;
  }

  return fallback;
}

function parseFeatureOverrides(value) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch {
    throw new Error("PRODUCT_FEATURE_OVERRIDES must be a valid JSON object.");
  }
}

function parsePositiveInteger(value) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseSmsParameter(value) {
  const parameter = String(value || "CODE").trim();
  return /^[A-Z][A-Z0-9_]{0,31}$/.test(parameter) ? parameter : null;
}

const productionConfiguration = createProductionConfiguration(process.env);
const nodeEnv = productionConfiguration.nodeEnv;
const authHashSecret =
  process.env.AUTH_HASH_SECRET ||
  (nodeEnv === "production"
    ? null
    : "loadder-development-only-otp-secret");

if (nodeEnv === "production") assertBootReady(productionConfiguration);

export const environment = Object.freeze({
  nodeEnv,
  apiHost: process.env.API_HOST || "127.0.0.1",
  apiPort: parsePort(
    process.env.API_PORT || process.env.PORT,
    3001
  ),
  clientOrigins: productionConfiguration.clientOrigins,
  productionConfiguration,
  openAIConfigured: Boolean(process.env.OPENAI_API_KEY),
  cloudflareAIConfigured: Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID &&
      process.env.CLOUDFLARE_API_TOKEN
  ),
  authHashSecret,
  exposeDevelopmentOtp:
    nodeEnv !== "production" &&
    process.env.AUTH_EXPOSE_DEV_OTP === "true",
  seedDemoData:
    nodeEnv !== "production" && process.env.LOADDER_SEED_DEMO_DATA !== "false",
  internalAccessToken: process.env.LOADDER_INTERNAL_ACCESS_TOKEN || "",
  productFeatureOverrides: parseFeatureOverrides(process.env.PRODUCT_FEATURE_OVERRIDES),
  smsIrOtp: Object.freeze({
    apiKey: process.env.SMS_IR_API_KEY || "",
    templateId: parsePositiveInteger(process.env.SMS_IR_OTP_TEMPLATE_ID),
    parameterName: parseSmsParameter(process.env.SMS_IR_OTP_PARAMETER),
  }),
  contentAssetStorage: Object.freeze({
    provider: process.env.CONTENT_ASSET_STORAGE_PROVIDER || "unavailable",
    accountId: process.env.R2_ACCOUNT_ID || "",
    bucket: process.env.R2_BUCKET || "",
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    mediaRuntimeAvailable: process.env.CONTENT_ASSET_FFPROBE_AVAILABLE === "true",
  }),
  landing: Object.freeze({
    staticDirectory: process.env.LANDING_STATIC_DIRECTORY || "",
    publicBaseUrl: process.env.LANDING_PUBLIC_BASE_URL || "",
    publicApiBaseUrl: process.env.LANDING_PUBLIC_API_BASE_URL || "",
    trackingSecret: process.env.LANDING_TRACKING_SECRET || (nodeEnv === "production" ? "" : "loadder-development-landing-tracking-secret-v1"),
    trackingTtlSeconds: Number(process.env.LANDING_TRACKING_TTL_SECONDS || 3600),
  }),
  publishing: Object.freeze({
    staticDirectory: process.env.PUBLIC_STATIC_DIRECTORY || "",
    publicBaseUrl: process.env.PUBLIC_BASE_URL || "",
  }),
});
