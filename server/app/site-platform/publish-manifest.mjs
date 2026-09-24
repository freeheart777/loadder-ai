import { resolveCapabilities } from "./capability-resolver.mjs";
import { siteRegistry } from "./capabilities.mjs";

// ADR-004 §5: capability metadata for publish snapshots. Additive fields on the
// existing site_publish_versions.manifest_json. Stored content is never read
// back into or rewritten by this module. Not used by rendering yet.

export const MANIFEST_VERSION = 2;

const sectionsOf = (content) => {
  const v16 = content?.storeBuilderV16;
  if (!v16 || typeof v16 !== "object") return [];
  const pages = Array.isArray(v16.pages) ? v16.pages : [];
  return [
    ...(Array.isArray(v16.sections) ? v16.sections : []),
    ...pages.flatMap((page) => (Array.isArray(page?.sections) ? page.sections : [])),
  ].filter((section) => section && typeof section === "object" && section.enabled !== false);
};

/**
 * Capability fields for a publish manifest. Never throws: unknown capabilities
 * and unknown section types are reported, not rejected.
 */
export function buildCapabilityManifest(project, content) {
  const { capabilities, unregistered } = resolveCapabilities(project, content);
  const sectionTypes = new Set();
  const unknownSectionTypes = new Set();
  for (const section of sectionsOf(content)) {
    const type = siteRegistry.resolveSectionType(section.type);
    if (type) sectionTypes.add(type);
    else if (typeof section.type === "string" && section.type) unknownSectionTypes.add(section.type);
  }
  return {
    manifestVersion: MANIFEST_VERSION,
    capabilities,
    unregisteredCapabilities: unregistered,
    sectionTypes: [...sectionTypes].sort(),
    unknownSectionTypes: [...unknownSectionTypes].sort(),
  };
}

/**
 * Capability metadata of a publish version. Versions published before
 * manifestVersion 2 carry none, so it is derived from their snapshot content
 * on read; the stored row is never migrated.
 */
export function readCapabilityManifest(version, project) {
  const manifest = version?.manifest && typeof version.manifest === "object" ? version.manifest : {};
  if (manifest.manifestVersion >= MANIFEST_VERSION && Array.isArray(manifest.capabilities) && Array.isArray(manifest.sectionTypes)) {
    return { capabilities: manifest.capabilities, sectionTypes: manifest.sectionTypes, source: "manifest" };
  }
  const derived = buildCapabilityManifest({ siteType: project?.siteType ?? manifest.siteType }, version?.content);
  return { capabilities: derived.capabilities, sectionTypes: derived.sectionTypes, source: "derived" };
}
