import { AiProviderError } from "../ai/ai-provider-errors.mjs";

const text = { type: "string", minLength: 1, maxLength: 1200 };
const shortText = { type: "string", minLength: 1, maxLength: 300 };
const stringList = (maximum) => ({ type: "array", maxItems: maximum, items: shortText });

export const businessDnaJsonSchema = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["businessSummary", "valueProposition", "targetAudience", "productsServices", "toneOfVoice", "marketPosition", "brandPersonality", "customerSegments", "growthOpportunities", "risks", "recommendedActions", "confidenceScore"],
  properties: {
    businessSummary: text,
    valueProposition: text,
    targetAudience: stringList(10),
    productsServices: stringList(12),
    toneOfVoice: stringList(8),
    marketPosition: text,
    brandPersonality: stringList(8),
    customerSegments: stringList(10),
    growthOpportunities: { type: "array", maxItems: 8, items: { type: "object", additionalProperties: false, required: ["title", "reason", "priority"], properties: { title: shortText, reason: text, priority: { type: "string", enum: ["بالا", "متوسط", "پایین"] } } } },
    risks: { type: "array", maxItems: 8, items: { type: "object", additionalProperties: false, required: ["title", "reason"], properties: { title: shortText, reason: text } } },
    recommendedActions: stringList(12),
    confidenceScore: { type: "integer", minimum: 0, maximum: 100 },
  },
});

const ROOT_KEYS = Object.freeze(Object.keys(businessDnaJsonSchema.properties));
const hasUnsafeControl = (value) => [...value].some((character) => { const code = character.codePointAt(0); return code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127 || (code >= 0x202A && code <= 0x202E) || (code >= 0x2066 && code <= 0x2069); });
const validText = (value, maximum) => typeof value === "string" && value.length >= 1 && value.length <= maximum && !hasUnsafeControl(value);
const validList = (value, maximum) => Array.isArray(value) && value.length <= maximum && value.every((item) => validText(item, 300));
const exact = (value, keys) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key));

export function validateBusinessDna(value) {
  if (!exact(value, ROOT_KEYS) || !validText(value.businessSummary, 1200) || !validText(value.valueProposition, 1200) || !validText(value.marketPosition, 1200) || !validList(value.targetAudience, 10) || !validList(value.productsServices, 12) || !validList(value.toneOfVoice, 8) || !validList(value.brandPersonality, 8) || !validList(value.customerSegments, 10) || !validList(value.recommendedActions, 12) || !Array.isArray(value.growthOpportunities) || value.growthOpportunities.length > 8 || !value.growthOpportunities.every((item) => exact(item, ["title", "reason", "priority"]) && validText(item.title, 300) && validText(item.reason, 1200) && ["بالا", "متوسط", "پایین"].includes(item.priority)) || !Array.isArray(value.risks) || value.risks.length > 8 || !value.risks.every((item) => exact(item, ["title", "reason"]) && validText(item.title, 300) && validText(item.reason, 1200)) || !Number.isInteger(value.confidenceScore) || value.confidenceScore < 0 || value.confidenceScore > 100) throw new AiProviderError("AI_OUTPUT_INVALID");
  return Object.freeze(structuredClone(value));
}
