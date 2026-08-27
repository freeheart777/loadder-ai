import { resolveProvider } from "./registry.js";

export function routeProvider({ provider = "cloudflare", capability = "chat", fallback = [] } = {}) {
  const candidates = [provider, ...fallback].filter(Boolean);
  let lastError;

  for (const candidate of [...new Set(candidates)]) {
    try {
      return resolveProvider({ provider: candidate, capability });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error(`No AI provider available for capability: ${capability}`);
}
