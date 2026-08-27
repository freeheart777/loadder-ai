import { runCloudflare } from "./cloudflare.js";

const providers = new Map([
  ["cloudflare", {
    id: "cloudflare",
    capabilities: ["chat"],
    run: runCloudflare,
    health: () => Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN),
  }],
]);

export function listProviders() {
  return [...providers.values()].map(({ run, ...meta }) => ({
    ...meta,
    healthy: meta.health ? meta.health() : true,
  }));
}

export function getProvider(provider = "cloudflare") {
  const entry = providers.get(provider);
  if (!entry) throw new Error(`Unsupported AI provider: ${provider}`);
  return entry;
}

export function resolveProvider({ provider = "cloudflare", capability = "chat" } = {}) {
  const entry = getProvider(provider);
  if (!entry.capabilities.includes(capability)) {
    throw new Error(`Provider ${provider} does not support capability: ${capability}`);
  }
  if (entry.health && !entry.health()) {
    throw new Error(`AI provider ${provider} is not configured or healthy`);
  }
  return entry;
}
