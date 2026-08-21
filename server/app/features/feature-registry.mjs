const VALUE_TYPES = new Set(["numeric", "boolean", "categorical", "json"]);
const SUBJECT_TYPES = new Set([
  "workspace", "customer", "lead", "cart", "order", "campaign", "content", "website", "social_post",
]);
const CONTEXT_SCHEMA_VERSIONS = new Set(["1.0"]);
const MISSING_DATA_BEHAVIORS = new Set(["omit", "error", "explicit_null"]);

const definitions = [
  {
    featureName: "cart_abandoned_value", featureVersion: 1,
    description: "Factual monetary value recorded by the abandoned-cart observation.",
    subjectType: "cart", valueType: "numeric", unit: "source_currency_minor_or_major_unit",
    requiredObservationTypes: ["cart.abandoned_value"], requiredSignalTypes: [],
    supportedContextSchemaVersions: ["1.0"],
    freshnessPolicy: { mode: "source_valid_until" },
    calculationWindowPolicy: { mode: "observation_window" },
    missingDataBehavior: "error", producer: "cart_feature_set", producerVersion: "1.0",
    calculationPolicy: { policy: "copy_numeric_observation", policyVersion: "1.0" },
  },
  {
    featureName: "cart_recovery_opportunity_active", featureVersion: 1,
    description: "Whether the deterministic recovery-opportunity signal was active and unexpired at calculation time.",
    subjectType: "cart", valueType: "boolean", unit: "boolean",
    requiredObservationTypes: [], requiredSignalTypes: ["cart_recovery_opportunity"],
    supportedContextSchemaVersions: ["1.0"],
    freshnessPolicy: { mode: "source_valid_until" },
    calculationWindowPolicy: { mode: "signal_observed_window" },
    missingDataBehavior: "error", producer: "cart_feature_set", producerVersion: "1.0",
    calculationPolicy: { policy: "active_and_unexpired", policyVersion: "1.0" },
  },
  {
    featureName: "cart_recovery_value_band", featureVersion: 1,
    description: "Currency-scoped deterministic band for abandoned cart value; not comparable across currencies.",
    subjectType: "cart", valueType: "categorical", unit: "currency_scoped_band",
    requiredObservationTypes: ["cart.abandoned_value"], requiredSignalTypes: [],
    supportedContextSchemaVersions: ["1.0"],
    freshnessPolicy: { mode: "source_valid_until" },
    calculationWindowPolicy: { mode: "observation_window" },
    missingDataBehavior: "omit", producer: "cart_feature_set", producerVersion: "1.0",
    calculationPolicy: {
      policy: "currency_scoped_thresholds", policyVersion: "1.0",
      thresholdsByCurrency: {
        IRR: { lowUpperExclusive: 1_000_000, mediumUpperExclusive: 5_000_000 },
        USD: { lowUpperExclusive: 50, mediumUpperExclusive: 200 },
        EUR: { lowUpperExclusive: 50, mediumUpperExclusive: 200 },
      },
      categories: ["low", "medium", "high"],
      crossCurrencyComparable: false,
    },
  },
];

function stringArray(value, field) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`${field} must be an array of non-empty strings.`);
  }
  return Object.freeze([...new Set(value)]);
}

function normalize(definition) {
  if (!definition || typeof definition.featureName !== "string" || !definition.featureName.trim()) {
    throw new Error("Feature definition requires a name.");
  }
  if (!Number.isInteger(definition.featureVersion) || definition.featureVersion < 1) {
    throw new Error(`Feature ${definition.featureName} has an invalid version.`);
  }
  if (!VALUE_TYPES.has(definition.valueType)) throw new Error(`Feature ${definition.featureName} has an unknown value type.`);
  if (!SUBJECT_TYPES.has(definition.subjectType)) throw new Error(`Feature ${definition.featureName} has an invalid subject type.`);
  const contextVersions = stringArray(definition.supportedContextSchemaVersions, "supportedContextSchemaVersions");
  if (!contextVersions.length || contextVersions.some((version) => !CONTEXT_SCHEMA_VERSIONS.has(version))) {
    throw new Error(`Feature ${definition.featureName} declares an unsupported context schema.`);
  }
  const observations = stringArray(definition.requiredObservationTypes, "requiredObservationTypes");
  const signals = stringArray(definition.requiredSignalTypes, "requiredSignalTypes");
  if (!observations.length && !signals.length) throw new Error(`Feature ${definition.featureName} requires an upstream source.`);
  if (!definition.freshnessPolicy || definition.freshnessPolicy.mode !== "source_valid_until") {
    throw new Error(`Feature ${definition.featureName} has a malformed freshness policy.`);
  }
  if (!definition.calculationWindowPolicy || !["observation_window", "signal_observed_window"].includes(definition.calculationWindowPolicy.mode)) {
    throw new Error(`Feature ${definition.featureName} has a malformed window policy.`);
  }
  if (!MISSING_DATA_BEHAVIORS.has(definition.missingDataBehavior)) {
    throw new Error(`Feature ${definition.featureName} has invalid missing-data behavior.`);
  }
  if (typeof definition.producer !== "string" || typeof definition.producerVersion !== "string" ||
    !definition.calculationPolicy || typeof definition.calculationPolicy.policy !== "string") {
    throw new Error(`Feature ${definition.featureName} has malformed producer metadata.`);
  }
  return Object.freeze({
    ...definition,
    featureName: definition.featureName.trim(),
    supportedContextSchemaVersions: contextVersions,
    requiredObservationTypes: observations,
    requiredSignalTypes: signals,
    freshnessPolicy: Object.freeze({ ...definition.freshnessPolicy }),
    calculationWindowPolicy: Object.freeze({ ...definition.calculationWindowPolicy }),
    calculationPolicy: Object.freeze({ ...definition.calculationPolicy }),
  });
}

export function createFeatureRegistry(entries = definitions) {
  const normalized = entries.map(normalize);
  const registry = new Map();
  for (const definition of normalized) {
    const key = `${definition.featureName}@${definition.featureVersion}`;
    if (registry.has(key)) throw new Error(`Duplicate feature definition: ${key}.`);
    registry.set(key, definition);
  }
  return Object.freeze({
    get(featureName, featureVersion = 1) { return registry.get(`${featureName}@${featureVersion}`) || null; },
    list() { return [...registry.values()]; },
  });
}

export const featureRegistry = createFeatureRegistry();
