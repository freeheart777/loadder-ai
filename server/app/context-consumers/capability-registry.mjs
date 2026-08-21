const ALL_CONTEXT_SECTIONS = [
  "identity", "strategy", "audiences", "offerings", "brand", "visual", "metadata",
];

const DEFAULT_CAPABILITIES = [
  ["crm_intelligence", ["identity", "audiences", "offerings"], ["strategy", "brand"]],
  ["marketing_intelligence", ["identity", "strategy", "audiences", "brand"], ["offerings", "visual"]],
  ["ads_optimization", ["identity", "strategy", "audiences"], ["brand", "offerings"]],
  ["content_studio", ["identity", "audiences", "brand"], ["strategy", "offerings", "visual"]],
  ["text_ai", ["identity", "strategy", "brand"], ["audiences", "offerings", "visual"]],
  ["website_intelligence", ["identity", "brand"], ["strategy", "audiences", "offerings", "visual"]],
  ["social_intelligence", ["identity", "audiences", "brand"], ["strategy", "visual"]],
  ["automation", ["identity"], ["strategy", "audiences", "offerings", "brand"]],
  ["analytics", ["identity", "strategy"], ["audiences", "offerings"]],
  ["recommendation_engine", ["identity", "strategy"], ["audiences", "offerings", "brand", "visual"]],
  ["future_ml_models", ["identity", "metadata"], ["strategy", "audiences", "offerings", "brand", "visual"]],
  ["business_events", ["identity", "metadata"], ["strategy", "audiences", "offerings", "brand", "visual"]],
  ["growth_signals", ["identity", "strategy", "metadata"], ["audiences", "offerings", "brand", "visual"]],
  ["feature_engine", ["identity", "strategy", "metadata"], ["audiences", "offerings", "brand", "visual"]],
  ["model_inputs", ["identity", "strategy", "metadata"], ["audiences", "offerings", "brand", "visual"]],
  ["listening_intelligence", ["identity", "metadata"], ["strategy", "audiences", "offerings", "brand", "visual"]],
  ["semantic_intelligence", ["identity", "metadata"], ["strategy", "audiences", "offerings", "brand", "visual"]],
  ["recommendation_intelligence", ["identity", "metadata"], ["strategy", "audiences", "offerings", "brand", "visual"]],
].map(([consumer, requiredContextSections, optionalContextSections]) => ({
  consumer,
  supportedContextSchemaVersions: ["1.0"],
  requiredContextSections,
  optionalContextSections,
}));

function normalizeCapability(capability) {
  if (!capability || typeof capability.consumer !== "string" || !capability.consumer.trim()) {
    throw new Error("Consumer capability requires a name.");
  }
  const supported = capability.supportedContextSchemaVersions;
  if (!Array.isArray(supported) || supported.length === 0 || supported.some((item) => typeof item !== "string")) {
    throw new Error(`Consumer ${capability.consumer} requires supported schema versions.`);
  }
  for (const field of ["requiredContextSections", "optionalContextSections"]) {
    if (!Array.isArray(capability[field]) || capability[field].some((section) => !ALL_CONTEXT_SECTIONS.includes(section))) {
      throw new Error(`Consumer ${capability.consumer} has invalid ${field}.`);
    }
  }
  return Object.freeze({
    consumer: capability.consumer.trim(),
    supportedContextSchemaVersions: Object.freeze([...new Set(supported)]),
    requiredContextSections: Object.freeze([...new Set(capability.requiredContextSections)]),
    optionalContextSections: Object.freeze([...new Set(capability.optionalContextSections)]),
  });
}

export function createContextCapabilityRegistry(capabilities = DEFAULT_CAPABILITIES) {
  const entries = capabilities.map(normalizeCapability);
  const registry = new Map(entries.map((entry) => [entry.consumer, entry]));
  if (registry.size !== entries.length) throw new Error("Consumer capability names must be unique.");
  return Object.freeze({
    get(consumer) {
      return registry.get(consumer) || null;
    },
    list() {
      return [...registry.values()];
    },
  });
}

export const contextCapabilityRegistry = createContextCapabilityRegistry();
