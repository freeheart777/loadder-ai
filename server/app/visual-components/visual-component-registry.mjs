import { evaluateVisualManifest, fingerprintVisualManifest, VISUAL_MANIFEST_VERSION } from "./visual-component-policy.mjs";

const common = Object.freeze({
  manifestVersion: VISUAL_MANIFEST_VERSION, provider: "LOADDER_NATIVE", category: "DECORATIVE_BACKGROUND", propsSchema: {}, dependencySet: "NO_DEPENDENCY", assetPolicy: "NO_ASSETS",
  licenseMetadata: Object.freeze({ codeLicense: "SAFE", assetLicense: "NOT_APPLICABLE", fontLicense: "NOT_APPLICABLE" }),
  accessibilityPolicy: "DECORATIVE_SAFE", seoPolicy: "DECORATIVE_SAFE", canvasBudget: Object.freeze({ canvasCount: 0, contextCount: 0 }),
  instanceBudget: Object.freeze({ maxInstancesPerPage: 1 }), publishingCompatibility: "COMPATIBLE", editorCompatibility: "STATIC_PREVIEW",
  securityPosture: Object.freeze({ reviewed: true, remoteCode: false, iframe: false, unsafeHtml: false, arbitraryShader: false, untrustedUrl: false, dynamicImport: false }),
});

export const safeCssDecorativeManifest = Object.freeze({ ...common, componentId: "LOADDER_STATIC_DOT_FIELD", componentVersion: 1, displayName: "Loadder Static Dot Field", runtimeTier: "STATIC", mobilePolicy: "SUPPORTED", motionPolicy: "NOT_APPLICABLE", fallbackPolicy: "NOT_REQUIRED", cleanupPolicy: Object.freeze({ raf: true, observers: true, listeners: true, resources: true, context: true, offscreenPause: true, documentHiddenPause: true, boundedDpr: true }), evidence: Object.freeze({ quality: "ADEQUATE", rawBytes: 0, gzipBytes: 0, brotliBytes: 0, startupDeltaBytes: 0, lazyChunkBytes: 0, lazyLoaded: true, cleanupTested: true, reducedMotionTested: true, mobileFallbackTested: true, webglFailureTested: true, securityReviewed: true, accessibilityReviewed: true, seoReviewed: true, browserProfiled: true, crossBrowserSoak: true, contextLossBrowserTested: true }) });

const staticLifecycle = Object.freeze({ raf: true, observers: true, listeners: true, resources: true, context: true, offscreenPause: true, documentHiddenPause: true, boundedDpr: true });
const staticEvidence = Object.freeze({ quality: "ADEQUATE", rawBytes: 0, gzipBytes: 0, brotliBytes: 0, startupDeltaBytes: 0, lazyChunkBytes: 0, lazyLoaded: true, cleanupTested: true, reducedMotionTested: true, mobileFallbackTested: true, webglFailureTested: true, securityReviewed: true, accessibilityReviewed: true, seoReviewed: true, browserProfiled: false, crossBrowserSoak: false, contextLossBrowserTested: false });
const accent = Object.freeze({ type: "enum", values: Object.freeze(["PRIMARY", "SECONDARY", "MUTED"]) });
const intensity = Object.freeze({ type: "enum", values: Object.freeze(["SUBTLE", "BALANCED", "STRONG"]) });
const staticPrimitive = Object.freeze({ ...common, runtimeTier: "STATIC", mobilePolicy: "SUPPORTED", motionPolicy: "NOT_APPLICABLE", fallbackPolicy: "NOT_REQUIRED", cleanupPolicy: staticLifecycle, evidence: staticEvidence });

export const gradientFieldManifest = Object.freeze({ ...staticPrimitive, componentId: "LOADDER_GRADIENT_FIELD", componentVersion: 1, displayName: "Loadder Gradient Field", propsSchema: Object.freeze({ variant: Object.freeze({ type: "enum", values: Object.freeze(["AURORA", "HALO"]) }), intensity, accentToken: accent }) });
export const glowBandsManifest = Object.freeze({ ...staticPrimitive, componentId: "LOADDER_GLOW_BANDS", componentVersion: 1, displayName: "Loadder Glow Bands", propsSchema: Object.freeze({ orientation: Object.freeze({ type: "enum", values: Object.freeze(["HORIZONTAL", "DIAGONAL"]) }), intensity, accentToken: accent }) });
export const geometricPatternManifest = Object.freeze({ ...staticPrimitive, componentId: "LOADDER_GEOMETRIC_PATTERN", componentVersion: 1, displayName: "Loadder Geometric Pattern", propsSchema: Object.freeze({ pattern: Object.freeze({ type: "enum", values: Object.freeze(["DIAMONDS", "CHEVRON"]) }), density: Object.freeze({ type: "enum", values: Object.freeze(["SPARSE", "MEDIUM", "DENSE"]) }), intensity, accentToken: accent }) });

export const nativeVisualPilotManifest = Object.freeze({ ...common, componentId: "LOADDER_DOT_MATRIX", componentVersion: 1, displayName: "Loadder Native Dot Matrix Pilot", runtimeTier: "INTERACTIVE", propsSchema: Object.freeze({ density: Object.freeze({ type: "boundedNumber", minimum: 20, maximum: 64 }), intensity: Object.freeze({ type: "boundedNumber", minimum: .25, maximum: 1 }), speed: Object.freeze({ type: "boundedNumber", minimum: .05, maximum: .4 }), motionEnabled: Object.freeze({ type: "boolean" }), qualityTier: Object.freeze({ type: "enum", values: Object.freeze(["LOW", "BALANCED"]) }) }), mobilePolicy: "STATIC_FALLBACK", motionPolicy: "REDUCED_MOTION_STATIC", fallbackPolicy: "CSS", canvasBudget: Object.freeze({ canvasCount: 1, contextCount: 1 }), cleanupPolicy: Object.freeze({ raf: true, observers: true, listeners: true, resources: true, context: true, offscreenPause: true, documentHiddenPause: true, boundedDpr: true }), publishingCompatibility: "INCOMPATIBLE", editorCompatibility: "STATIC_PREVIEW", evidence: Object.freeze({ quality: "LIMITED", rawBytes: 8293, gzipBytes: 4071, brotliBytes: 3499, startupDeltaBytes: 721, lazyChunkBytes: 8293, lazyLoaded: true, cleanupTested: true, reducedMotionTested: true, mobileFallbackTested: true, webglFailureTested: true, securityReviewed: true, accessibilityReviewed: true, seoReviewed: true, browserProfiled: false, crossBrowserSoak: false, contextLossBrowserTested: false }) });

export function createVisualComponentRegistry(source = [nativeVisualPilotManifest, safeCssDecorativeManifest, gradientFieldManifest, glowBandsManifest, geometricPatternManifest]) {
  const entries = new Map();
  for (const manifest of source) {
    const key = `${manifest.componentId}:${manifest.componentVersion}`;
    if (entries.has(key)) throw new Error("VISUAL_COMPONENT_DUPLICATE");
    const admission = evaluateVisualManifest(manifest);
    entries.set(key, Object.freeze({ manifest, admission, fingerprint: fingerprintVisualManifest(manifest) }));
  }
  const publicEntry = entry => entry ? Object.freeze({ manifest: entry.manifest, admission: entry.admission, fingerprint: entry.fingerprint }) : null;
  return Object.freeze({
    policyVersion: "VISUAL_COMPONENT_ADMISSION_V1",
    get(componentId, componentVersion) { return publicEntry(entries.get(`${componentId}:${componentVersion}`)); },
    list() { return Object.freeze([...entries.values()].map(publicEntry)); },
  });
}

export const visualComponentRegistry = createVisualComponentRegistry();
