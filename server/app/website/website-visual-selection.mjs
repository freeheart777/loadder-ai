import { visualPublishingCompatibility } from "../visual-publishing/visual-publisher-contract.mjs";
import { visualComponentRegistry } from "../visual-components/visual-component-registry.mjs";

export const CUSTOMER_VISUAL_COMPONENTS = Object.freeze([
  Object.freeze({
    componentId: "LOADDER_GRADIENT_FIELD",
    componentVersion: 1,
    label: "پس‌زمینه گرادیانی",
    description: "هاله‌ای نرم برای تاکید روی پیام اصلی",
    defaults: Object.freeze({
      variant: "AURORA",
      intensity: "SUBTLE",
      accentToken: "PRIMARY",
    }),
    allowedSectionTypes: Object.freeze([
      "HERO",
      "CONTENT",
      "PROBLEM",
      "SOLUTION",
      "BENEFITS",
      "FEATURES",
      "TRUST",
    ]),
  }),
  Object.freeze({
    componentId: "LOADDER_GLOW_BANDS",
    componentVersion: 1,
    label: "نوارهای نور",
    description: "نوارهای کنترل‌شده برای بخش‌های برجسته",
    defaults: Object.freeze({
      orientation: "DIAGONAL",
      intensity: "SUBTLE",
      accentToken: "PRIMARY",
    }),
    allowedSectionTypes: Object.freeze([
      "HERO",
      "CONTENT",
      "BENEFITS",
      "FEATURES",
      "CTA",
    ]),
  }),
  Object.freeze({
    componentId: "LOADDER_GEOMETRIC_PATTERN",
    componentVersion: 1,
    label: "الگوی هندسی",
    description: "بافت هندسی آرام برای ساختار بصری",
    defaults: Object.freeze({
      pattern: "DIAMONDS",
      density: "SPARSE",
      intensity: "SUBTLE",
      accentToken: "PRIMARY",
    }),
    allowedSectionTypes: Object.freeze([
      "HERO",
      "CONTENT",
      "PROBLEM",
      "SOLUTION",
      "BENEFITS",
      "FEATURES",
      "TRUST",
    ]),
  }),
]);

const allowed = new Map(
  CUSTOMER_VISUAL_COMPONENTS.map((item) => [
    `${item.componentId}:${item.componentVersion}`,
    item,
  ]),
);
const selectable = (policy, registry) => {
  const entry = registry.get(policy.componentId, policy.componentVersion);
  if (
    !entry ||
    entry.manifest.provider !== "LOADDER_NATIVE" ||
    entry.manifest.runtimeTier !== "STATIC" ||
    !["ADMITTED", "ADMITTED_WITH_RESTRICTIONS"].includes(entry.admission.state)
  )
    return false;
  if (
    Object.entries(entry.manifest.securityPosture).some(
      ([key, value]) => key !== "reviewed" && value,
    )
  )
    return false;
  return ["PUBLISHABLE", "PUBLISHABLE_WITH_RESTRICTIONS"].includes(
    visualPublishingCompatibility(policy.componentId, policy.componentVersion, {
      registry,
    }).state,
  );
};
const options = (schema) =>
  Object.fromEntries(
    Object.entries(schema)
      .filter(([, rule]) => rule.type === "enum")
      .map(([key, rule]) => [key, [...rule.values]]),
  );

export function customerVisualCatalog({
  registry = visualComponentRegistry,
} = {}) {
  return Object.freeze(
    CUSTOMER_VISUAL_COMPONENTS.filter((policy) =>
      selectable(policy, registry),
    ).map((policy) => {
      const entry = registry.get(policy.componentId, policy.componentVersion);
      return Object.freeze({
        componentId: policy.componentId,
        componentVersion: policy.componentVersion,
        displayName: policy.label,
        description: policy.description,
        category: "BACKGROUND_STYLE",
        allowedProps: Object.freeze(options(entry.manifest.propsSchema)),
        defaults: policy.defaults,
        allowedSectionTypes: policy.allowedSectionTypes,
        restrictions: Object.freeze([
          "MAX_ONE_PER_PAGE",
          "MAX_ONE_VISUAL_PER_SECTION",
        ]),
      });
    }),
  );
}

export function assertCustomerVisualSelection(
  componentId,
  componentVersion,
  sectionType,
  { registry = visualComponentRegistry } = {},
) {
  const policy = allowed.get(`${componentId}:${componentVersion}`);
  if (!policy || !selectable(policy, registry)) {
    const error = new Error("VISUAL_COMPONENT_NOT_AVAILABLE");
    error.code = "VISUAL_COMPONENT_NOT_AVAILABLE";
    throw error;
  }
  if (!policy.allowedSectionTypes.includes(sectionType)) {
    const error = new Error("VISUAL_SECTION_INCOMPATIBLE");
    error.code = "VISUAL_SECTION_INCOMPATIBLE";
    throw error;
  }
  return policy;
}
