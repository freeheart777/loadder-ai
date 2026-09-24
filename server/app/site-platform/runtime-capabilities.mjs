import { resolveCapabilities } from "./capability-resolver.mjs";
import { buildCapabilityManifest, readCapabilityManifest } from "./publish-manifest.mjs";

// ADR-004 runtime capability context (PR 3). Used by the public routers only;
// renderers stay unaware of capabilities.

/**
 * Capabilities of a published site: the v2 manifest when present, otherwise
 * derived from the snapshot content (pre-v2 versions; the row is never migrated).
 * @returns {{ capabilities: string[], sectionTypes: string[], source: "manifest" | "derived" }}
 */
export function publishedCapabilityContext(published) {
  return readCapabilityManifest(published?.version, published?.project);
}

/**
 * Capabilities of an unpublished draft (preview), which has no manifest.
 * @returns {{ capabilities: string[], sectionTypes: string[], source: "draft" }}
 */
export function draftCapabilityContext(project) {
  const { capabilities, sectionTypes } = buildCapabilityManifest(project, project?.content);
  return { capabilities, sectionTypes, source: "draft" };
}

/**
 * Whether the public runtime loads the commerce catalog for this project.
 * Manifest capabilities are metadata only: a manifest records the siteType at
 * publish time, while the runtime must follow the project's current siteType.
 * The decision therefore re-resolves from the current siteType, which keeps the
 * STORE-only rule (capability-resolver) authoritative.
 */
export function commerceEnabled(project) {
  return resolveCapabilities({ siteType: project?.siteType }, {}).capabilities.includes("commerce");
}
