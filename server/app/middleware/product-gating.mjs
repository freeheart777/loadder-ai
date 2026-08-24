import { FEATURE_EXPOSURE } from "../product-policy.mjs";

const MUTATIONS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function createProductionOriginGuard({ nodeEnv = "development", clientOrigins = [] } = {}) {
  return (req, res, next) => {
    const requestPath = String(req.path || "");
    if (requestPath === "/api/public/landing/events" || (requestPath.startsWith("/api/public/forms/") && requestPath.endsWith("/submissions"))) return next();
    if (nodeEnv !== "production" || !MUTATIONS.has(String(req.method).toUpperCase())) return next();
    const origin = String(req.headers.origin || "");
    if (origin && clientOrigins.includes(origin)) return next();
    return res.status(403).json({
      success: false,
      code: "ORIGIN_NOT_ALLOWED",
      message: "Request origin is not allowed.",
    });
  };
}

export function featureDisabled(res, feature) {
  return res.status(403).json({
    success: false,
    code: "FEATURE_DISABLED",
    feature,
    message: "This operation is not available.",
  });
}

export function requireFeature(policy, feature, { allowInternal = false } = {}) {
  return (req, res, next) => {
    const exposure = policy.exposure(feature);
    if (exposure === FEATURE_EXPOSURE.CUSTOMER) return next();
    if (allowInternal && exposure === FEATURE_EXPOSURE.INTERNAL && req.internalAccess === true) return next();
    return featureDisabled(res, feature);
  };
}

export function createInternalAccessMiddleware({ token = "", nodeEnv = "development" } = {}) {
  return (req, _res, next) => {
    const supplied = String(req.headers["x-loadder-internal-token"] || "");
    req.internalAccess = Boolean(token) && supplied.length === token.length && supplied === token;
    if (nodeEnv === "test" && supplied === "loadder-test-internal") req.internalAccess = true;
    next();
  };
}

const exactMutation = new Map([
  ["/api/events", "legacy_automation"],
  ["/api/customers", "legacy_crm"],
  ["/api/leads", "legacy_crm"],
  ["/api/orders", "legacy_crm"],
  ["/api/carts", "legacy_crm"],
  ["/api/marketing/attribution", "legacy_marketing"],
  ["/api/ai/chat", "experimental_ai"],
  ["/api/business-brain/analyze", "experimental_ai"],
]);

const controlledLaunchRoutes = [
  [/^\/api\/(business-profile|business-dna|brand-book|business-context|model-specifications|model-inputs)(?:\/|$)/, "business_setup", false],
  [/^\/api\/growth(?:\/|$)/, "growth_workflow", false],
  [/^\/api\/content\/(items|generations)(?:\/|$)|^\/api\/(creative-intents|creative-placements)(?:\/|$)/, "content_studio", false],
  [/^\/api\/(websites|website-pages)(?:\/|$)/, "website_builder", false],
  [/^\/api\/(forms|crm)(?:\/|$)/, "forms_crm", false],
  [/^\/api\/content\/assets(?:\/|$)|^\/api\/content-assets(?:\/|$)/, "asset_upload", true],
  [/^\/api\/commerce\/(catalogs|archetypes|products)(?:\/|$)/, "commerce_catalog", true],
  [/^\/api\/(domains|domain-bindings)(?:\/|$)/, "custom_domains", true],
  [/^\/api\/commerce\/(inventory|fulfillments|shipments|orders|shipping)(?:\/|$)/, "commerce_transactions", true],
  [/^\/api\/commerce\/(marketplaces|integration-hub)(?:\/|$)|^\/api\/(connections|connector-definitions|integrations)(?:\/|$)/, "marketplace_integrations", true],
  [/^\/api\/(attribution\/touches|distribution-contexts|performance\/observations)(?:\/|$)/, "advanced_measurement", true],
  [/^\/api\/(forecasts|forecast-specifications|knowledge-|features|feature-set|evaluations|extraction-runs|imports|import-mappers|imported-facts|signals|observations|workflow-outcomes)(?:\/|$)/, "development_tools", true],
];

export const MEANINGFUL_PRODUCT_ROUTE_GROUPS = Object.freeze(controlledLaunchRoutes.map(([pattern, feature, internal]) => Object.freeze({ pattern: pattern.source, feature, internal })));

export function classifyApiRequest(method, path) {
  const upper = String(method).toUpperCase();
  if (/^\/api\/onboarding(?:\/|$)/.test(path)) {
    return { feature: "business_setup", internal: false };
  }
  if (/^\/api\/landing(?:\/|$)/.test(path)) return { feature: "landing_builder", internal: false };
  if (/^\/api\/integrations\/connections\/[^/]+\/account-identities(?:\/|$)/.test(path)) return { feature: "execution", internal: upper === "GET" };
  for (const [pattern, feature, internal] of controlledLaunchRoutes) {
    if (pattern.test(path)) return { feature, internal };
  }
  if (upper === "POST" && /^\/api\/intelligence\/decisions\/[^/]+\/action-proposals$/.test(path)) {
    return { feature: "execution", internal: false };
  }
  if (!MUTATIONS.has(upper)) {
    if (/^\/api\/internal\/(quality|visual-components|visual-publishing|visual-recommendation-benchmark)(?:\/|$)/.test(path)) return { feature: "development_tools", internal: true };
    if (/^\/api\/improvement(?:\/|$)/.test(path)) return { feature: "continuous_improvement", internal: false };
    if (/^\/api\/system-analysis(?:\/|$)/.test(path)) return { feature: "continuous_improvement", internal: false };
    if (/^\/api\/ai\/economy(?:\/|$)/.test(path)) return { feature: "development_tools", internal: true };
    if (/^\/api\/(messaging\/status|database\/status)/.test(path)) return { feature: "development_tools", internal: true };
    if (/^\/api\/(execution|provider-account-identities|integrations\/connections\/[^/]+\/account-identities)/.test(path)) return { feature: "execution", internal: true };
    if (/^\/api\/intelligence/.test(path)) return { feature: "intelligence", internal: true };
    if (/^\/api\/content\/generations(?:\/|$)/.test(path)) return { feature: "content_studio", internal: false };
    if (/^\/api\/(automations|executions)/.test(path)) return { feature: "legacy_automation", internal: true };
    if (/^\/api\/(crm|customers|leads|orders|carts)/.test(path)) return { feature: "legacy_crm", internal: true };
    if (/^\/api\/marketing/.test(path)) return { feature: "legacy_marketing", internal: true };
    return null;
  }
  if (/^\/api\/improvement(?:\/|$)/.test(path)) return { feature: "continuous_improvement", internal: false };
  if (/^\/api\/internal\/(quality|visual-components|visual-publishing|visual-recommendation-benchmark)(?:\/|$)/.test(path)) return { feature: "development_tools", internal: true };
  if (/^\/api\/system-analysis(?:\/|$)/.test(path)) return { feature: "continuous_improvement", internal: false };
  if (upper === "POST" && path === "/api/content/generate") return { feature: "content_studio", internal: false };
  if (upper === "POST" && path === "/api/agent/run") return { feature: "experimental_ai", internal: true };
  if (/^\/api\/customers\/[^/]+\/message$/.test(path)) return { feature: "legacy_messaging", internal: false };
  if (/^\/api\/automations(\/|$)/.test(path) || /^\/api\/executions(\/|$)/.test(path)) return { feature: "legacy_automation", internal: false };
  if (/^\/api\/(leads|orders|carts)(\/|$)/.test(path)) return { feature: "legacy_crm", internal: false };
  if (/^\/api\/marketing(\/|$)/.test(path)) return { feature: "legacy_marketing", internal: false };
  if (/^\/api\/intelligence(\/|$)/.test(path)) return { feature: "intelligence", internal: true };
  if (/^\/api\/(execution|integrations\/connections\/[^/]+\/account-identities)/.test(path)) return { feature: "execution", internal: false };
  return exactMutation.has(path) ? { feature: exactMutation.get(path), internal: path === "/api/business-brain/analyze" } : null;
}

export function createApiProductGate(policy) {
  return (req, res, next) => {
    const rule = classifyApiRequest(req.method, req.path);
    if (!rule) {
      if (policy.controlled && String(req.path || "").startsWith("/api/")) {
        return res.status(403).json({ success: false, code: "FEATURE_NOT_AVAILABLE_IN_CONTROLLED_LAUNCH", feature: "unclassified_product_route", message: "This operation is not available." });
      }
      return next();
    }
    const exposure = policy.exposure(rule.feature);
    if (exposure === FEATURE_EXPOSURE.CUSTOMER) return next();
    if (rule.internal && exposure === FEATURE_EXPOSURE.INTERNAL && req.internalAccess === true) return next();
    if (policy.controlled && ["asset_upload", "commerce_catalog", "custom_domains", "commerce_transactions", "marketplace_integrations", "advanced_measurement"].includes(rule.feature)) {
      return res.status(403).json({ success: false, code: "FEATURE_NOT_AVAILABLE_IN_CONTROLLED_LAUNCH", feature: rule.feature, message: "This operation is not available." });
    }
    return featureDisabled(res, rule.feature);
  };
}

export function createPublicControlledLaunchGate(policy) {
  return (req, res, next) => {
    if (!policy.controlled) return next();
    const path = String(req.path || "");
    if (/^\/api\/public\/(landing|landings|forms)(?:\/|$)/.test(path)) return next();
    if (/^\/api\/public\/commerce\/marketplaces(?:\/|$)/.test(path)) {
      return res.status(403).json({ success: false, code: "FEATURE_NOT_AVAILABLE_IN_CONTROLLED_LAUNCH", feature: "marketplace_integrations", message: "This operation is not available." });
    }
    if (/^\/api\/public\/commerce(?:\/|$)|^\/api\/public\/hosts?(?:\/|$)/.test(path)) {
      return res.status(403).json({ success: false, code: "FEATURE_NOT_AVAILABLE_IN_CONTROLLED_LAUNCH", feature: "commerce_transactions", message: "This operation is not available." });
    }
    return next();
  };
}

export function assertLegacyOperationEnabled(policy, feature = "legacy_automation") {
  if (!policy.isCustomer(feature)) {
    const error = new Error("This operation is not available.");
    error.code = "FEATURE_DISABLED";
    error.feature = feature;
    throw error;
  }
}
