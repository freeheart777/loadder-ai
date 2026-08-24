import crypto from "node:crypto";

export const VISUAL_MANIFEST_VERSION = "VISUAL_COMPONENT_MANIFEST_V1";
export const VISUAL_ADMISSION_POLICY_VERSION = "VISUAL_COMPONENT_ADMISSION_V1";
export const VISUAL_ADMISSION_STATES = Object.freeze(["ADMITTED", "ADMITTED_WITH_RESTRICTIONS", "PILOT_ONLY", "REJECTED", "INSUFFICIENT_EVIDENCE"]);
export const VISUAL_RUNTIME_TIERS = Object.freeze(["STATIC", "LIGHT", "INTERACTIVE", "GPU_HEAVY"]);
export const VISUAL_CATEGORIES = Object.freeze(["DECORATIVE_BACKGROUND", "INTERACTIVE_BACKGROUND", "TEXT_EFFECT", "MEDIA_EFFECT", "THREE_D_OBJECT", "OTHER_REVIEWED"]);
export const VISUAL_REASON_CODES = Object.freeze([
  "MANIFEST_INVALID", "PROVIDER_NOT_TRUSTED", "LICENSE_UNVERIFIED", "LICENSE_PROHIBITED", "REMOTE_CODE_FORBIDDEN",
  "REMOTE_ASSET_UNREVIEWED", "DEPENDENCY_CONFLICT", "DEPENDENCY_REVIEW_REQUIRED", "BUNDLE_EVIDENCE_MISSING",
  "STARTUP_BUNDLE_LEAK", "MOBILE_FALLBACK_REQUIRED", "REDUCED_MOTION_REQUIRED", "ACCESSIBILITY_UNSAFE", "SEO_UNSAFE",
  "STATIC_FALLBACK_REQUIRED", "CANVAS_BUDGET_EXCEEDED", "INSTANCE_BUDGET_EXCEEDED", "CLEANUP_EVIDENCE_MISSING",
  "OFFSCREEN_POLICY_REQUIRED", "DPR_POLICY_REQUIRED", "PUBLISHING_INCOMPATIBLE", "EDITOR_LIVE_LIMITED",
  "EVIDENCE_INSUFFICIENT", "GPU_HEAVY_PILOT_ONLY", "TRADEOFF_DETECTED",
]);
export const VISUAL_RESTRICTIONS = Object.freeze([
  "DESKTOP_ONLY", "STATIC_ON_MOBILE", "STATIC_ON_REDUCED_MOTION", "MAX_ONE_PER_PAGE", "DECORATIVE_ONLY",
  "LOADDER_HOSTED_ASSETS_ONLY", "LAZY_ONLY", "EDITOR_STATIC_PREVIEW", "NO_PRIMARY_CONTENT",
]);

export const visualProviderRegistry = Object.freeze([
  Object.freeze({ id: "LOADDER_NATIVE", version: 1, trustPosture: "TRUSTED_CODE_OWNED", sourcePolicy: "REVIEWED_LOCAL", remoteCodeAllowed: false, remoteAssetPolicy: "LOADDER_HOSTED_OR_BUNDLED", reviewRequired: true }),
  Object.freeze({ id: "THREEUI_SELECTED", version: 1, trustPosture: "REVIEW_REQUIRED", sourcePolicy: "PINNED_SELECTED_ONLY", remoteCodeAllowed: false, remoteAssetPolicy: "REVIEW_REQUIRED", reviewRequired: true }),
  Object.freeze({ id: "OTHER_REVIEWED_PROVIDER", version: 1, trustPosture: "REVIEW_REQUIRED", sourcePolicy: "PINNED_SELECTED_ONLY", remoteCodeAllowed: false, remoteAssetPolicy: "REVIEW_REQUIRED", reviewRequired: true }),
]);

const providers = new Map(visualProviderRegistry.map(x => [x.id, x]));
const allowedKeys = new Set(["componentId", "componentVersion", "manifestVersion", "provider", "displayName", "category", "runtimeTier", "propsSchema", "dependencySet", "assetPolicy", "licenseMetadata", "mobilePolicy", "motionPolicy", "accessibilityPolicy", "seoPolicy", "fallbackPolicy", "canvasBudget", "instanceBudget", "cleanupPolicy", "publishingCompatibility", "editorCompatibility", "securityPosture", "evidence"]);
const propKeys = new Set(["type", "minimum", "maximum", "values", "tokenKind"]);
const enums = Object.freeze({
  assetPolicy: ["NO_ASSETS", "LOADDER_HOSTED", "REVIEWED_BUNDLED", "REMOTE_REVIEWED", "REMOTE_UNREVIEWED"],
  dependencySet: ["NO_DEPENDENCY", "LOADDER_EXISTING", "ISOLATED_APPROVED", "NEW_REVIEW_REQUIRED", "CONFLICTING"],
  mobilePolicy: ["SUPPORTED", "SIMPLIFIED", "STATIC_FALLBACK", "UNSUPPORTED"],
  motionPolicy: ["REDUCED_MOTION_SUPPORTED", "REDUCED_MOTION_STATIC", "MOTION_REQUIRED", "UNKNOWN", "NOT_APPLICABLE"],
  accessibilityPolicy: ["DECORATIVE_SAFE", "SEMANTIC_SUPPORTED", "FALLBACK_REQUIRED", "INSUFFICIENT", "UNSAFE"],
  seoPolicy: ["DECORATIVE_SAFE", "SEMANTIC_DOM_PRESERVED", "FALLBACK_REQUIRED", "UNSAFE", "UNKNOWN"],
  fallbackPolicy: ["CSS", "SVG", "LOCAL_IMAGE", "STATIC_COMPONENT", "NONE", "NOT_REQUIRED"],
  publishingCompatibility: ["COMPATIBLE", "INCOMPATIBLE", "UNKNOWN"],
  editorCompatibility: ["STATIC_PREVIEW", "LIVE_SELECTED_ONLY", "LIVE_SAFE", "UNSUPPORTED"],
});
const evidenceKeys = new Set(["quality", "rawBytes", "gzipBytes", "brotliBytes", "startupDeltaBytes", "lazyChunkBytes", "lazyLoaded", "cleanupTested", "reducedMotionTested", "mobileFallbackTested", "webglFailureTested", "securityReviewed", "accessibilityReviewed", "seoReviewed", "browserProfiled", "crossBrowserSoak", "contextLossBrowserTested"]);
const jsonSafe = value => {
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) return typeof value !== "number" || Number.isFinite(value);
  if (Array.isArray(value)) return value.length <= 64 && value.every(jsonSafe);
  return typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype && Object.keys(value).length <= 64 && Object.values(value).every(jsonSafe);
};
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])) : value;
export const fingerprintVisualManifest = manifest => crypto.createHash("sha256").update(JSON.stringify(canonical(manifest))).digest("hex");

export function validateVisualManifest(manifest) {
  const errors = [];
  if (!manifest || Object.getPrototypeOf(manifest) !== Object.prototype || !jsonSafe(manifest)) return Object.freeze({ valid: false, errors: Object.freeze(["MANIFEST_NOT_JSON_SAFE"]) });
  if (Object.keys(manifest).some(k => !allowedKeys.has(k)) || [...allowedKeys].some(k => !(k in manifest))) errors.push("MANIFEST_FIELDS_INVALID");
  if (!/^[A-Z][A-Z0-9_]{2,63}$/.test(manifest.componentId || "") || !Number.isInteger(manifest.componentVersion) || manifest.componentVersion < 1 || manifest.componentVersion > 9999 || manifest.manifestVersion !== VISUAL_MANIFEST_VERSION) errors.push("IDENTITY_INVALID");
  if (typeof manifest.displayName !== "string" || !manifest.displayName.trim() || manifest.displayName.length > 100) errors.push("DISPLAY_NAME_INVALID");
  if (!providers.has(manifest.provider)) errors.push("PROVIDER_INVALID");
  if (!VISUAL_CATEGORIES.includes(manifest.category) || !VISUAL_RUNTIME_TIERS.includes(manifest.runtimeTier)) errors.push("CLASSIFICATION_INVALID");
  for (const [key, values] of Object.entries(enums)) if (!values.includes(manifest[key])) errors.push(`${key.toUpperCase()}_INVALID`);
  const licenses = manifest.licenseMetadata;
  if (!licenses || !["SAFE", "CONDITIONAL", "UNVERIFIED", "PROHIBITED"].includes(licenses.codeLicense) || !["SAFE", "CONDITIONAL", "UNVERIFIED", "PROHIBITED", "NOT_APPLICABLE"].includes(licenses.assetLicense) || !["SAFE", "CONDITIONAL", "UNVERIFIED", "PROHIBITED", "NOT_APPLICABLE"].includes(licenses.fontLicense)) errors.push("LICENSE_INVALID");
  const props = manifest.propsSchema;
  if (!props || Object.getPrototypeOf(props) !== Object.prototype || Object.keys(props).length > 24) errors.push("PROPS_SCHEMA_INVALID");
  else for (const definition of Object.values(props)) {
    if (!definition || Object.keys(definition).some(k => !propKeys.has(k)) || !["boolean", "boundedNumber", "enum", "tokenReference", "assetReference"].includes(definition.type)) errors.push("PROP_DEFINITION_INVALID");
    if (definition?.type === "boundedNumber" && (!Number.isFinite(definition.minimum) || !Number.isFinite(definition.maximum) || definition.minimum >= definition.maximum)) errors.push("PROP_BOUNDS_INVALID");
    if (definition?.type === "enum" && (!Array.isArray(definition.values) || !definition.values.length || definition.values.length > 32 || definition.values.some(x => typeof x !== "string" || x.length > 64))) errors.push("PROP_ENUM_INVALID");
  }
  if (!manifest.canvasBudget || !Number.isInteger(manifest.canvasBudget.canvasCount) || !Number.isInteger(manifest.canvasBudget.contextCount) || manifest.canvasBudget.canvasCount < 0 || manifest.canvasBudget.contextCount < 0) errors.push("CANVAS_BUDGET_INVALID");
  if (!manifest.instanceBudget || !Number.isInteger(manifest.instanceBudget.maxInstancesPerPage) || manifest.instanceBudget.maxInstancesPerPage < 1 || manifest.instanceBudget.maxInstancesPerPage > 20) errors.push("INSTANCE_BUDGET_INVALID");
  if (!manifest.cleanupPolicy || typeof manifest.cleanupPolicy !== "object" || !manifest.securityPosture || typeof manifest.securityPosture !== "object") errors.push("POLICY_OBJECT_INVALID");
  if (!manifest.evidence || Object.keys(manifest.evidence).some(k => !evidenceKeys.has(k)) || !["NONE", "LIMITED", "ADEQUATE", "STRONG"].includes(manifest.evidence?.quality)) errors.push("EVIDENCE_INVALID");
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze([...new Set(errors)]) });
}

const qualityVector = manifest => Object.freeze({
  VISUAL_QUALITY: "REVIEWED", PERFORMANCE: manifest.evidence.quality, MOBILE: manifest.mobilePolicy,
  ACCESSIBILITY: manifest.accessibilityPolicy, SEO: manifest.seoPolicy, SECURITY: manifest.securityPosture.reviewed ? "REVIEWED" : "UNKNOWN",
  RELIABILITY: manifest.cleanupPolicy.raf && manifest.cleanupPolicy.listeners ? "BOUNDED" : "INSUFFICIENT",
  MAINTAINABILITY: providers.get(manifest.provider)?.trustPosture === "TRUSTED_CODE_OWNED" ? "CODE_OWNED" : "REVIEW_REQUIRED",
  PUBLISHING_COMPATIBILITY: manifest.publishingCompatibility,
});

export function evaluateVisualManifest(manifest) {
  const validation = validateVisualManifest(manifest);
  if (!validation.valid) return result(manifest, "REJECTED", ["MANIFEST_INVALID"], [], [], null);
  const critical = [], reasons = [], missing = [], restrictions = [];
  const add = (list, code) => { if (!list.includes(code)) list.push(code); if (!reasons.includes(code)) reasons.push(code); };
  const provider = providers.get(manifest.provider);
  if (!provider || provider.trustPosture !== "TRUSTED_CODE_OWNED") add(critical, "PROVIDER_NOT_TRUSTED");
  if ([manifest.licenseMetadata.codeLicense, manifest.licenseMetadata.assetLicense, manifest.licenseMetadata.fontLicense].includes("PROHIBITED")) add(critical, "LICENSE_PROHIBITED");
  else if ([manifest.licenseMetadata.codeLicense, manifest.licenseMetadata.assetLicense, manifest.licenseMetadata.fontLicense].includes("UNVERIFIED")) add(missing, "LICENSE_UNVERIFIED");
  if (manifest.assetPolicy === "REMOTE_UNREVIEWED") add(critical, "REMOTE_ASSET_UNREVIEWED");
  if (manifest.securityPosture.remoteCode || manifest.securityPosture.iframe || manifest.securityPosture.unsafeHtml || manifest.securityPosture.arbitraryShader || manifest.securityPosture.untrustedUrl || manifest.securityPosture.dynamicImport) add(critical, "REMOTE_CODE_FORBIDDEN");
  if (manifest.dependencySet === "CONFLICTING") add(critical, "DEPENDENCY_CONFLICT");
  if (manifest.dependencySet === "NEW_REVIEW_REQUIRED") add(missing, "DEPENDENCY_REVIEW_REQUIRED");
  if (manifest.runtimeTier === "GPU_HEAVY") add(restrictions, "GPU_HEAVY_PILOT_ONLY");
  if (["INTERACTIVE", "GPU_HEAVY"].includes(manifest.runtimeTier)) {
    if (!manifest.evidence.lazyLoaded || (manifest.evidence.startupDeltaBytes ?? Infinity) > 2048) add(restrictions, "STARTUP_BUNDLE_LEAK");
    if (["NONE", "NOT_REQUIRED"].includes(manifest.fallbackPolicy)) add(critical, "STATIC_FALLBACK_REQUIRED");
    if (!manifest.evidence.cleanupTested || !Object.values(manifest.cleanupPolicy).every(Boolean)) add(missing, "CLEANUP_EVIDENCE_MISSING");
    if (!manifest.cleanupPolicy.offscreenPause || !manifest.cleanupPolicy.documentHiddenPause) add(missing, "OFFSCREEN_POLICY_REQUIRED");
    if (!manifest.cleanupPolicy.boundedDpr) add(missing, "DPR_POLICY_REQUIRED");
    if (!manifest.evidence.browserProfiled || !manifest.evidence.crossBrowserSoak || !manifest.evidence.contextLossBrowserTested) add(missing, "EVIDENCE_INSUFFICIENT");
  }
  if (manifest.mobilePolicy === "UNSUPPORTED") add(missing, "MOBILE_FALLBACK_REQUIRED");
  if (!["REDUCED_MOTION_SUPPORTED", "REDUCED_MOTION_STATIC", "NOT_APPLICABLE"].includes(manifest.motionPolicy)) add(critical, "REDUCED_MOTION_REQUIRED");
  if (manifest.accessibilityPolicy === "UNSAFE") add(critical, "ACCESSIBILITY_UNSAFE");
  if (manifest.seoPolicy === "UNSAFE") add(critical, "SEO_UNSAFE");
  if (manifest.canvasBudget.canvasCount > 1 || manifest.canvasBudget.contextCount > 1) add(critical, "CANVAS_BUDGET_EXCEEDED");
  if (manifest.instanceBudget.maxInstancesPerPage > 1 && ["INTERACTIVE", "GPU_HEAVY"].includes(manifest.runtimeTier)) add(critical, "INSTANCE_BUDGET_EXCEEDED");
  if (manifest.publishingCompatibility !== "COMPATIBLE") add(restrictions, "PUBLISHING_INCOMPATIBLE");
  if (["STATIC_PREVIEW", "LIVE_SELECTED_ONLY"].includes(manifest.editorCompatibility)) add(restrictions, "EDITOR_LIVE_LIMITED");
  if (manifest.runtimeTier !== "STATIC") restrictions.push("LAZY_ONLY");
  if (manifest.mobilePolicy === "STATIC_FALLBACK") restrictions.push("STATIC_ON_MOBILE");
  if (manifest.motionPolicy === "REDUCED_MOTION_STATIC") restrictions.push("STATIC_ON_REDUCED_MOTION");
  if (manifest.instanceBudget.maxInstancesPerPage === 1) restrictions.push("MAX_ONE_PER_PAGE");
  if (manifest.accessibilityPolicy === "DECORATIVE_SAFE") restrictions.push("DECORATIVE_ONLY", "NO_PRIMARY_CONTENT");
  if (critical.length) return result(manifest, "REJECTED", critical, restrictions, missing, qualityVector(manifest), reasons);
  if (missing.includes("LICENSE_UNVERIFIED") || (manifest.evidence.quality === "NONE" && manifest.runtimeTier === "STATIC")) return result(manifest, "INSUFFICIENT_EVIDENCE", [], restrictions, missing.length ? missing : ["EVIDENCE_INSUFFICIENT"], qualityVector(manifest), reasons);
  if (manifest.runtimeTier === "GPU_HEAVY" || manifest.publishingCompatibility !== "COMPATIBLE" || missing.length || reasons.includes("STARTUP_BUNDLE_LEAK")) return result(manifest, "PILOT_ONLY", [], restrictions, missing, qualityVector(manifest), [...reasons, "TRADEOFF_DETECTED"]);
  return result(manifest, restrictions.length ? "ADMITTED_WITH_RESTRICTIONS" : "ADMITTED", [], restrictions, [], qualityVector(manifest), reasons);
}

function result(manifest, state, criticalFailures, restrictions, missingEvidence, vector, reasonCodes = criticalFailures) {
  return Object.freeze({ state, componentId: manifest?.componentId ?? null, componentVersion: manifest?.componentVersion ?? null, manifestVersion: manifest?.manifestVersion ?? null, criticalFailures: Object.freeze([...new Set(criticalFailures)]), restrictions: Object.freeze([...new Set(restrictions)].filter(x => VISUAL_RESTRICTIONS.includes(x) || x === "GPU_HEAVY_PILOT_ONLY" || x === "PUBLISHING_INCOMPATIBLE" || x === "EDITOR_LIVE_LIMITED" || x === "STARTUP_BUNDLE_LEAK")), missingEvidence: Object.freeze([...new Set(missingEvidence)]), reasonCodes: Object.freeze([...new Set(reasonCodes)]), qualityVector: vector, policyVersion: VISUAL_ADMISSION_POLICY_VERSION, evaluatedAtPolicyVersion: VISUAL_ADMISSION_POLICY_VERSION });
}
