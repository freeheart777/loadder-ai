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

export function classifyApiRequest(method, path) {
  const upper = String(method).toUpperCase();
  if (/^\/api\/onboarding(?:\/|$)/.test(path)) {
    return { feature: "business_setup", internal: false };
  }
  if (/^\/api\/landing(?:\/|$)/.test(path)) return { feature: "landing_builder", internal: false };
  if (upper === "POST" && /^\/api\/intelligence\/decisions\/[^/]+\/action-proposals$/.test(path)) {
    return { feature: "execution", internal: false };
  }
  if (!MUTATIONS.has(upper)) {
    if (/^\/api\/(messaging\/status|database\/status)/.test(path)) return { feature: "development_tools", internal: true };
    if (/^\/api\/(execution|provider-account-identities|integrations\/connections\/[^/]+\/account-identities)/.test(path)) return { feature: "execution", internal: true };
    if (/^\/api\/intelligence/.test(path)) return { feature: "intelligence", internal: true };
    if (/^\/api\/content\/generations(?:\/|$)/.test(path)) return { feature: "content_studio", internal: false };
    if (/^\/api\/(automations|executions)/.test(path)) return { feature: "legacy_automation", internal: true };
    if (/^\/api\/(crm|customers|leads|orders|carts)/.test(path)) return { feature: "legacy_crm", internal: true };
    if (/^\/api\/marketing/.test(path)) return { feature: "legacy_marketing", internal: true };
    return null;
  }
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
    if (!rule) return next();
    const exposure = policy.exposure(rule.feature);
    if (exposure === FEATURE_EXPOSURE.CUSTOMER) return next();
    if (rule.internal && exposure === FEATURE_EXPOSURE.INTERNAL && req.internalAccess === true) return next();
    return featureDisabled(res, rule.feature);
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
