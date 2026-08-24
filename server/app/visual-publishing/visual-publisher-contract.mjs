import crypto from "node:crypto";
import { visualComponentRegistry } from "../visual-components/visual-component-registry.mjs";

export const VISUAL_PUBLISHER_CONTRACT_VERSION = "VISUAL_PUBLISHER_RUNTIME_V1";
export const VISUAL_PUBLICATION_STATES = Object.freeze(["PUBLISHABLE", "PUBLISHABLE_WITH_RESTRICTIONS", "PUBLISH_BLOCKED", "INCOMPATIBLE", "INSUFFICIENT_EVIDENCE"]);
export const VISUAL_PUBLICATION_REASONS = Object.freeze([
  "VISUAL_COMPONENT_NOT_FOUND", "VISUAL_COMPONENT_NOT_ADMITTED", "VISUAL_COMPONENT_PILOT_ONLY", "VISUAL_RUNTIME_TIER_UNSUPPORTED",
  "VISUAL_MANIFEST_FINGERPRINT_MISMATCH", "VISUAL_PROPS_INVALID", "VISUAL_REMOTE_CODE_FORBIDDEN", "VISUAL_ASSET_POLICY_UNSUPPORTED",
  "VISUAL_FALLBACK_REQUIRED", "VISUAL_PAGE_BUDGET_EXCEEDED", "VISUAL_RESTRICTION_VIOLATION", "VISUAL_CSP_INCOMPATIBLE",
  "VISUAL_LIGHT_RUNTIME_UNAVAILABLE", "VISUAL_PUBLISHER_CONTRACT_MISMATCH",
]);

export const VISUAL_PUBLISHER_RUNTIME_V1 = Object.freeze({
  contractVersion: VISUAL_PUBLISHER_CONTRACT_VERSION,
  supportedRuntimeTiers: Object.freeze(["STATIC"]),
  blockedRuntimeTiers: Object.freeze(["LIGHT", "INTERACTIVE", "GPU_HEAVY"]),
  allowedAdmissionStates: Object.freeze(["ADMITTED", "ADMITTED_WITH_RESTRICTIONS"]),
  allowedAssetPolicies: Object.freeze(["NO_ASSETS", "LOADDER_HOSTED", "REVIEWED_BUNDLED"]),
  requiresFallbackFor: Object.freeze(["LIGHT", "INTERACTIVE", "GPU_HEAVY"]),
  remoteCodeAllowed: false,
  webglAllowed: false,
  pageBudget: Object.freeze({ maxVisualComponentsPerPage: 4, maxLightComponentsPerPage: 0, maxInteractiveComponentsPerPage: 0, maxGpuHeavyComponentsPerPage: 0, maxCanvasCount: 0 }),
  csp: Object.freeze({ remoteScriptOrigins: false, unsafeEval: false, inlineEventHandlers: false, runtimeScriptDelivery: "UNAVAILABLE", staticStyle: "HASH_OR_ARTIFACT_CONTROLLED" }),
  pinning: Object.freeze(["componentId", "componentVersion", "manifestVersion", "admissionPolicyVersion", "manifestFingerprint", "publisherContractVersion"]),
});

export class VisualPublicationError extends Error {
  constructor(code) { super(code); this.code = code; }
}

const fail = code => { throw new VisualPublicationError(code); };
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const checksum = value => crypto.createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(canonical(value))).digest("hex");
const plainObject = value => value && Object.getPrototypeOf(value) === Object.prototype;
const inputKeys = new Set(["componentId", "componentVersion", "props", "assetRefs"]);

function validateProps(schema, props) {
  if (!plainObject(props) || Object.keys(props).some(key => !(key in schema))) fail("VISUAL_PROPS_INVALID");
  for (const [key, value] of Object.entries(props)) {
    const rule = schema[key];
    if (rule.type === "boolean" && typeof value !== "boolean") fail("VISUAL_PROPS_INVALID");
    if (rule.type === "boundedNumber" && (typeof value !== "number" || !Number.isFinite(value) || value < rule.minimum || value > rule.maximum)) fail("VISUAL_PROPS_INVALID");
    if (rule.type === "enum" && !rule.values.includes(value)) fail("VISUAL_PROPS_INVALID");
    if (["tokenReference", "assetReference"].includes(rule.type) && (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value))) fail("VISUAL_PROPS_INVALID");
  }
  return Object.freeze(canonical(props));
}

function validateAssetRefs(manifest, assetRefs) {
  if (!Array.isArray(assetRefs) || assetRefs.length > 16 || assetRefs.some(value => typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value))) fail("VISUAL_ASSET_POLICY_UNSUPPORTED");
  if (manifest.assetPolicy === "NO_ASSETS" && assetRefs.length) fail("VISUAL_ASSET_POLICY_UNSUPPORTED");
  if (!VISUAL_PUBLISHER_RUNTIME_V1.allowedAssetPolicies.includes(manifest.assetPolicy)) fail("VISUAL_ASSET_POLICY_UNSUPPORTED");
  return Object.freeze([...assetRefs]);
}

function assertPublishable(entry) {
  if (!entry) fail("VISUAL_COMPONENT_NOT_FOUND");
  const { manifest, admission } = entry;
  if (admission.state === "PILOT_ONLY") fail("VISUAL_COMPONENT_PILOT_ONLY");
  if (!VISUAL_PUBLISHER_RUNTIME_V1.allowedAdmissionStates.includes(admission.state)) fail("VISUAL_COMPONENT_NOT_ADMITTED");
  if (manifest.runtimeTier === "LIGHT") fail("VISUAL_LIGHT_RUNTIME_UNAVAILABLE");
  if (!VISUAL_PUBLISHER_RUNTIME_V1.supportedRuntimeTiers.includes(manifest.runtimeTier)) fail("VISUAL_RUNTIME_TIER_UNSUPPORTED");
  if (manifest.securityPosture.remoteCode || manifest.securityPosture.iframe || manifest.securityPosture.unsafeHtml || manifest.securityPosture.arbitraryShader || manifest.securityPosture.untrustedUrl || manifest.securityPosture.dynamicImport) fail("VISUAL_REMOTE_CODE_FORBIDDEN");
  if (manifest.runtimeTier !== "STATIC" && ["NONE", "NOT_REQUIRED"].includes(manifest.fallbackPolicy)) fail("VISUAL_FALLBACK_REQUIRED");
  return entry;
}

export function createVisualPublicationDescriptor(input, { registry = visualComponentRegistry } = {}) {
  if (!plainObject(input) || Object.keys(input).some(key => !inputKeys.has(key)) || !/^[A-Z][A-Z0-9_]{2,63}$/.test(input.componentId || "") || !Number.isInteger(input.componentVersion)) fail("VISUAL_PROPS_INVALID");
  const entry = assertPublishable(registry.get(input.componentId, input.componentVersion));
  const props = validateProps(entry.manifest.propsSchema, input.props ?? {});
  const assetRefs = validateAssetRefs(entry.manifest, input.assetRefs ?? []);
  return Object.freeze({
    componentId: entry.manifest.componentId,
    componentVersion: entry.manifest.componentVersion,
    manifestVersion: entry.manifest.manifestVersion,
    admissionPolicyVersion: entry.admission.policyVersion,
    manifestFingerprint: entry.fingerprint,
    runtimeTier: entry.manifest.runtimeTier,
    props,
    assetRefs,
    fallbackDescriptor: Object.freeze({ type: entry.manifest.fallbackPolicy }),
    restrictions: Object.freeze([...entry.admission.restrictions]),
    publisherContractVersion: VISUAL_PUBLISHER_CONTRACT_VERSION,
  });
}

export function validatePinnedVisualDescriptor(descriptor, { registry = visualComponentRegistry } = {}) {
  if (!plainObject(descriptor) || descriptor.publisherContractVersion !== VISUAL_PUBLISHER_CONTRACT_VERSION) fail("VISUAL_PUBLISHER_CONTRACT_MISMATCH");
  const entry = assertPublishable(registry.get(descriptor.componentId, descriptor.componentVersion));
  if (descriptor.manifestFingerprint !== entry.fingerprint || descriptor.manifestVersion !== entry.manifest.manifestVersion || descriptor.admissionPolicyVersion !== entry.admission.policyVersion) fail("VISUAL_MANIFEST_FINGERPRINT_MISMATCH");
  const expected = createVisualPublicationDescriptor({ componentId: descriptor.componentId, componentVersion: descriptor.componentVersion, props: descriptor.props, assetRefs: descriptor.assetRefs }, { registry });
  if (JSON.stringify(canonical(expected)) !== JSON.stringify(canonical(descriptor))) fail("VISUAL_RESTRICTION_VIOLATION");
  return expected;
}

export function validateVisualPublicationPage(descriptors, { registry = visualComponentRegistry } = {}) {
  if (!Array.isArray(descriptors) || descriptors.length > VISUAL_PUBLISHER_RUNTIME_V1.pageBudget.maxVisualComponentsPerPage) fail("VISUAL_PAGE_BUDGET_EXCEEDED");
  const validated = descriptors.map(descriptor => validatePinnedVisualDescriptor(descriptor, { registry }));
  const counts = new Map();
  for (const descriptor of validated) {
    const key = `${descriptor.componentId}:${descriptor.componentVersion}`;
    counts.set(key, (counts.get(key) || 0) + 1);
    if (descriptor.restrictions.includes("MAX_ONE_PER_PAGE") && counts.get(key) > 1) fail("VISUAL_RESTRICTION_VIOLATION");
  }
  return Object.freeze(validated);
}

const intensityOpacity = Object.freeze({ SUBTLE: ".14", BALANCED: ".22", STRONG: ".32" });
const safeThemeColor = (designTokens, token) => {
  const key = token === "SECONDARY" ? "secondaryColor" : token === "MUTED" ? "mutedColor" : "primaryColor";
  const value = designTokens?.[key];
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : key === "secondaryColor" ? "#475569" : key === "mutedColor" ? "#94a3b8" : "#7c3aed";
};
const staticProps = (descriptor, options, defaults) => Object.freeze({ ...defaults, ...descriptor.props, accent: safeThemeColor(options.designTokens, descriptor.props.accentToken ?? defaults.accentToken), opacity: intensityOpacity[descriptor.props.intensity ?? defaults.intensity] });
const staticResult = (className, css) => Object.freeze({ markup: `<div class="ld-visual ${className}" aria-hidden="true"></div>`, css });

const STATIC_RENDERERS = Object.freeze({
  "LOADDER_STATIC_DOT_FIELD:1": () => staticResult("ld-static-dot-field", ".ld-static-dot-field{position:absolute;inset:0;pointer-events:none;background-color:#070512;background-image:radial-gradient(circle,rgba(139,92,246,.45) 1px,transparent 1.5px);background-size:24px 24px}"),
  "LOADDER_GRADIENT_FIELD:1": (descriptor, options) => { const p = staticProps(descriptor, options, { variant: "AURORA", intensity: "SUBTLE", accentToken: "PRIMARY" }), position = p.variant === "HALO" ? "50% 45%" : "15% 20%"; return staticResult(`ld-gradient-field ld-gradient-field-${p.variant.toLowerCase()}`, `.ld-gradient-field{position:absolute;inset:0;pointer-events:none;overflow:hidden;opacity:${p.opacity};background:radial-gradient(ellipse at ${position},${p.accent} 0,transparent 62%),radial-gradient(ellipse at 85% 80%,${p.accent} 0,transparent 58%)}`); },
  "LOADDER_GLOW_BANDS:1": (descriptor, options) => { const p = staticProps(descriptor, options, { orientation: "DIAGONAL", intensity: "SUBTLE", accentToken: "PRIMARY" }), angle = p.orientation === "HORIZONTAL" ? "0deg" : "-24deg"; return staticResult(`ld-glow-bands ld-glow-bands-${p.orientation.toLowerCase()}`, `.ld-glow-bands{position:absolute;inset:0;pointer-events:none;overflow:hidden;opacity:${p.opacity};background:linear-gradient(${angle},transparent 0 24%,${p.accent} 24% 30%,transparent 30% 62%,${p.accent} 62% 68%,transparent 68% 100%)}`); },
  "LOADDER_GEOMETRIC_PATTERN:1": (descriptor, options) => { const p = staticProps(descriptor, options, { pattern: "DIAMONDS", density: "SPARSE", intensity: "SUBTLE", accentToken: "PRIMARY" }), size = p.density === "DENSE" ? "20px" : p.density === "MEDIUM" ? "32px" : "48px", pattern = p.pattern === "CHEVRON" ? `linear-gradient(135deg,${p.accent} 12%,transparent 12.5% 87%,${p.accent} 87.5%)` : `linear-gradient(45deg,${p.accent} 25%,transparent 25% 75%,${p.accent} 75%),linear-gradient(45deg,${p.accent} 25%,transparent 25% 75%,${p.accent} 75%)`; return staticResult(`ld-geometric-pattern ld-geometric-pattern-${p.pattern.toLowerCase()}`, `.ld-geometric-pattern{position:absolute;inset:0;pointer-events:none;overflow:hidden;opacity:${p.opacity};background-image:${pattern};background-position:0 0,calc(${size}/2) calc(${size}/2);background-size:${size} ${size}}`); },
});

export function renderStaticVisualPublication(descriptors, options = {}) {
  const validated = validateVisualPublicationPage(descriptors, options);
  const rendered = validated.map(descriptor => {
    const renderer = STATIC_RENDERERS[`${descriptor.componentId}:${descriptor.componentVersion}`];
    if (!renderer) fail("VISUAL_RUNTIME_TIER_UNSUPPORTED");
    return renderer(descriptor, options);
  });
  const publication = Object.freeze({ contractVersion: VISUAL_PUBLISHER_CONTRACT_VERSION, descriptors: validated, markup: rendered.map(x => x.markup).join(""), css: rendered.map(x => x.css).join("\n"), csp: "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" });
  return Object.freeze({ ...publication, checksum: checksum(publication) });
}

export function visualPublishingCompatibility(componentId, componentVersion, { registry = visualComponentRegistry } = {}) {
  const entry = registry.get(componentId, componentVersion);
  if (!entry) return Object.freeze({ state: "PUBLISH_BLOCKED", reasonCodes: Object.freeze(["VISUAL_COMPONENT_NOT_FOUND"]), contractVersion: VISUAL_PUBLISHER_CONTRACT_VERSION });
  try {
    const descriptor = createVisualPublicationDescriptor({ componentId, componentVersion, props: {}, assetRefs: [] }, { registry });
    return Object.freeze({ state: descriptor.restrictions.length ? "PUBLISHABLE_WITH_RESTRICTIONS" : "PUBLISHABLE", reasonCodes: Object.freeze([]), descriptor, contractVersion: VISUAL_PUBLISHER_CONTRACT_VERSION });
  } catch (error) {
    const code = error instanceof VisualPublicationError ? error.code : "VISUAL_COMPONENT_NOT_ADMITTED";
    return Object.freeze({ state: code === "VISUAL_LIGHT_RUNTIME_UNAVAILABLE" ? "INCOMPATIBLE" : "PUBLISH_BLOCKED", reasonCodes: Object.freeze([code]), contractVersion: VISUAL_PUBLISHER_CONTRACT_VERSION });
  }
}
