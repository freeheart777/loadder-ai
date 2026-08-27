import { getProvider, listProviders } from "./registry.js";
import { routeProvider } from "./router.js";

export { getProvider, listProviders };

export async function runAI({
  provider = "cloudflare",
  capability = "chat",
  system,
  user,
  maxTokens,
  temperature,
}) {
  const entry = routeProvider({ provider, capability });

  return entry.run({
    system,
    user,
    maxTokens,
    temperature,
  });
}
