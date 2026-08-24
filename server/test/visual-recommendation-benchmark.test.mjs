import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { classifyApiRequest } from "../app/middleware/product-gating.mjs";
import {
  evaluateVisualRecommendationCase,
  runVisualRecommendationBenchmark,
  validateVisualRecommendationHumanReview,
  visualRecommendationBenchmarkRegistry,
  visualRecommendationHumanRubric,
  VISUAL_RECOMMENDATION_BENCHMARK_TYPE,
  VISUAL_RECOMMENDATION_BENCHMARK_VERSION,
} from "../app/website/visual-recommendation-benchmark.mjs";
import {
  VISUAL_RECOMMENDATION_POLICY_V1,
  VISUAL_RECOMMENDATION_POLICY_VERSION,
} from "../app/website/website-visual-recommendation.mjs";

const cases = visualRecommendationBenchmarkRegistry.list();
const review = () => ({
  rubricVersion: 1,
  scores: Object.fromEntries(
    visualRecommendationHumanRubric.dimensions.map((key) => [key, 3]),
  ),
  safety: "SAFE",
  status: "REVIEWED_ACCEPTABLE",
  note: "بررسی مصنوعی",
});

test("Visual Recommendation Benchmark and Dogfood v1", async (t) => {
  await t.test("is a versioned deterministic-policy benchmark, not a model benchmark", () => {
    assert.equal(VISUAL_RECOMMENDATION_BENCHMARK_VERSION, "VISUAL_RECOMMENDATION_BENCHMARK_V1");
    assert.equal(VISUAL_RECOMMENDATION_BENCHMARK_TYPE, "DETERMINISTIC_POLICY_BENCHMARK");
    assert.equal(VISUAL_RECOMMENDATION_POLICY_VERSION, "VISUAL_RECOMMENDATION_POLICY_V1");
  });
  await t.test("registry contains exactly 72 unique compact synthetic cases", () => {
    assert.equal(cases.length, 72);
    assert.equal(new Set(cases.map((x) => x.caseId)).size, 72);
    assert.ok(cases.every((x) => x.benchmarkVersion === VISUAL_RECOMMENDATION_BENCHMARK_VERSION));
    assert.ok(visualRecommendationBenchmarkRegistry.summary().averageCaseBytes < 1400);
  });
  await t.test("difficulty coverage is balanced and non-trivial", () => {
    assert.deepEqual(visualRecommendationBenchmarkRegistry.summary().difficultyDistribution, {
      EASY: 18,
      MEDIUM: 18,
      HARD: 18,
      ADVERSARIAL: 18,
    });
  });
  await t.test("all supported and explicitly unsupported sections are represented", () => {
    const sections = new Set(cases.map((x) => x.sectionType));
    for (const section of ["HERO", "CONTENT", "PROBLEM", "SOLUTION", "BENEFITS", "FEATURES", "TRUST", "CTA", "FORM_OR_ACTION", "FOOTER"])
      assert.ok(sections.has(section), section);
  });
  await t.test("all actions appear in expectations and actual dogfood output", () => {
    const expected = new Set(cases.flatMap((x) => x.expectedInvariantSet.allowedActions)),
      actual = new Set(runVisualRecommendationBenchmark().results.map((x) => x.action));
    for (const action of ["ADD", "KEEP", "REPLACE", "REMOVE", "NO_RECOMMENDATION"]) {
      assert.ok(expected.has(action), `expected ${action}`);
      assert.ok(actual.has(action), `actual ${action}`);
    }
  });
  await t.test("all production components appear as current, page, candidate, and alternatives", () => {
    const source = JSON.stringify(cases),
      output = JSON.stringify(runVisualRecommendationBenchmark().results);
    for (const id of ["LOADDER_GRADIENT_FIELD", "LOADDER_GLOW_BANDS", "LOADDER_GEOMETRIC_PATTERN"]) {
      assert.match(source, new RegExp(id));
      assert.match(output, new RegExp(id));
    }
  });
  await t.test("dataset is Persian-first, synthetic, PII-free, and contains no website prose", () => {
    const machineInputs = JSON.stringify(
      cases.map(({ humanReviewPrompt: _prompt, ...fixture }) => fixture),
    );
    assert.ok(cases.every((x) => /[\u0600-\u06ff]/.test(x.humanReviewPrompt)));
    assert.doesNotMatch(machineInputs, /email|mobile|phone|customerId|crm|message/i);
  });
  await t.test("adversarial fixtures target policy weaknesses rather than only happy paths", () => {
    const adversarial = cases.filter((x) => x.difficulty === "ADVERSARIAL"),
      text = JSON.stringify(adversarial);
    for (const marker of ["EMPTY_EQUAL_SCORE", "NO_VISUAL_COMPETITIVE", "OVERDECORATION", "REVOKE_ALL"])
      assert.match(text, new RegExp(marker));
    assert.ok(adversarial.some((x) => x.pageVisuals.length >= 4));
  });
  await t.test("density, token, current-state, duplicate, and revoke dimensions vary", () => {
    assert.ok(new Set(cases.map((x) => x.pageVisuals.length)).size >= 4);
    assert.ok(new Set(cases.map((x) => x.availableTokens.join("|"))).size >= 4);
    assert.ok(cases.some((x) => x.currentVisual));
    assert.ok(cases.some((x) => x.policyFixture !== "CURRENT"));
  });
  await t.test("machine results remain separate from absent human evidence", () => {
    const run = runVisualRecommendationBenchmark();
    assert.ok(run.results.every((x) => x.humanReviewStatus === "NOT_REVIEWED"));
    assert.equal(run.scorecard.humanReviewCoverage, 0);
    assert.equal(run.scorecard.humanDimensionAverages, null);
    assert.equal(run.scorecard.humanPriorityCases.length, 20);
  });
  await t.test("human rubric validates bounded reviews and rejects invalid scores and notes", () => {
    assert.equal(validateVisualRecommendationHumanReview(review()).status, "REVIEWED_ACCEPTABLE");
    assert.throws(() => validateVisualRecommendationHumanReview({ ...review(), scores: { ...review().scores, SECTION_APPROPRIATENESS: 6 } }));
    assert.throws(() => validateVisualRecommendationHumanReview({ ...review(), note: "ف".repeat(501) }));
    assert.throws(() => validateVisualRecommendationHumanReview({ ...review(), safety: "UNKNOWN" }));
  });
  await t.test("hard evaluator catches an unknown unsafe candidate", () => {
    const result = evaluateVisualRecommendationCase(cases[0], {
      policyVersion: VISUAL_RECOMMENDATION_POLICY_VERSION,
      action: "ADD",
      candidate: { componentId: "UNKNOWN_COMPONENT", componentVersion: 1, props: {} },
      alternatives: [],
      reasonCodes: ["PAGE_VISUAL_DENSITY_LOW"],
      constraints: { visualDensity: "LOW" },
    });
    assert.ok(result.issues.some((x) => x.code === "CANDIDATE_INELIGIBLE"));
    assert.equal(result.hardPass, false);
  });
  await t.test("hard evaluator catches invalid props", () => {
    const result = evaluateVisualRecommendationCase(cases[0], {
      policyVersion: VISUAL_RECOMMENDATION_POLICY_VERSION,
      action: "ADD",
      candidate: { componentId: "LOADDER_GRADIENT_FIELD", componentVersion: 1, props: { variant: "BROKEN" } },
      alternatives: [],
      reasonCodes: ["PAGE_VISUAL_DENSITY_LOW"],
      constraints: { visualDensity: "LOW" },
    });
    assert.ok(result.issues.some((x) => x.code === "CANDIDATE_PROPS_INVALID"));
  });
  await t.test("hard evaluator catches an invalid alternative", () => {
    const good = runVisualRecommendationBenchmark().results[0].recommendation,
      result = evaluateVisualRecommendationCase(cases[0], {
        ...good,
        alternatives: [{ componentId: "LOADDER_DOT_MATRIX", componentVersion: 1, props: {} }],
      });
    assert.ok(result.issues.some((x) => x.code.startsWith("ALTERNATIVE_")));
  });
  await t.test("reason consistency evaluator catches contradictions", () => {
    const good = runVisualRecommendationBenchmark().results.find((x) => x.action === "KEEP").recommendation,
      fixture = cases.find((x) => x.currentVisual === "LOADDER_GRADIENT_FIELD" && x.sectionType === "HERO"),
      result = evaluateVisualRecommendationCase(fixture, { ...good, reasonCodes: ["CURRENT_VISUAL_WEAK_FIT"] });
    assert.ok(result.issues.some((x) => x.code === "KEEP_REASON_CONTRADICTION"));
  });
  await t.test("actual recommendations and alternatives never escape the customer-safe catalog", () => {
    const run = runVisualRecommendationBenchmark();
    assert.equal(run.results.flatMap((x) => x.issues).filter((x) => /INELIGIBLE|OUTSIDE_CUSTOMER|SECTION_INCOMPATIBLE|PROPS_INVALID/.test(x.code)).length, 0);
    assert.doesNotMatch(JSON.stringify(run.results), /LOADDER_DOT_MATRIX|INTERACTIVE|GPU_HEAVY|PILOT_ONLY/);
  });
  await t.test("page budget and unsupported section invariants hold", () => {
    const run = runVisualRecommendationBenchmark();
    assert.equal(run.results.flatMap((x) => x.issues).filter((x) => x.code === "PAGE_BUDGET_VIOLATION").length, 0);
    for (const result of run.results.filter((x) => ["FORM_OR_ACTION", "FOOTER"].includes(x.sectionType)))
      assert.equal(result.action, "NO_RECOMMENDATION");
  });
  await t.test("dogfood detects over-change, no-visual, token, and tie-break evidence honestly", () => {
    const card = runVisualRecommendationBenchmark().scorecard;
    assert.ok(card.overChangeCount > 0);
    assert.ok(card.tieBreakSignals.length > 0);
    assert.ok(card.policyCandidates.some((x) => x.proposedChangeType === "ADD_NO_VISUAL_BIAS"));
    assert.ok(card.policyCandidates.some((x) => x.proposedChangeType === "ADD_TOKEN_AVAILABILITY_FILTER"));
    assert.notEqual(card.decision, "POLICY_OK_FOR_CURRENT_SCOPE");
  });
  await t.test("anti-churn and threshold boundary keep marginal or tied current visuals", () => {
    const results = runVisualRecommendationBenchmark().results;
    for (const fixture of cases.filter((x) => x.tags.includes("THRESHOLD_JUST_BELOW") || x.tags.includes("CURRENT_EQUAL_SCORE")))
      assert.equal(results.find((x) => x.caseId === fixture.caseId).action, "KEEP");
  });
  await t.test("same benchmark and policy versions yield an exact stable machine scorecard", () => {
    const first = runVisualRecommendationBenchmark().scorecard;
    for (let i = 0; i < 10; i++) assert.deepEqual(runVisualRecommendationBenchmark().scorecard, first);
  });
  await t.test("policy candidates are bounded, non-executable, proposed, and falsifiable", () => {
    const candidates = runVisualRecommendationBenchmark().policyCandidates;
    assert.ok(candidates.length > 0);
    for (const item of candidates) {
      assert.equal(item.status, "PROPOSED");
      assert.equal(item.executable, false);
      assert.ok(item.falsificationCondition.length > 20 && item.falsificationCondition.length < 500);
      assert.ok(item.supportingCases.length > 0);
    }
  });
  await t.test("benchmark criticizes its own evidence and exposes no vanity score", () => {
    const card = runVisualRecommendationBenchmark().scorecard;
    assert.ok(card.coverageCritique.coverageGaps.includes("INDEPENDENT_HUMAN_REVIEW"));
    assert.ok(card.coverageCritique.subjectiveCaseShare > 0);
    assert.equal("score" in card, false);
  });
  await t.test("run is pure, has no AI/provider dependency, and does not mutate policy", () => {
    const before = JSON.stringify(VISUAL_RECOMMENDATION_POLICY_V1),
      source = readFileSync(new URL("../app/website/visual-recommendation-benchmark.mjs", import.meta.url), "utf8");
    runVisualRecommendationBenchmark();
    assert.equal(JSON.stringify(VISUAL_RECOMMENDATION_POLICY_V1), before);
    assert.doesNotMatch(source, /OpenAI|Anthropic|embedding|vector database|provider\.generate|INSERT INTO|UPDATE |DELETE FROM/i);
  });
  await t.test("internal benchmark routes are denied by the customer product gate", () => {
    for (const [method, path] of [
      ["GET", "/api/internal/visual-recommendation-benchmark/summary"],
      ["GET", "/api/internal/visual-recommendation-benchmark/cases"],
      ["POST", "/api/internal/visual-recommendation-benchmark/run"],
    ])
      assert.deepEqual(classifyApiRequest(method, path), { feature: "development_tools", internal: true });
  });
  await t.test("fixture registry and scorecard remain compact and persistence-free", () => {
    const summary = visualRecommendationBenchmarkRegistry.summary(),
      run = runVisualRecommendationBenchmark();
    assert.ok(summary.fixtureBytes < 120_000);
    assert.ok(Buffer.byteLength(JSON.stringify(run.scorecard)) < 20_000);
    assert.equal(run.scorecard.caseCount, 72);
  });
  await t.test("100 complete benchmark runs remain practical", () => {
    const started = performance.now();
    for (let i = 0; i < 100; i++) runVisualRecommendationBenchmark();
    const elapsed = performance.now() - started;
    assert.ok(elapsed < 30_000, `elapsed=${elapsed}`);
  });
});
