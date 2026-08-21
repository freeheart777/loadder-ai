import dotenv from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

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

function parseOrigins(value) {
  return String(value || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const nodeEnv = process.env.NODE_ENV || "development";
const authHashSecret =
  process.env.AUTH_HASH_SECRET ||
  (nodeEnv === "production"
    ? null
    : "loadder-development-only-otp-secret");

if (!authHashSecret) {
  throw new Error("AUTH_HASH_SECRET is required in production.");
}

export const environment = Object.freeze({
  nodeEnv,
  apiHost: process.env.API_HOST || "127.0.0.1",
  apiPort: parsePort(
    process.env.API_PORT || process.env.PORT,
    3001
  ),
  clientOrigins: parseOrigins(process.env.CLIENT_ORIGINS),
  openAIConfigured: Boolean(process.env.OPENAI_API_KEY),
  cloudflareAIConfigured: Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID &&
      process.env.CLOUDFLARE_API_TOKEN
  ),
  authHashSecret,
  exposeDevelopmentOtp:
    nodeEnv !== "production" &&
    process.env.AUTH_EXPOSE_DEV_OTP === "true",
});
