import crypto from "node:crypto";
import { customerVisualCatalog } from "./website-visual-selection.mjs";
import {
  createVisualPublicationDescriptor,
  VISUAL_PUBLISHER_RUNTIME_V1,
} from "../visual-publishing/visual-publisher-contract.mjs";
import { visualComponentRegistry } from "../visual-components/visual-component-registry.mjs";

export const VISUAL_RECOMMENDATION_POLICY_VERSION =
  "VISUAL_RECOMMENDATION_POLICY_V1";
export const VISUAL_DESIGN_PURPOSES = Object.freeze({
  LOADDER_GRADIENT_FIELD: "ATMOSPHERIC",
  LOADDER_GLOW_BANDS: "EMPHASIS",
  LOADDER_GEOMETRIC_PATTERN: "STRUCTURED",
});
const fit = Object.freeze({
  HERO: Object.freeze({ ATMOSPHERIC: 3, EMPHASIS: 3, STRUCTURED: 1 }),
  CONTENT: Object.freeze({ ATMOSPHERIC: 2, EMPHASIS: 2, STRUCTURED: 3 }),
  PROBLEM: Object.freeze({ ATMOSPHERIC: 2, STRUCTURED: 3 }),
  SOLUTION: Object.freeze({ ATMOSPHERIC: 2, STRUCTURED: 3 }),
  BENEFITS: Object.freeze({ ATMOSPHERIC: 2, EMPHASIS: 2, STRUCTURED: 3 }),
  FEATURES: Object.freeze({ ATMOSPHERIC: 2, EMPHASIS: 2, STRUCTURED: 3 }),
  TRUST: Object.freeze({ ATMOSPHERIC: 2, STRUCTURED: 3 }),
  CTA: Object.freeze({ EMPHASIS: 3 }),
});
export const VISUAL_RECOMMENDATION_POLICY_V1 = Object.freeze({
  policyVersion: VISUAL_RECOMMENDATION_POLICY_VERSION,
  fitMatrixVersion: 1,
  fit,
  replaceMinimumAdvantage: 2,
  maxAlternatives: 2,
  stablePriority: Object.freeze([
    "LOADDER_GRADIENT_FIELD",
    "LOADDER_GLOW_BANDS",
    "LOADDER_GEOMETRIC_PATTERN",
  ]),
});
const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, canonical(value[key])]),
        )
      : value;
const hash = (value) =>
  crypto
    .createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
const density = (count) =>
  count >= VISUAL_PUBLISHER_RUNTIME_V1.pageBudget.maxVisualComponentsPerPage
    ? "AT_LIMIT"
    : count >= 3
      ? "HIGH"
      : count >= 1
        ? "BALANCED"
        : "LOW";
const posture = (score) =>
  score >= 3
    ? "STRONG"
    : score >= 2
      ? "GOOD"
      : score >= 1
        ? "WEAK"
        : "NOT_APPLICABLE";
const purposeReason = (sectionType, purpose) =>
  `SECTION_${sectionType}_${purpose}_FIT`;
const propsFor = (componentId, sectionType, defaults) =>
  componentId === "LOADDER_GRADIENT_FIELD"
    ? {
        ...defaults,
        variant: sectionType === "HERO" ? "HALO" : "AURORA",
        intensity: "SUBTLE",
        accentToken: "PRIMARY",
      }
    : componentId === "LOADDER_GLOW_BANDS"
      ? {
          ...defaults,
          orientation: sectionType === "CTA" ? "HORIZONTAL" : "DIAGONAL",
          intensity: sectionType === "CTA" ? "BALANCED" : "SUBTLE",
          accentToken: sectionType === "CTA" ? "PRIMARY" : "SECONDARY",
        }
      : componentId === "LOADDER_GEOMETRIC_PATTERN"
        ? {
            ...defaults,
            pattern: "DIAMONDS",
            density: "SPARSE",
            intensity: "SUBTLE",
            accentToken: "MUTED",
          }
        : { ...defaults };

export function recommendWebsiteVisual({
  websiteId,
  pageId,
  sectionId,
  baseRevisionId,
  blueprint,
  registry = visualComponentRegistry,
  generatedAt = new Date().toISOString(),
}) {
  const section = blueprint.sections.find((item) => item.id === sectionId);
  if (!section) {
    const error = new Error("WEBSITE_SECTION_NOT_FOUND");
    error.code = "WEBSITE_SECTION_NOT_FOUND";
    throw error;
  }
  const bindings = Array.isArray(blueprint.websiteVisualDescriptors)
      ? blueprint.websiteVisualDescriptors
      : [],
    current = bindings.find((item) => item.sectionId === sectionId) || null,
    usedElsewhere = new Set(
      bindings
        .filter((item) => item.sectionId !== sectionId)
        .map(
          (item) =>
            `${item.descriptor.componentId}:${item.descriptor.componentVersion}`,
        ),
    ),
    visualDensity = density(bindings.length),
    catalog = customerVisualCatalog({ registry });
  const ranked = catalog
    .filter(
      (item) =>
        item.allowedSectionTypes.includes(section.componentId) &&
        !usedElsewhere.has(`${item.componentId}:${item.componentVersion}`),
    )
    .map((item) => {
      const purpose = VISUAL_DESIGN_PURPOSES[item.componentId],
        score = fit[section.componentId]?.[purpose] || 0,
        props = propsFor(item.componentId, section.componentId, item.defaults);
      createVisualPublicationDescriptor(
        {
          componentId: item.componentId,
          componentVersion: item.componentVersion,
          props,
          assetRefs: [],
        },
        { registry },
      );
      return Object.freeze({
        componentId: item.componentId,
        componentVersion: item.componentVersion,
        displayName: item.displayName,
        props: Object.freeze(props),
        fitPosture: posture(score),
        score,
        reasonCodes: Object.freeze([
          purposeReason(section.componentId, purpose),
          "STATIC_LOW_RUNTIME_COST",
          "TOKEN_AVAILABLE",
        ]),
      });
    })
    .filter((item) => item.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        VISUAL_RECOMMENDATION_POLICY_V1.stablePriority.indexOf(a.componentId) -
          VISUAL_RECOMMENDATION_POLICY_V1.stablePriority.indexOf(b.componentId),
    );
  const currentCandidate = current
      ? ranked.find(
          (item) =>
            item.componentId === current.descriptor.componentId &&
            item.componentVersion === current.descriptor.componentVersion,
        )
      : null,
    top = ranked[0] || null;
  let action = "NO_RECOMMENDATION",
    candidate = null,
    reasons = ["NO_ELIGIBLE_CANDIDATE"],
    uncertainty = "LIMITED_PRODUCT_EVIDENCE";
  if (current && currentCandidate) {
    if (
      !top ||
      top.score - currentCandidate.score <
        VISUAL_RECOMMENDATION_POLICY_V1.replaceMinimumAdvantage
    ) {
      action = "KEEP";
      candidate = currentCandidate;
      reasons = [
        "CURRENT_VISUAL_ALREADY_SUITABLE",
        ...currentCandidate.reasonCodes,
      ];
      uncertainty = "RULE_BASED";
    } else {
      action = "REPLACE";
      candidate = top;
      reasons = ["CURRENT_VISUAL_WEAK_FIT", ...top.reasonCodes];
      uncertainty = "RULE_BASED";
    }
  } else if (current && !currentCandidate) {
    action = "REMOVE";
    reasons = [
      "CURRENT_VISUAL_NO_LONGER_ELIGIBLE",
      "REMOVE_TO_REDUCE_VISUAL_DENSITY",
    ];
  } else if (top && visualDensity !== "AT_LIMIT") {
    action = "ADD";
    candidate = top;
    reasons = [
      visualDensity === "LOW"
        ? "PAGE_VISUAL_DENSITY_LOW"
        : "PAGE_VISUAL_DENSITY_BALANCED",
      ...top.reasonCodes,
    ];
    uncertainty = "RULE_BASED";
  } else if (visualDensity === "AT_LIMIT") {
    reasons = ["PAGE_BUDGET_AT_LIMIT", "NO_ELIGIBLE_CANDIDATE"];
  }
  const alternatives = ranked
    .filter(
      (item) =>
        item.componentId !== candidate?.componentId &&
        item.componentId !== current?.descriptor.componentId,
    )
    .slice(0, VISUAL_RECOMMENDATION_POLICY_V1.maxAlternatives)
    .map((item) => ({
      componentId: item.componentId,
      componentVersion: item.componentVersion,
      displayName: item.displayName,
      props: item.props,
      fitPosture: item.fitPosture,
      reasonCodes: item.reasonCodes,
    }));
  const context = {
    policyVersion: VISUAL_RECOMMENDATION_POLICY_VERSION,
    websiteId,
    pageId,
    sectionId,
    baseRevisionId,
    sectionType: section.componentId,
    currentVisual: current
      ? `${current.descriptor.componentId}:${current.descriptor.componentVersion}`
      : "NO_VISUAL",
    pageVisualCount: bindings.length,
    visualDensity,
    eligibleCandidates: ranked.map(
      (item) => `${item.componentId}:${item.componentVersion}`,
    ),
    designTokenIdentities: ["PRIMARY", "SECONDARY", "MUTED"],
  };
  return Object.freeze({
    recommendationVersion: 1,
    policyVersion: VISUAL_RECOMMENDATION_POLICY_VERSION,
    websiteId,
    pageId,
    sectionId,
    baseRevisionId,
    action,
    candidate:
      candidate &&
      Object.freeze(
        Object.fromEntries(
          Object.entries(candidate).filter(([key]) => key !== "score"),
        ),
      ),
    alternatives: Object.freeze(alternatives),
    reasonCodes: Object.freeze(reasons.slice(0, 5)),
    constraints: Object.freeze({
      visualDensity,
      pageVisualCount: bindings.length,
      pageBudget:
        VISUAL_PUBLISHER_RUNTIME_V1.pageBudget.maxVisualComponentsPerPage,
    }),
    uncertainty,
    evidenceQuality: "CODE_POLICY",
    recommendationFingerprint: hash(context),
    contextBytes: Buffer.byteLength(JSON.stringify(context)),
    generatedAt,
  });
}
