import { createVisualPublicationDescriptor, renderStaticVisualPublication, validateVisualPublicationPage } from "../visual-publishing/visual-publisher-contract.mjs";
import { visualComponentRegistry } from "../visual-components/visual-component-registry.mjs";

export const WEBSITE_VISUAL_DESCRIPTOR_FIELD = "websiteVisualDescriptors";

const plain = value => value && Object.getPrototypeOf(value) === Object.prototype;
const requestKeys = new Set(["sectionId", "componentId", "componentVersion", "props", "assetRefs"]);
const bindingKeys = new Set(["sectionId", "descriptor"]);
const fail = code => { const error = new Error(code); error.code = code; throw error; };

function assertSectionIds(blueprint, bindings) {
  const sections = new Set(blueprint.sections.map(section => section.id));
  const locations = new Set();
  for (const binding of bindings) {
    if (!plain(binding) || Object.keys(binding).some(key => !bindingKeys.has(key)) || typeof binding.sectionId !== "string" || !sections.has(binding.sectionId)) fail("VISUAL_RESTRICTION_VIOLATION");
    const location = `${binding.sectionId}:${binding.descriptor?.componentId}:${binding.descriptor?.componentVersion}`;
    if (locations.has(location)) fail("VISUAL_RESTRICTION_VIOLATION");
    locations.add(location);
  }
}

export function createWebsiteVisualBindings(blueprint, requests, { registry = visualComponentRegistry } = {}) {
  if (!Array.isArray(requests)) fail("VISUAL_PROPS_INVALID");
  const bindings = requests.map(request => {
    if (!plain(request) || Object.keys(request).some(key => !requestKeys.has(key))) fail("VISUAL_PROPS_INVALID");
    const { sectionId, ...descriptorInput } = request;
    return Object.freeze({ sectionId, descriptor: createVisualPublicationDescriptor(descriptorInput, { registry }) });
  });
  assertSectionIds(blueprint, bindings);
  validateVisualPublicationPage(bindings.map(binding => binding.descriptor), { registry });
  return Object.freeze(bindings);
}

export function validateWebsiteVisualBindings(blueprint, bindings, { registry = visualComponentRegistry } = {}) {
  if (!Array.isArray(bindings)) fail("VISUAL_RESTRICTION_VIOLATION");
  assertSectionIds(blueprint, bindings);
  const descriptors = validateVisualPublicationPage(bindings.map(binding => binding.descriptor), { registry });
  return Object.freeze(bindings.map((binding, index) => Object.freeze({ sectionId: binding.sectionId, descriptor: descriptors[index] })));
}

export function renderWebsiteVisualBindings(blueprint, bindings, options = {}) {
  const validated = validateWebsiteVisualBindings(blueprint, bindings, options);
  return Object.freeze(validated.map(binding => {
    const publication = renderStaticVisualPublication([binding.descriptor], options);
    const scope = `ld-visual-scope-${publication.checksum.slice(0, 16)}`;
    const scopedCss = publication.css.replaceAll(".ld-", `.${scope} .ld-`);
    return Object.freeze({ sectionId: binding.sectionId, descriptor: binding.descriptor, markup: `<div class="ld-visual-host ${scope}" data-loadder-visual-checksum="${publication.checksum}">${publication.markup}</div>`, css: `.${scope}{position:absolute;inset:0;pointer-events:none}.${scope} .ld-visual{position:absolute;inset:0}${scopedCss}`, checksum: publication.checksum });
  }));
}

export function splitWebsiteBlueprint(storedBlueprint) {
  const { [WEBSITE_VISUAL_DESCRIPTOR_FIELD]: bindings = [], ...landingBlueprint } = storedBlueprint;
  return Object.freeze({ landingBlueprint, bindings });
}
