import { landingHash } from "../landing/landing-contracts.mjs";
import { renderWebsiteVisualBindings, splitWebsiteBlueprint } from "./website-visual-revision.mjs";

const visualSummary = binding => Object.freeze({
  sectionId: binding.sectionId,
  componentId: binding.descriptor.componentId,
  componentVersion: binding.descriptor.componentVersion,
  manifestVersion: binding.descriptor.manifestVersion,
  manifestFingerprint: binding.descriptor.manifestFingerprint,
  admissionPolicyVersion: binding.descriptor.admissionPolicyVersion,
  publisherContractVersion: binding.descriptor.publisherContractVersion,
  runtimeTier: binding.descriptor.runtimeTier,
  descriptorChecksum: binding.checksum,
});

export function createWebsitePublisher({ landingPublisher, visualRegistry } = {}) {
  return Object.freeze({
    configured: landingPublisher.configured,
    publish({ project, pages }) {
      if (!landingPublisher.configured) return Object.freeze({ available: false, failureCode: "WEBSITE_PUBLISHER_NOT_CONFIGURED" });
      const build = navigation => pages.map(({ page, blueprint }) => {
        const { landingBlueprint, bindings } = splitWebsiteBlueprint(blueprint.blueprint);
        const visuals = renderWebsiteVisualBindings(landingBlueprint, bindings, { registry: visualRegistry });
        const artifact = landingPublisher.publishRegisteredBlueprint({ project: { slug: `website-${project.slug}-${page.path.replaceAll("/", "-") || "home"}` }, blueprint: { ...blueprint, blueprint: landingBlueprint }, navigation, visualPublication: visuals });
        if (!artifact.available) throw Error("WEBSITE_PUBLISHER_NOT_CONFIGURED");
        return { pageId: page.id, name: page.name, path: page.path, blueprintId: blueprint.id, blueprintVersion: blueprint.version, rendererVersion: blueprint.rendererVersion, componentRegistryVersion: blueprint.componentRegistryVersion, artifactPath: artifact.path, artifactChecksum: artifact.artifactChecksum, host: artifact.host, visualDescriptors: Object.freeze(visuals.map(visualSummary)) };
      });
      const initial = build([]), navigation = initial.map(item => ({ label: item.name, href: `/${item.artifactPath}` })), rendered = build(navigation), artifacts = rendered.map(({ host: _host, ...item }) => Object.freeze(item)), manifest = Object.freeze({ schemaVersion: 1, websiteProjectId: project.id, siteSlug: project.slug, themeVersion: 1, pages: Object.freeze(artifacts) });
      return Object.freeze({ available: true, host: rendered[0]?.host || "local", basePath: `websites/${project.slug}`, manifest, manifestHash: landingHash(manifest) });
    },
    publicUrl(publication) { const home = publication.manifest.pages.find(item => item.path === "/") || publication.manifest.pages[0], path = home?.artifactPath || publication.basePath; return publication.host && publication.host !== "local" ? `${publication.host}/${path}` : `/${path}`; },
  });
}
