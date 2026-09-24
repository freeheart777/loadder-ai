import { createWebsitePlatformDefinition } from "../services/website-platform-definition.mjs";

// ADR-004 capability resolver. Pure: reads the project and its content, never
// writes. Not wired into rendering or runtime yet (Phase 1).

/** Canonical capabilities, in output order. */
export const SUPPORTED_CAPABILITIES = Object.freeze(["core", "commerce", "payments", "forms", "blog", "people", "booking", "courses"]);

/** Recognized but not loadable until a later phase ships them. */
export const PENDING_CAPABILITIES = Object.freeze(["booking", "courses"]);

/** Legacy names written by website-platform-definition / site-types.ts → canonical name. */
export const LEGACY_CAPABILITY_MAP = Object.freeze({
  catalog: "commerce",
  lead: "forms",
  team: "people",
  content: "blog",
  landing: "core",
  location: "core",
  portfolio: "core",
});

/** Integrations, never loaded by the website runtime. */
const INTEGRATION_CAPABILITIES = new Set(["analytics", "ads"]);

/** Current compatibility rule: commerce is gated by siteType, not by capabilities (changes in ADR-004 phase 3). */
const COMMERCE_CAPABILITIES = new Set(["commerce", "payments"]);
const isStore = (project) => String(project?.siteType || "").toUpperCase() === "STORE";

const declaredCapabilities = (project, content) => {
  const stored = content?.websitePlatform?.capabilities;
  if (Array.isArray(stored)) return { names: stored, source: "document" };
  return { names: createWebsitePlatformDefinition({ siteType: project?.siteType }).capabilities, source: "archetype" };
};

/**
 * Resolve a site's capabilities.
 * @returns {{ capabilities: string[], unregistered: string[], ignored: string[], source: "document" | "archetype" }}
 *   capabilities — canonical and loadable; unregistered — recognized but pending;
 *   ignored — integrations and unknown names.
 */
export function resolveCapabilities(project, content = project?.content) {
  const { names, source } = declaredCapabilities(project, content);
  const found = new Set(["core"]);
  const ignored = new Set();
  for (const raw of names) {
    const name = typeof raw === "string" ? raw.trim().toLowerCase() : "";
    const canonical = LEGACY_CAPABILITY_MAP[name] || name;
    if (SUPPORTED_CAPABILITIES.includes(canonical)) found.add(canonical);
    else if (name) ignored.add(INTEGRATION_CAPABILITIES.has(name) ? name : String(raw).trim());
  }
  for (const name of COMMERCE_CAPABILITIES) {
    if (isStore(project)) found.add(name);
    else found.delete(name);
  }
  const ordered = SUPPORTED_CAPABILITIES.filter((name) => found.has(name));
  return {
    capabilities: ordered.filter((name) => !PENDING_CAPABILITIES.includes(name)),
    unregistered: ordered.filter((name) => PENDING_CAPABILITIES.includes(name)),
    ignored: [...ignored].sort(),
    source,
  };
}
