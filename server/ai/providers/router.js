import { resolveProvider } from "./registry.js";

export function routeProvider({ provider, capability = "chat" } = {}) {
  return resolveProvider({ provider, capability });
}
