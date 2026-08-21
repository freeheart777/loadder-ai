export const FEATURE_EXPOSURE = Object.freeze({
  CUSTOMER: "CUSTOMER",
  INTERNAL: "INTERNAL",
  DISABLED: "DISABLED",
});

export const FEATURE_KEYS = Object.freeze([
  "content_studio",
  "business_setup",
  "intelligence",
  "legacy_crm",
  "legacy_marketing",
  "legacy_automation",
  "legacy_messaging",
  "execution",
  "experimental_ai",
  "development_tools",
]);

const PRODUCTION_DEFAULTS = Object.freeze({
  content_studio: FEATURE_EXPOSURE.CUSTOMER,
  business_setup: FEATURE_EXPOSURE.CUSTOMER,
  intelligence: FEATURE_EXPOSURE.INTERNAL,
  legacy_crm: FEATURE_EXPOSURE.DISABLED,
  legacy_marketing: FEATURE_EXPOSURE.DISABLED,
  legacy_automation: FEATURE_EXPOSURE.DISABLED,
  legacy_messaging: FEATURE_EXPOSURE.DISABLED,
  execution: FEATURE_EXPOSURE.DISABLED,
  experimental_ai: FEATURE_EXPOSURE.DISABLED,
  development_tools: FEATURE_EXPOSURE.DISABLED,
});

const DEVELOPMENT_DEFAULTS = Object.freeze({
  ...PRODUCTION_DEFAULTS,
  intelligence: FEATURE_EXPOSURE.INTERNAL,
  legacy_crm: FEATURE_EXPOSURE.INTERNAL,
  legacy_marketing: FEATURE_EXPOSURE.INTERNAL,
  legacy_automation: FEATURE_EXPOSURE.INTERNAL,
  legacy_messaging: FEATURE_EXPOSURE.INTERNAL,
  experimental_ai: FEATURE_EXPOSURE.INTERNAL,
  development_tools: FEATURE_EXPOSURE.INTERNAL,
});

const TEST_DEFAULTS = Object.freeze(Object.fromEntries(
  FEATURE_KEYS.map((key) => [key, FEATURE_EXPOSURE.CUSTOMER])
));

export function createProductPolicy({ nodeEnv = "development", overrides = {} } = {}) {
  const defaults = nodeEnv === "production"
    ? PRODUCTION_DEFAULTS
    : nodeEnv === "test" ? TEST_DEFAULTS : DEVELOPMENT_DEFAULTS;
  const unknown = Object.keys(overrides).filter((key) => !FEATURE_KEYS.includes(key));
  if (unknown.length) throw new Error("PRODUCT_FEATURE_OVERRIDES contains an unknown feature key.");
  const invalid = Object.values(overrides).some((value) => !Object.values(FEATURE_EXPOSURE).includes(value));
  if (invalid) throw new Error("PRODUCT_FEATURE_OVERRIDES contains an invalid exposure.");
  const features = Object.freeze({ ...defaults, ...overrides });
  return Object.freeze({
    exposure(feature) {
      if (!FEATURE_KEYS.includes(feature)) return FEATURE_EXPOSURE.DISABLED;
      return features[feature];
    },
    isCustomer(feature) { return this.exposure(feature) === FEATURE_EXPOSURE.CUSTOMER; },
    isInternal(feature) { return this.exposure(feature) === FEATURE_EXPOSURE.INTERNAL; },
    isDisabled(feature) { return this.exposure(feature) === FEATURE_EXPOSURE.DISABLED; },
    snapshot() { return { ...features }; },
  });
}

export function parseFeatureOverrides(value) {
  if (!value) return {};
  let parsed;
  try { parsed = JSON.parse(value); } catch { throw new Error("PRODUCT_FEATURE_OVERRIDES must be valid JSON."); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("PRODUCT_FEATURE_OVERRIDES must be a JSON object.");
  }
  return parsed;
}
