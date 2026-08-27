import { getProvider, listProviders, resolveProvider } from "./registry.js";

export { getProvider, listProviders, resolveProvider };

export async function runAI({
  provider = "cloudflare",
  capability = "chat",
  system,
  user,
  maxTokens,
  temperature,
}) {
  const entry = resolveProvider({ provider, capability });

  return entry.run({
    system,
    user,
    maxTokens,
    temperature,
  });
}
