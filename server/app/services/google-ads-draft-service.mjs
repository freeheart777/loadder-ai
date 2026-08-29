export class GoogleAdsDraftError extends Error {
  constructor(message, status = 400, code = "GOOGLE_ADS_DRAFT_ERROR", details = []) { super(message); this.status = status; this.code = code; this.details = details; }
}

const text = (v) => typeof v === "string" ? v.trim() : "";
const allowedMatchTypes = new Set(["BROAD", "PHRASE", "EXACT"]);
const allowedBidding = new Set(["MAXIMIZE_CLICKS", "MAXIMIZE_CONVERSIONS", "MANUAL_CPC"]);
const httpsUrl = (value) => { try { const u = new URL(value); return u.protocol === "https:"; } catch { return false; } };

export function validateGoogleSearchDraft(input = {}) {
  const errors = [];
  const headlines = Array.isArray(input.headlines) ? input.headlines.map(text).filter(Boolean) : [];
  const descriptions = Array.isArray(input.descriptions) ? input.descriptions.map(text).filter(Boolean) : [];
  const keywords = Array.isArray(input.keywords) ? input.keywords : [];
  if (!text(input.name)) errors.push({ field: "name", code: "REQUIRED" });
  if (!Number.isInteger(input.dailyBudgetMicros) || input.dailyBudgetMicros <= 0) errors.push({ field: "dailyBudgetMicros", code: "INVALID_BUDGET" });
  if (!allowedBidding.has(input.biddingStrategy)) errors.push({ field: "biddingStrategy", code: "INVALID_BIDDING_STRATEGY" });
  if (!text(input.adGroupName)) errors.push({ field: "adGroupName", code: "REQUIRED" });
  if (!httpsUrl(input.finalUrl)) errors.push({ field: "finalUrl", code: "HTTPS_URL_REQUIRED" });
  if (headlines.length < 3 || headlines.length > 15) errors.push({ field: "headlines", code: "HEADLINE_COUNT" });
  headlines.forEach((h, i) => { if ([...h].length > 30) errors.push({ field: `headlines.${i}`, code: "MAX_30_CHARS" }); });
  if (descriptions.length < 2 || descriptions.length > 4) errors.push({ field: "descriptions", code: "DESCRIPTION_COUNT" });
  descriptions.forEach((d, i) => { if ([...d].length > 90) errors.push({ field: `descriptions.${i}`, code: "MAX_90_CHARS" }); });
  if (!keywords.length) errors.push({ field: "keywords", code: "AT_LEAST_ONE_KEYWORD" });
  keywords.forEach((k, i) => {
    if (!text(k?.text)) errors.push({ field: `keywords.${i}.text`, code: "REQUIRED" });
    if (!allowedMatchTypes.has(k?.matchType)) errors.push({ field: `keywords.${i}.matchType`, code: "INVALID_MATCH_TYPE" });
  });
  return errors;
}

export function buildGoogleSearchMutationPlan(input) {
  const budgetTemp = "customers/{customerId}/campaignBudgets/-1";
  const campaignTemp = "customers/{customerId}/campaigns/-2";
  const adGroupTemp = "customers/{customerId}/adGroups/-3";
  return {
    version: 1,
    provider: "google_ads",
    channelType: "SEARCH",
    initialCampaignStatus: "PAUSED",
    operations: [
      { entity: "CampaignBudget", create: { resourceName: budgetTemp, name: `${input.name} - Budget`, amountMicros: input.dailyBudgetMicros, explicitlyShared: false } },
      { entity: "Campaign", create: { resourceName: campaignTemp, name: input.name, advertisingChannelType: "SEARCH", status: "PAUSED", campaignBudget: budgetTemp, biddingStrategy: input.biddingStrategy, networkSettings: { targetGoogleSearch: true, targetSearchNetwork: Boolean(input.searchPartners), targetContentNetwork: false } } },
      { entity: "AdGroup", create: { resourceName: adGroupTemp, campaign: campaignTemp, name: input.adGroupName, status: "ENABLED" } },
      ...input.keywords.map((keyword) => ({ entity: "AdGroupCriterion", create: { adGroup: adGroupTemp, status: "ENABLED", keyword: { text: text(keyword.text), matchType: keyword.matchType } } })),
      { entity: "AdGroupAd", create: { adGroup: adGroupTemp, status: "ENABLED", ad: { finalUrls: [input.finalUrl], responsiveSearchAd: { headlines: input.headlines.map((h) => ({ text: text(h) })), descriptions: input.descriptions.map((d) => ({ text: text(d) })), path1: text(input.path1) || undefined, path2: text(input.path2) || undefined } } } },
    ],
  };
}

export function createGoogleAdsDraftService({ repository, now = () => new Date() }) {
  const prepare = (payload) => {
    const normalized = { ...payload, name: text(payload.name), adGroupName: text(payload.adGroupName), finalUrl: text(payload.finalUrl), headlines: Array.isArray(payload.headlines) ? payload.headlines.map(text) : [], descriptions: Array.isArray(payload.descriptions) ? payload.descriptions.map(text) : [], keywords: Array.isArray(payload.keywords) ? payload.keywords.map((k) => ({ text: text(k?.text), matchType: k?.matchType })) : [] };
    const validation = validateGoogleSearchDraft(normalized);
    const googleResource = validation.length ? {} : buildGoogleSearchMutationPlan(normalized);
    return { normalized, validation, googleResource, status: validation.length ? "DRAFT" : "VALID" };
  };
  const get = (id) => { const row = repository.get(id); if (!row) throw new GoogleAdsDraftError("Campaign draft not found.", 404, "GOOGLE_ADS_DRAFT_NOT_FOUND"); return row; };
  return Object.freeze({
    list: () => repository.list(),
    get,
    create(payload) { const p = prepare(payload || {}); return repository.create({ name: p.normalized.name || "کمپین بدون نام", payload: p.normalized, validation: p.validation, googleResource: p.googleResource, status: p.status, connectionId: null, customerId: null, at: now().toISOString() }); },
    update(id, payload) { get(id); const p = prepare(payload || {}); return repository.update(id, { name: p.normalized.name || "کمپین بدون نام", payload: p.normalized, validation: p.validation, googleResource: p.googleResource, status: p.status, connectionId: null, customerId: null, at: now().toISOString() }); },
    validate(id) { const current = get(id); const p = prepare(current.payload); return repository.update(id, { name: current.name, payload: p.normalized, validation: p.validation, googleResource: p.googleResource, status: p.status, connectionId: current.connectionId, customerId: current.customerId, at: now().toISOString() }); },
    prepareForGoogle(id) { const current = get(id); const p = prepare(current.payload); if (p.validation.length) throw new GoogleAdsDraftError("Campaign draft has validation errors.", 422, "GOOGLE_ADS_DRAFT_INVALID", p.validation); return { draft: repository.update(id, { name: current.name, payload: p.normalized, validation: [], googleResource: p.googleResource, status: "READY_FOR_AUTH", connectionId: current.connectionId, customerId: current.customerId, at: now().toISOString() }), mutationPlan: p.googleResource, requires: ["google_ads_oauth_connection", "customer_account_selection", "explicit_publish_confirmation"], executed: false }; },
    remove(id) { get(id); repository.remove(id); return true; },
  });
}
