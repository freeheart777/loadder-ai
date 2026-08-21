const VALUE_TYPES = new Set(["numeric", "boolean", "categorical", "json"]);
const SUBJECT_TYPES = new Set(["workspace", "customer", "lead", "cart", "order", "campaign", "content", "website", "social_post"]);
const MISSING_POLICIES = new Set(["explicit"]);

const DEFAULT_SPECIFICATIONS = [{
  specificationId: "cart_recovery_input_quality_baseline",
  specificationVersion: 1,
  description: "A transparent consistency evaluation of the deterministic abandoned-cart feature set.",
  subjectType: "cart",
  snapshotSchemaVersion: "1.0",
  supportedContextSchemaVersions: ["1.0"],
  missingDataPolicy: "explicit",
  requiredFeatures: [
    { featureName: "cart_abandoned_value", featureVersion: 1, valueType: "numeric" },
    { featureName: "cart_recovery_opportunity_active", featureVersion: 1, valueType: "boolean" },
    { featureName: "cart_recovery_value_band", featureVersion: 1, valueType: "categorical" },
  ],
  optionalFeatures: [],
  evaluator: { evaluatorId: "deterministic_input_consistency", evaluatorVersion: "1.0" },
}];

function normalizeFeature(item, label) {
  if (!item || typeof item.featureName !== "string" || !item.featureName.trim() ||
    !Number.isInteger(item.featureVersion) || item.featureVersion < 1 || !VALUE_TYPES.has(item.valueType)) {
    throw new Error(`Model specification has malformed ${label} feature declaration.`);
  }
  return Object.freeze({ featureName: item.featureName.trim(), featureVersion: item.featureVersion, valueType: item.valueType });
}

function normalize(specification) {
  if (!specification || typeof specification.specificationId !== "string" || !specification.specificationId.trim()) {
    throw new Error("Model specification requires an ID.");
  }
  if (!Number.isInteger(specification.specificationVersion) || specification.specificationVersion < 1) {
    throw new Error(`Model specification ${specification.specificationId} has an invalid version.`);
  }
  if (!SUBJECT_TYPES.has(specification.subjectType)) throw new Error("Model specification has an invalid subject type.");
  if (typeof specification.snapshotSchemaVersion !== "string" || !specification.snapshotSchemaVersion.trim()) {
    throw new Error("Model specification requires a snapshot schema version.");
  }
  if (!Array.isArray(specification.supportedContextSchemaVersions) || !specification.supportedContextSchemaVersions.length ||
    specification.supportedContextSchemaVersions.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error("Model specification requires supported Business Context schemas.");
  }
  if (!MISSING_POLICIES.has(specification.missingDataPolicy)) throw new Error("Model specification must explicitly classify missing data.");
  const requiredFeatures = (specification.requiredFeatures || []).map((item) => normalizeFeature(item, "required"));
  const optionalFeatures = (specification.optionalFeatures || []).map((item) => normalizeFeature(item, "optional"));
  if (!requiredFeatures.length) throw new Error("Model specification requires at least one feature.");
  const featureKeys = [...requiredFeatures, ...optionalFeatures].map((item) => `${item.featureName}@${item.featureVersion}`);
  if (new Set(featureKeys).size !== featureKeys.length) throw new Error("Model specification feature declarations must be unique.");
  if (!specification.evaluator || typeof specification.evaluator.evaluatorId !== "string" ||
    typeof specification.evaluator.evaluatorVersion !== "string") throw new Error("Model specification requires an evaluator declaration.");
  return Object.freeze({ ...specification, specificationId: specification.specificationId.trim(),
    supportedContextSchemaVersions: Object.freeze([...new Set(specification.supportedContextSchemaVersions)]),
    requiredFeatures: Object.freeze(requiredFeatures), optionalFeatures: Object.freeze(optionalFeatures),
    evaluator: Object.freeze({ ...specification.evaluator }) });
}

export function createModelSpecificationRegistry(entries = DEFAULT_SPECIFICATIONS) {
  const registry = new Map();
  for (const entry of entries.map(normalize)) {
    const key = `${entry.specificationId}@${entry.specificationVersion}`;
    if (registry.has(key)) throw new Error(`Duplicate model specification: ${key}.`);
    registry.set(key, entry);
  }
  return Object.freeze({
    get(id, version = 1) { return registry.get(`${id}@${version}`) || null; },
    list() { return [...registry.values()]; },
  });
}

export const modelSpecificationRegistry = createModelSpecificationRegistry();
