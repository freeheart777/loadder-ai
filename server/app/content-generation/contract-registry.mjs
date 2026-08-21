import { assertContentMediaEnabled } from "./media-types.mjs";
import { contentPlacementRegistry } from "./placement-registry.mjs";

const CONTRACT_FIELDS = ["contractId", "contractVersion", "mediaType", "placementId", "placementVersion", "templateVersion", "providerBindingVersion", "safetyPolicyVersion", "maximumVariants", "maximumOutputCharacters", "outputSchema", "validateOutput"];
const exact = (value, fields, label) => {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((key) => !fields.includes(key)) || fields.some((key) => !Object.hasOwn(value, key))) throw new Error(`${label} is invalid.`);
};
const string = (value, field, maximum, { empty = false } = {}) => {
  if (typeof value !== "string" || (!empty && !value) || [...value].length > maximum) throw new Error(`${field} is invalid.`);
  return value;
};
const strings = (value, field, maximumItems, maximumCharacters, minimumItems = 0) => {
  if (!Array.isArray(value) || value.length < minimumItems || value.length > maximumItems) throw new Error(`${field} is invalid.`);
  return value.map((item) => string(item, field, maximumCharacters));
};
const totalCharacters = (value) => [...JSON.stringify(value)].length;

const objectSchema = (properties, required = Object.keys(properties)) => ({ type: "object", additionalProperties: false, properties, required });
const textSchema = (maxLength) => ({ type: "string", maxLength });
const arraySchema = (items, maxItems, minItems = 0) => ({ type: "array", items, maxItems, minItems });

function variantsValidator(variantFields, validateVariant, maximumCharacters) {
  return (output, expectedVariants) => {
    exact(output, ["variants"], "output");
    if (!Array.isArray(output.variants) || output.variants.length !== expectedVariants) throw new Error("variants is invalid.");
    const variants = output.variants.map((variant) => {
      exact(variant, variantFields, "variant");
      validateVariant(variant);
      if (totalCharacters(variant) > maximumCharacters) throw new Error("variant exceeds its output bound.");
      return Object.freeze(variant);
    });
    return Object.freeze(variants);
  };
}

const socialSchema = objectSchema({ variants: arraySchema(objectSchema({ hook: textSchema(500), body: textSchema(2200), cta: textSchema(300), hashtags: arraySchema(textSchema(100), 15) }), 3, 1) });
const adSchema = objectSchema({ variants: arraySchema(objectSchema({ headlines: arraySchema(textSchema(30), 3, 1), descriptions: arraySchema(textSchema(90), 2, 1), ctaLabel: textSchema(30) }), 3, 1) });
const emailSchema = objectSchema({ variants: arraySchema(objectSchema({ subject: textSchema(120), previewText: textSchema(160), greeting: textSchema(200), bodySections: arraySchema(textSchema(1500), 8, 1), cta: textSchema(300), signoff: textSchema(300) }), 3, 1) });
const blogSection = objectSchema({ heading: textSchema(300), keyPoints: arraySchema(textSchema(500), 8, 1) });
const blogSchema = objectSchema({ variants: arraySchema(objectSchema({ title: textSchema(300), seoTitle: textSchema(60), metaDescription: textSchema(160), primaryKeyword: textSchema(150), slug: textSchema(200), sections: arraySchema(blogSection, 10, 1) }), 3, 1) });
const landingSection = objectSchema({ heading: textSchema(300), body: textSchema(1500) });
const hero = objectSchema({ headline: textSchema(300), subheadline: textSchema(600), cta: textSchema(160) });
const faq = objectSchema({ question: textSchema(300), answer: textSchema(1000) });
const landingSchema = objectSchema({ variants: arraySchema(objectSchema({ hero, benefits: arraySchema(textSchema(500), 10, 1), sections: arraySchema(landingSection, 8, 1), proofPoints: arraySchema(textSchema(500), 10), faq: arraySchema(faq, 5), finalCta: textSchema(300) }), 3, 1) });

const DEFAULT_CONTRACTS = [
  { contractId: "social_post", contractVersion: 1, mediaType: "TEXT", placementId: "instagram.feed.text", placementVersion: 1, templateVersion: 1, providerBindingVersion: 1, safetyPolicyVersion: 1, maximumVariants: 3, maximumOutputCharacters: 3000, outputSchema: socialSchema, validateOutput: variantsValidator(["hook", "body", "cta", "hashtags"], (v) => { string(v.hook, "hook", 500); string(v.body, "body", 2200); string(v.cta, "cta", 300, { empty: true }); strings(v.hashtags, "hashtags", 15, 100); }, 3000) },
  { contractId: "ad_copy", contractVersion: 1, mediaType: "TEXT", placementId: "google_ads.search.text", placementVersion: 1, templateVersion: 1, providerBindingVersion: 1, safetyPolicyVersion: 1, maximumVariants: 3, maximumOutputCharacters: 1000, outputSchema: adSchema, validateOutput: variantsValidator(["headlines", "descriptions", "ctaLabel"], (v) => { strings(v.headlines, "headlines", 3, 30, 1); strings(v.descriptions, "descriptions", 2, 90, 1); string(v.ctaLabel, "ctaLabel", 30); }, 1000) },
  { contractId: "marketing_email", contractVersion: 1, mediaType: "TEXT", placementId: "email.marketing.text", placementVersion: 1, templateVersion: 1, providerBindingVersion: 1, safetyPolicyVersion: 1, maximumVariants: 3, maximumOutputCharacters: 5000, outputSchema: emailSchema, validateOutput: variantsValidator(["subject", "previewText", "greeting", "bodySections", "cta", "signoff"], (v) => { string(v.subject, "subject", 120); string(v.previewText, "previewText", 160); string(v.greeting, "greeting", 200); strings(v.bodySections, "bodySections", 8, 1500, 1); string(v.cta, "cta", 300, { empty: true }); string(v.signoff, "signoff", 300); }, 5000) },
  { contractId: "blog_outline", contractVersion: 1, mediaType: "TEXT", placementId: "blog.article.text", placementVersion: 1, templateVersion: 1, providerBindingVersion: 1, safetyPolicyVersion: 1, maximumVariants: 3, maximumOutputCharacters: 8000, outputSchema: blogSchema, validateOutput: variantsValidator(["title", "seoTitle", "metaDescription", "primaryKeyword", "slug", "sections"], (v) => { string(v.title, "title", 300); string(v.seoTitle, "seoTitle", 60); string(v.metaDescription, "metaDescription", 160); string(v.primaryKeyword, "primaryKeyword", 150); string(v.slug, "slug", 200); if (!Array.isArray(v.sections) || !v.sections.length || v.sections.length > 10) throw new Error("sections is invalid."); for (const s of v.sections) { exact(s, ["heading", "keyPoints"], "section"); string(s.heading, "heading", 300); strings(s.keyPoints, "keyPoints", 8, 500, 1); } }, 8000) },
  { contractId: "landing_page_copy", contractVersion: 1, mediaType: "TEXT", placementId: "website.landing.text", placementVersion: 1, templateVersion: 1, providerBindingVersion: 1, safetyPolicyVersion: 1, maximumVariants: 3, maximumOutputCharacters: 10000, outputSchema: landingSchema, validateOutput: variantsValidator(["hero", "benefits", "sections", "proofPoints", "faq", "finalCta"], (v) => { exact(v.hero, ["headline", "subheadline", "cta"], "hero"); string(v.hero.headline, "headline", 300); string(v.hero.subheadline, "subheadline", 600); string(v.hero.cta, "cta", 160, { empty: true }); strings(v.benefits, "benefits", 10, 500, 1); if (!Array.isArray(v.sections) || !v.sections.length || v.sections.length > 8) throw new Error("sections is invalid."); for (const s of v.sections) { exact(s, ["heading", "body"], "section"); string(s.heading, "heading", 300); string(s.body, "body", 1500); } strings(v.proofPoints, "proofPoints", 10, 500); if (!Array.isArray(v.faq) || v.faq.length > 5) throw new Error("faq is invalid."); for (const item of v.faq) { exact(item, ["question", "answer"], "faq"); string(item.question, "question", 300); string(item.answer, "answer", 1000); } string(v.finalCta, "finalCta", 300); }, 10000) },
];

function normalize(contract, placements) {
  exact(contract, CONTRACT_FIELDS, "contract");
  if (!/^[a-z][a-z0-9_]{0,99}$/.test(contract.contractId) || !["contractVersion", "templateVersion", "providerBindingVersion", "safetyPolicyVersion", "maximumVariants", "maximumOutputCharacters"].every((field) => Number.isInteger(contract[field]) && contract[field] > 0) || contract.maximumVariants > 3 || typeof contract.validateOutput !== "function") throw new Error("Generation contract is invalid.");
  assertContentMediaEnabled(contract.mediaType);
  const placement = placements.get(contract.placementId, contract.placementVersion);
  if (!placement || placement.mediaType !== contract.mediaType) throw new Error("Generation contract placement is invalid.");
  return Object.freeze(contract);
}

export function createGenerationContractRegistry(contracts = DEFAULT_CONTRACTS, placements = contentPlacementRegistry) {
  const entries = contracts.map((item) => normalize(item, placements));
  const map = new Map(entries.map((item) => [`${item.contractId}@${item.contractVersion}`, item]));
  if (map.size !== entries.length) throw new Error("Duplicate generation contract.");
  return Object.freeze({ get: (id, version) => map.get(`${id}@${version}`) || null, list: () => [...map.values()] });
}

export const generationContractRegistry = createGenerationContractRegistry();
