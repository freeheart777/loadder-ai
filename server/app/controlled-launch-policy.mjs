export const CONTROLLED_LAUNCH_POLICY_VERSION = "CONTROLLED_LAUNCH_POLICY_V1";
export const LAUNCH_CATEGORY = Object.freeze({ CORE: "CORE", OPTIONAL_READY: "OPTIONAL_READY", HIDDEN_FOR_LAUNCH: "HIDDEN_FOR_LAUNCH", INTERNAL_ONLY: "INTERNAL_ONLY", DEFERRED: "DEFERRED" });

const rows = [
  ["business_setup", "CORE", true], ["growth_workflow", "CORE", true, "OPENAI"], ["content_studio", "CORE", true, "OPENAI"],
  ["website_builder", "CORE", true, "WEBSITE_PUBLISHING"], ["landing_builder", "CORE", true, "LANDING_PUBLISHING"],
  ["forms_crm", "CORE", true], ["visual_static", "CORE", true], ["continuous_improvement", "OPTIONAL_READY", true],
  ["commerce_catalog", "HIDDEN_FOR_LAUNCH", false], ["custom_domains", "HIDDEN_FOR_LAUNCH", false],
  ["commerce_transactions", "HIDDEN_FOR_LAUNCH", false], ["marketplace_integrations", "HIDDEN_FOR_LAUNCH", false],
  ["asset_upload", "HIDDEN_FOR_LAUNCH", false, "ASSET_STORAGE"], ["advanced_measurement", "HIDDEN_FOR_LAUNCH", false],
  ["intelligence", "INTERNAL_ONLY", false], ["development_tools", "INTERNAL_ONLY", false], ["execution", "HIDDEN_FOR_LAUNCH", false],
  ["experimental_ai", "INTERNAL_ONLY", false], ["legacy_crm", "DEFERRED", false], ["legacy_marketing", "DEFERRED", false],
  ["legacy_automation", "DEFERRED", false], ["legacy_messaging", "DEFERRED", false],
];

export const CONTROLLED_LAUNCH_POLICY_V1 = Object.freeze(rows.map(([featureId, launchCategory, backendAllowed, requiresProvider = null]) => Object.freeze({
  featureId, launchCategory, customerVisible: backendAllowed, backendAllowed,
  internalAllowed: launchCategory === LAUNCH_CATEGORY.INTERNAL_ONLY,
  requiresProvider, coreLaunch: launchCategory === LAUNCH_CATEGORY.CORE,
  reason: launchCategory === LAUNCH_CATEGORY.HIDDEN_FOR_LAUNCH ? "NOT_AVAILABLE_IN_CONTROLLED_LAUNCH" : null,
})));

export function projectControlledLaunchMatrix(dependencies = {}) {
  return CONTROLLED_LAUNCH_POLICY_V1.map((entry) => ({ ...entry,
    dependencyReady: !entry.requiresProvider || dependencies[entry.requiresProvider] === true,
    launchReady: entry.backendAllowed && (!entry.requiresProvider || dependencies[entry.requiresProvider] === true),
  }));
}
