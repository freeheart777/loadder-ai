const FIELDS = Object.freeze([
  "goal", "offering", "audienceRefinement", "keyMessage", "cta", "language",
  "toneOverride", "constraints", "referenceText",
]);

function text(value, field, maximum, required = false) {
  if (value === undefined || value === null) {
    if (required) throw new Error(`${field} is required.`);
    return null;
  }
  if (typeof value !== "string") throw new Error(`${field} must be text.`);
  const normalized = value.trim();
  if ((required && !normalized) || [...normalized].length > maximum) {
    throw new Error(`${field} is outside its allowed length.`);
  }
  return normalized || null;
}

export function validateContentBrief(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("brief must be an object.");
  if (Object.keys(input).some((field) => !FIELDS.includes(field))) throw new Error("brief contains unsupported fields.");
  if (input.language !== "fa-IR") throw new Error("language is not supported.");
  if (input.constraints !== undefined && (!Array.isArray(input.constraints) || input.constraints.length > 10)) {
    throw new Error("constraints is invalid.");
  }
  const constraints = (input.constraints || []).map((item) => text(item, "constraint", 300, true));
  return Object.freeze({
    goal: text(input.goal, "goal", 300, true),
    offering: text(input.offering, "offering", 500, true),
    audienceRefinement: text(input.audienceRefinement, "audienceRefinement", 500),
    keyMessage: text(input.keyMessage, "keyMessage", 500, true),
    cta: text(input.cta, "cta", 160),
    language: "fa-IR",
    toneOverride: text(input.toneOverride, "toneOverride", 200),
    constraints: Object.freeze(constraints),
    referenceText: text(input.referenceText, "referenceText", 2000),
  });
}
