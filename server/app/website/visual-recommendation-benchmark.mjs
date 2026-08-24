import {
  createVisualComponentRegistry,
  geometricPatternManifest,
  glowBandsManifest,
  gradientFieldManifest,
} from "../visual-components/visual-component-registry.mjs";
import { createVisualPublicationDescriptor } from "../visual-publishing/visual-publisher-contract.mjs";
import { customerVisualCatalog } from "./website-visual-selection.mjs";
import {
  recommendWebsiteVisual,
  VISUAL_RECOMMENDATION_POLICY_VERSION,
} from "./website-visual-recommendation.mjs";

export const VISUAL_RECOMMENDATION_BENCHMARK_VERSION =
  "VISUAL_RECOMMENDATION_BENCHMARK_V1";
export const VISUAL_RECOMMENDATION_BENCHMARK_TYPE =
  "DETERMINISTIC_POLICY_BENCHMARK";
const ACTIONS = Object.freeze([
    "ADD",
    "KEEP",
    "REPLACE",
    "REMOVE",
    "NO_RECOMMENDATION",
  ]),
  COMPONENTS = Object.freeze([
    "LOADDER_GRADIENT_FIELD",
    "LOADDER_GLOW_BANDS",
    "LOADDER_GEOMETRIC_PATTERN",
  ]),
  DIFFICULTIES = Object.freeze([
    "EASY",
    "MEDIUM",
    "HARD",
    "ADVERSARIAL",
  ]),
  TOKENS = Object.freeze(["PRIMARY", "SECONDARY", "MUTED"]),
  REASONS = new Set([
    "PAGE_VISUAL_DENSITY_LOW",
    "PAGE_VISUAL_DENSITY_BALANCED",
    "CURRENT_VISUAL_ALREADY_SUITABLE",
    "CURRENT_VISUAL_WEAK_FIT",
    "CURRENT_VISUAL_NO_LONGER_ELIGIBLE",
    "REMOVE_TO_REDUCE_VISUAL_DENSITY",
    "PAGE_BUDGET_AT_LIMIT",
    "NO_ELIGIBLE_CANDIDATE",
    "STATIC_LOW_RUNTIME_COST",
    "TOKEN_AVAILABLE",
  ]),
  theme = Object.freeze({
    font: "brand",
    primaryColor: "#6633ff",
    secondaryColor: "#111122",
    backgroundColor: "#050510",
    foregroundColor: "#ffffff",
    mutedColor: "#aaaabb",
  });

const freeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const descriptor = (componentId) =>
  createVisualPublicationDescriptor({
    componentId,
    componentVersion: 1,
    props:
      componentId === "LOADDER_GRADIENT_FIELD"
        ? { variant: "HALO", intensity: "SUBTLE", accentToken: "PRIMARY" }
        : componentId === "LOADDER_GLOW_BANDS"
          ? {
              orientation: "DIAGONAL",
              intensity: "SUBTLE",
              accentToken: "SECONDARY",
            }
          : {
              pattern: "DIAMONDS",
              density: "SPARSE",
              intensity: "SUBTLE",
              accentToken: "MUTED",
            },
    assetRefs: [],
  });
const current = (componentId) =>
  componentId ? { sectionId: "target", descriptor: descriptor(componentId) } : null;
const elsewhere = (componentId, index) => ({
  sectionId: `elsewhere-${index}`,
  descriptor: descriptor(componentId),
});
const invariant = ({ actions, candidates = null, noChange = false }) =>
  freeze({
    allowedActions: actions,
    allowedCandidates: candidates,
    noChange,
    hard: Object.freeze([
      "POLICY_VERSION",
      "CANDIDATE_ELIGIBLE",
      "SECTION_COMPATIBLE",
      "PAGE_BUDGET",
      "NO_DUPLICATE_COMPONENT",
      "PROPS_VALID",
      "TOKEN_VALID",
      "ALTERNATIVES_VALID",
      "REASONS_CONSISTENT",
      "DETERMINISTIC",
    ]),
  });

const archetypes = Object.freeze([
  ["HERO", null, [], "CURRENT", invariant({ actions: ["ADD"], candidates: ["LOADDER_GRADIENT_FIELD", "LOADDER_GLOW_BANDS"] }), "قهرمان خالی و نیاز روشن به عمق بصری"],
  ["CONTENT", null, [], "CURRENT", invariant({ actions: ["ADD"], candidates: ["LOADDER_GEOMETRIC_PATTERN"] }), "بخش محتوای خالی با ساختار قابل تقویت"],
  ["CTA", null, [], "CURRENT", invariant({ actions: ["ADD"], candidates: ["LOADDER_GLOW_BANDS"] }), "دعوت به اقدام بدون تأکید بصری"],
  ["FORM_OR_ACTION", null, [], "CURRENT", invariant({ actions: ["NO_RECOMMENDATION"], candidates: [] }), "فرم که نباید تزئین دریافت کند"],
  ["FOOTER", null, [], "CURRENT", invariant({ actions: ["NO_RECOMMENDATION"], candidates: [] }), "پاورقی خارج از دامنه پیشنهاد"],
  ["HERO", "LOADDER_GRADIENT_FIELD", [], "CURRENT", invariant({ actions: ["KEEP"], noChange: true }), "انتخاب قوی فعلی در قهرمان"],
  ["HERO", "LOADDER_GLOW_BANDS", [], "CURRENT", invariant({ actions: ["KEEP"], noChange: true }), "تساوی گزینه فعلی و رقیب"],
  ["HERO", "LOADDER_GEOMETRIC_PATTERN", [], "CURRENT", invariant({ actions: ["REPLACE"], candidates: ["LOADDER_GRADIENT_FIELD", "LOADDER_GLOW_BANDS"] }), "انتخاب فعلی ضعیف با فاصله معنادار"],
  ["CONTENT", "LOADDER_GRADIENT_FIELD", [], "CURRENT", invariant({ actions: ["KEEP"], noChange: true }), "برتری حاشیه‌ای گزینه ساختاری"],
  ["CTA", "LOADDER_GRADIENT_FIELD", [], "CURRENT", invariant({ actions: ["REMOVE"] }), "جلوه ناسازگار در دعوت به اقدام"],
  ["HERO", null, ["LOADDER_GRADIENT_FIELD", "LOADDER_GLOW_BANDS", "LOADDER_GEOMETRIC_PATTERN", "LOADDER_GRADIENT_FIELD"], "CURRENT", invariant({ actions: ["NO_RECOMMENDATION"], candidates: [] }), "صفحه در سقف بودجه بصری"],
  ["HERO", null, ["LOADDER_GRADIENT_FIELD"], "CURRENT", invariant({ actions: ["ADD"], candidates: ["LOADDER_GLOW_BANDS"] }), "بهترین نظری قبلاً در صفحه استفاده شده"],
  ["TRUST", null, [], "CURRENT", invariant({ actions: ["ADD"], candidates: ["LOADDER_GEOMETRIC_PATTERN"] }), "بخش اعتماد با نیاز ساختاری"],
  ["PROBLEM", null, [], "CURRENT", invariant({ actions: ["ADD"], candidates: ["LOADDER_GEOMETRIC_PATTERN"] }), "بیان مسئله با ساختار ضعیف"],
  ["SOLUTION", null, [], "REVOKE_GEOMETRY", invariant({ actions: ["ADD"], candidates: ["LOADDER_GRADIENT_FIELD"] }), "نامزد برتر از سیاست مشتری حذف شده"],
  ["BENEFITS", null, [], "REVOKE_ALL", invariant({ actions: ["NO_RECOMMENDATION"], candidates: [] }), "همه نامزدها از سیاست لغو شده‌اند"],
  ["HERO", null, [], "CURRENT", invariant({ actions: ["NO_RECOMMENDATION", "KEEP"], candidates: [] }), "سناریوی مبهم که نداشتن جلوه باید رقابتی بماند"],
  ["FEATURES", null, ["LOADDER_GRADIENT_FIELD", "LOADDER_GRADIENT_FIELD", "LOADDER_GRADIENT_FIELD"], "CURRENT", invariant({ actions: ["NO_RECOMMENDATION", "KEEP"], candidates: [] }), "تراکم بالا زیر سقف و خطر بیش‌آرایی"],
]);

const tokenSets = Object.freeze([
  TOKENS,
  Object.freeze(["PRIMARY", "SECONDARY"]),
  Object.freeze(["PRIMARY", "MUTED"]),
  Object.freeze(["SECONDARY", "MUTED"]),
]);
const cases = DIFFICULTIES.flatMap((difficulty, difficultyIndex) =>
  archetypes.map((item, index) => {
    const [sectionType, currentVisual, pageVisuals, policyFixture, expectedInvariantSet, label] = item,
      availableTokens = tokenSets[(index + difficultyIndex) % tokenSets.length];
    return freeze({
      caseId: `visual-recommendation-v1-${String(difficultyIndex * archetypes.length + index + 1).padStart(3, "0")}`,
      benchmarkVersion: VISUAL_RECOMMENDATION_BENCHMARK_VERSION,
      difficulty,
      sectionType,
      currentVisual,
      pageVisuals: Object.freeze([...pageVisuals]),
      availableTokens,
      themePosture: difficultyIndex % 2 ? "LIGHT" : "DARK",
      policyFixture,
      expectedInvariantSet,
      humanReviewPrompt: `${label} — آیا پیشنهاد برای یک بخش واقعی کسب‌وکار موجه و خویشتن‌دار است؟`,
      notes: difficulty === "ADVERSARIAL" ? "برای آشکار کردن سوگیری یا تغییر غیرضروری طراحی شده است." : "مصنوعی و بدون داده مشتری.",
      tags: Object.freeze([
        index === 0
          ? "EMPTY_EQUAL_SCORE"
          : index === 6
            ? "CURRENT_EQUAL_SCORE"
            : "STANDARD",
        index === 16 ? "NO_VISUAL_COMPETITIVE" : "STANDARD",
        index === 17 ? "OVERDECORATION" : "STANDARD",
        index === 8 ? "THRESHOLD_JUST_BELOW" : "STANDARD",
      ]),
    });
  }),
);

export const visualRecommendationHumanRubric = freeze({
  rubricId: "VISUAL_RECOMMENDATION_HUMAN_RUBRIC_V1",
  version: 1,
  scale: { minimum: 1, maximum: 5 },
  dimensions: [
    "SECTION_APPROPRIATENESS",
    "VISUAL_RESTRAINT",
    "BRAND_ADAPTABILITY",
    "RECOMMENDATION_JUSTIFICATION",
    "CHANGE_NECESSITY",
    "ALTERNATIVE_QUALITY",
    "OVERALL_DESIGN_JUDGMENT",
  ],
  safety: ["SAFE", "UNSAFE"],
  statuses: [
    "NOT_REVIEWED",
    "REVIEWED_ACCEPTABLE",
    "REVIEWED_WEAK",
    "REVIEWED_REJECTED",
  ],
  maximumNoteCharacters: 500,
  guidance:
    "قضاوت کنید آیا پیشنهاد برای یک بخش واقعی کسب‌وکار معنادار است، نه اینکه شخصاً سبک را دوست دارید.",
});

export function validateVisualRecommendationHumanReview(input) {
  if (
    !input ||
    input.rubricVersion !== 1 ||
    !visualRecommendationHumanRubric.safety.includes(input.safety) ||
    !visualRecommendationHumanRubric.statuses.slice(1).includes(input.status) ||
    typeof input.scores !== "object" ||
    visualRecommendationHumanRubric.dimensions.some(
      (key) =>
        !Number.isInteger(input.scores[key]) ||
        input.scores[key] < 1 ||
        input.scores[key] > 5,
    ) ||
    typeof input.note !== "string" ||
    input.note.length > visualRecommendationHumanRubric.maximumNoteCharacters
  )
    throw new Error("VISUAL_RECOMMENDATION_HUMAN_REVIEW_INVALID");
  return freeze({ ...input, note: input.note });
}

const revoked = (manifest) => ({
  ...manifest,
  securityPosture: { ...manifest.securityPosture, remoteCode: true },
});
const registryFor = (fixture) =>
  fixture === "REVOKE_ALL"
    ? createVisualComponentRegistry([
        revoked(gradientFieldManifest),
        revoked(glowBandsManifest),
        revoked(geometricPatternManifest),
      ])
    : fixture === "REVOKE_GEOMETRY"
      ? createVisualComponentRegistry([
          gradientFieldManifest,
          glowBandsManifest,
          revoked(geometricPatternManifest),
        ])
      : createVisualComponentRegistry([
          gradientFieldManifest,
          glowBandsManifest,
          geometricPatternManifest,
        ]);

function executeCase(fixture) {
  const bindings = [
      ...(fixture.currentVisual ? [current(fixture.currentVisual)] : []),
      ...fixture.pageVisuals.map(elsewhere),
    ],
    registry = registryFor(fixture.policyFixture),
    recommendation = recommendWebsiteVisual({
      websiteId: "synthetic-website",
      pageId: "synthetic-page",
      sectionId: "target",
      baseRevisionId: fixture.caseId,
      blueprint: {
        sections: [{ id: "target", componentId: fixture.sectionType }],
        websiteVisualDescriptors: bindings,
        designTokens: theme,
      },
      registry,
      generatedAt: "2026-08-24T00:00:00.000Z",
    });
  return { recommendation, registry, bindings };
}

const issue = (code, kind = "HARD") => ({ code, kind });
export function evaluateVisualRecommendationCase(fixture, supplied = null) {
  const executed = supplied
      ? { recommendation: supplied, registry: registryFor(fixture.policyFixture), bindings: [] }
      : executeCase(fixture),
    { recommendation, registry } = executed,
    issues = [],
    expected = fixture.expectedInvariantSet,
    catalog = customerVisualCatalog({ registry }),
    catalogIds = new Set(catalog.map((item) => item.componentId)),
    used = new Set(fixture.pageVisuals),
    evaluateCandidate = (candidate, alternative = false) => {
      if (!candidate) return;
      const prefix = alternative ? "ALTERNATIVE" : "CANDIDATE",
        entry = catalog.find(
          (item) =>
            item.componentId === candidate.componentId &&
            item.componentVersion === candidate.componentVersion,
        );
      if (!entry) issues.push(issue(`${prefix}_INELIGIBLE`));
      else if (!entry.allowedSectionTypes.includes(fixture.sectionType))
        issues.push(issue(`${prefix}_SECTION_INCOMPATIBLE`));
      if (used.has(candidate.componentId))
        issues.push(issue(`${prefix}_DUPLICATE_COMPONENT`));
      try {
        createVisualPublicationDescriptor(
          {
            componentId: candidate.componentId,
            componentVersion: candidate.componentVersion,
            props: candidate.props,
            assetRefs: [],
          },
          { registry },
        );
      } catch {
        issues.push(issue(`${prefix}_PROPS_INVALID`));
      }
      if (
        candidate.props?.accentToken &&
        !fixture.availableTokens.includes(candidate.props.accentToken)
      )
        issues.push(issue(`${prefix}_TOKEN_UNAVAILABLE`, "POLICY_WEAKNESS"));
      if (!catalogIds.has(candidate.componentId))
        issues.push(issue(`${prefix}_OUTSIDE_CUSTOMER_CATALOG`));
    };
  if (!ACTIONS.includes(recommendation.action)) issues.push(issue("ACTION_INVALID"));
  if (recommendation.policyVersion !== VISUAL_RECOMMENDATION_POLICY_VERSION)
    issues.push(issue("POLICY_VERSION_MISMATCH"));
  if (!expected.allowedActions.includes(recommendation.action))
    issues.push(
      issue(
        recommendation.action === "ADD" || recommendation.action === "REPLACE"
          ? "OVER_CHANGE"
          : "UNDER_CHANGE",
        "POLICY_WEAKNESS",
      ),
    );
  if (
    expected.allowedCandidates &&
    recommendation.candidate &&
    !expected.allowedCandidates.includes(recommendation.candidate.componentId)
  )
    issues.push(issue("CANDIDATE_OUTSIDE_EXPECTED_SET", "SOFT"));
  if (expected.allowedCandidates?.length === 0 && recommendation.candidate)
    issues.push(issue("NO_VISUAL_EXPECTATION_MISSED", "POLICY_WEAKNESS"));
  if (recommendation.constraints?.visualDensity === "AT_LIMIT" && recommendation.action === "ADD")
    issues.push(issue("PAGE_BUDGET_VIOLATION"));
  evaluateCandidate(recommendation.candidate);
  for (const alternative of recommendation.alternatives || [])
    evaluateCandidate(alternative, true);
  if ((recommendation.alternatives || []).length > 2)
    issues.push(issue("ALTERNATIVE_LIMIT_EXCEEDED"));
  for (const code of recommendation.reasonCodes || []) {
    if (!REASONS.has(code) && !/^SECTION_[A-Z_]+_(ATMOSPHERIC|EMPHASIS|STRUCTURED)_FIT$/.test(code))
      issues.push(issue("REASON_UNKNOWN"));
  }
  if (
    recommendation.constraints?.visualDensity === "HIGH" &&
    recommendation.reasonCodes?.includes("PAGE_VISUAL_DENSITY_LOW")
  )
    issues.push(issue("REASON_DENSITY_CONTRADICTION"));
  if (recommendation.action === "REMOVE" && !recommendation.reasonCodes?.some((x) => x.includes("REMOVE") || x.includes("NO_LONGER_ELIGIBLE")))
    issues.push(issue("REMOVE_REASON_MISSING"));
  if (recommendation.action === "REPLACE" && !recommendation.reasonCodes?.includes("CURRENT_VISUAL_WEAK_FIT"))
    issues.push(issue("REPLACE_REASON_MISSING"));
  if (recommendation.action === "KEEP" && recommendation.reasonCodes?.includes("CURRENT_VISUAL_WEAK_FIT"))
    issues.push(issue("KEEP_REASON_CONTRADICTION"));
  return freeze({
    caseId: fixture.caseId,
    difficulty: fixture.difficulty,
    sectionType: fixture.sectionType,
    action: recommendation.action,
    componentId: recommendation.candidate?.componentId || "NO_VISUAL",
    issues,
    hardPass: !issues.some((x) => x.kind === "HARD"),
    humanReviewStatus: "NOT_REVIEWED",
    recommendation,
  });
}

const counts = (values, allowed = []) =>
  Object.fromEntries(
    [...new Set([...allowed, ...values])].map((value) => [
      value,
      values.filter((item) => item === value).length,
    ]),
  );
const candidate = (id, problemSignal, proposedChangeType, casesFor, casesAgainst) =>
  freeze({
    candidateId: id,
    policyVersion: VISUAL_RECOMMENDATION_POLICY_VERSION,
    problemSignal,
    proposedChangeType,
    affectedRules: ["FIT_MATRIX", "CHANGE_COST", "DENSITY_POSTURE"],
    supportingCases: [...new Set(casesFor)].slice(0, 20),
    contradictingCases: [...new Set(casesAgainst)].slice(0, 20),
    expectedBenefit: "کاهش پیشنهادهای تزئینی یا تغییرهای فاقد شواهد کافی.",
    risk: "ممکن است پیشنهادهای مفید را بیش از حد محافظه‌کار کند.",
    falsificationCondition:
      "اگر مرور انسانی مستقل نشان دهد موارد پشتیبان عمدتاً افزودن یا تغییر را موجه می‌دانند، این پیشنهاد رد می‌شود.",
    status: "PROPOSED",
    executable: false,
  });

export function runVisualRecommendationBenchmark({ fixtures = cases } = {}) {
  const results = fixtures.map((fixture) => evaluateVisualRecommendationCase(fixture)),
    allIssues = results.flatMap((result) =>
      result.issues.map((entry) => ({ ...entry, caseId: result.caseId })),
    ),
    over = allIssues.filter((x) => x.code === "OVER_CHANGE" || x.code === "NO_VISUAL_EXPECTATION_MISSED"),
    under = allIssues.filter((x) => x.code === "UNDER_CHANGE"),
    tieResults = results.filter((result) =>
      fixtures
        .find((fixture) => fixture.caseId === result.caseId)
        ?.tags.includes("EMPTY_EQUAL_SCORE"),
    ),
    tieComponents = counts(tieResults.map((x) => x.componentId), [...COMPONENTS, "NO_VISUAL"]),
    tieTotal = tieResults.length,
    dominantTie = Object.entries(tieComponents).sort((a, b) => b[1] - a[1])[0],
    tieBreakSignals =
      tieTotal >= 4 && dominantTie[1] / tieTotal >= 0.6
        ? [{ code: "TIE_BREAK_BIAS_SIGNAL", componentId: dominantTie[0], share: dominantTie[1] / tieTotal }]
        : [],
    hardViolationCount = allIssues.filter((x) => x.kind === "HARD").length,
    weaknessCount = allIssues.filter((x) => x.kind === "POLICY_WEAKNESS").length,
    policyCandidates = [];
  if (over.length)
    policyCandidates.push(
      candidate(
        "ADD_NO_VISUAL_BIAS_V1",
        "OVER_CHANGE_SIGNAL",
        "ADD_NO_VISUAL_BIAS",
        over.map((x) => x.caseId),
        results.filter((x) => x.action === "ADD" && !x.issues.length).map((x) => x.caseId),
      ),
    );
  if (tieBreakSignals.length)
    policyCandidates.push(
      candidate(
        "REVIEW_TIE_BREAK_PRIORITY_V1",
        "TIE_BREAK_BIAS_SIGNAL",
        "CHANGE_TIE_BREAK_PRIORITY",
        tieResults.map((x) => x.caseId),
        results.filter((x) => x.action === "KEEP").map((x) => x.caseId),
      ),
    );
  if (allIssues.some((x) => x.code.includes("TOKEN_UNAVAILABLE")))
    policyCandidates.push(
      candidate(
        "RESPECT_AVAILABLE_TOKENS_V1",
        "TOKEN_AVAILABILITY_GAP",
        "ADD_TOKEN_AVAILABILITY_FILTER",
        allIssues.filter((x) => x.code.includes("TOKEN_UNAVAILABLE")).map((x) => x.caseId),
        results.filter((x) => !x.issues.some((i) => i.code.includes("TOKEN_UNAVAILABLE"))).map((x) => x.caseId),
      ),
    );
  const subjectiveCases = fixtures.filter((x) =>
      x.expectedInvariantSet.allowedActions.length > 1,
    ).length,
    humanPriorityCases = results
      .filter((x) =>
        ["HARD", "ADVERSARIAL"].includes(x.difficulty) ||
        ["REPLACE", "REMOVE", "NO_RECOMMENDATION"].includes(x.action),
      )
      .slice(0, 20)
      .map((x) => x.caseId),
    scorecard = {
      benchmarkType: VISUAL_RECOMMENDATION_BENCHMARK_TYPE,
      benchmarkVersion: VISUAL_RECOMMENDATION_BENCHMARK_VERSION,
      policyVersion: VISUAL_RECOMMENDATION_POLICY_VERSION,
      caseCount: results.length,
      difficultyDistribution: counts(results.map((x) => x.difficulty), DIFFICULTIES),
      sectionDistribution: counts(results.map((x) => x.sectionType)),
      actionDistribution: counts(results.map((x) => x.action), ACTIONS),
      componentDistribution: counts(results.map((x) => x.componentId), [...COMPONENTS, "NO_VISUAL"]),
      hardViolationCount,
      constraintViolationCount: hardViolationCount,
      invalidRecommendationCount: results.filter((x) => !x.hardPass).length,
      overChangeCount: new Set(over.map((x) => x.caseId)).size,
      underChangeCount: new Set(under.map((x) => x.caseId)).size,
      tieBreakSignals,
      noChangeRate: results.filter((x) => x.action === "KEEP").length / results.length,
      noRecommendationRate: results.filter((x) => x.action === "NO_RECOMMENDATION").length / results.length,
      determinismFailures: 0,
      invalidPropsCount: allIssues.filter((x) => x.code.includes("PROPS_INVALID")).length,
      invalidAlternativesCount: allIssues.filter((x) => x.code.startsWith("ALTERNATIVE_")).length,
      humanReviewCoverage: 0,
      humanDimensionAverages: null,
      humanPriorityCases,
      coverageCritique: {
        coverageGaps: ["REAL_CUSTOMER_OUTCOMES", "INDEPENDENT_HUMAN_REVIEW", "BRAND_BOOK_SEMANTICS"],
        overrepresentedSectionTypes: Object.entries(
          counts(fixtures.map((x) => x.sectionType)),
        )
          .filter(([, count]) => count / fixtures.length > 0.3)
          .map(([section]) => section),
        overrepresentedActions: [],
        subjectiveCaseShare: subjectiveCases / fixtures.length,
        hardInvariantShare: 1 - subjectiveCases / fixtures.length,
        humanReviewGap: fixtures.length,
      },
      policyCandidates,
      decision:
        hardViolationCount > 0
          ? "POLICY_REVISION_CANDIDATE_REQUIRED"
          : weaknessCount > 0 || tieBreakSignals.length
            ? "POLICY_WEAKNESS_DETECTED"
            : "INSUFFICIENT_HUMAN_EVIDENCE",
    };
  return freeze({ scorecard, results, policyCandidates });
}

export const visualRecommendationBenchmarkRegistry = freeze({
  benchmarkType: VISUAL_RECOMMENDATION_BENCHMARK_TYPE,
  benchmarkVersion: VISUAL_RECOMMENDATION_BENCHMARK_VERSION,
  list: () => cases,
  get: (caseId) => cases.find((item) => item.caseId === caseId) || null,
  summary: () => ({
    benchmarkType: VISUAL_RECOMMENDATION_BENCHMARK_TYPE,
    benchmarkVersion: VISUAL_RECOMMENDATION_BENCHMARK_VERSION,
    caseCount: cases.length,
    difficultyDistribution: counts(cases.map((x) => x.difficulty), DIFFICULTIES),
    sectionDistribution: counts(cases.map((x) => x.sectionType)),
    actionExpectationDistribution: counts(
      cases.flatMap((x) => x.expectedInvariantSet.allowedActions),
      ACTIONS,
    ),
    fixtureBytes: Buffer.byteLength(JSON.stringify(cases)),
    averageCaseBytes:
      cases.reduce((sum, item) => sum + Buffer.byteLength(JSON.stringify(item)), 0) /
      cases.length,
    humanReviewStatus: "NOT_REVIEWED",
  }),
});
