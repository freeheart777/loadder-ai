import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  deriveOnboardingStatus,
  ONBOARDING_STEPS,
} from "../app/onboarding/onboarding-status.mjs";
import { createOnboardingService, OnboardingError } from "../app/services/onboarding-service.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";

const profile = { id: "profile-1", name: "کسب‌وکار نمونه", industry: "فناوری", description: "یک کسب‌وکار نمونه برای ارائه خدمات با کیفیت به مشتریان.", updatedAt: "2026-08-21T00:00:00Z" };
const dna = { id: "dna-1", status: "draft", versionNumber: 1, offerings: ["خدمت نمونه"], valueProposition: "ارائه یک تجربه ساده و قابل اعتماد برای مشتریان کسب‌وکار.", differentiators: ["پشتیبانی مستقیم"], targetAudiences: ["صاحبان کسب‌وکارهای کوچک"], goals: ["جذب مشتری جدید"] };
const brand = { id: "brand-1", status: "draft", versionNumber: 1, brandIdentity: { audienceProblem: "پیچیدگی و اتلاف زمان در انجام کارهای روزمره" }, brandPersonality: ["حرفه‌ای", "صمیمی"], toneOfVoice: "ساده و روشن", keyPhrases: [], prohibitedPatterns: [] };
const emptyContext = { activeContext: null, latestDraft: null, isStale: false, staleReasons: [], currentSources: { businessProfile: null, businessDna: null, brandBook: null } };
const state = (overrides = {}) => ({ profile: null, dnaState: { activeVersion: null, latestDraft: null }, brandState: { activeVersion: null, latestDraft: null }, contextState: emptyContext, ...overrides });

test("MVP onboarding status and finalization", async (t) => {
  await t.test("new workspace starts at BUSINESS", () => {
    assert.equal(deriveOnboardingStatus(state()).currentStep, ONBOARDING_STEPS.BUSINESS);
  });
  await t.test("profile-complete workspace advances to OFFERING", () => {
    assert.equal(deriveOnboardingStatus(state({ profile })).currentStep, ONBOARDING_STEPS.OFFERING);
  });
  await t.test("offering-complete draft advances to AUDIENCE", () => {
    const partial = { ...dna, targetAudiences: [] };
    assert.equal(deriveOnboardingStatus(state({ profile, dnaState: { activeVersion: null, latestDraft: partial } })).currentStep, ONBOARDING_STEPS.AUDIENCE);
  });
  await t.test("audience-complete sources advance to BRAND", () => {
    const partialBrand = { ...brand, brandPersonality: [], toneOfVoice: null };
    assert.equal(deriveOnboardingStatus(state({ profile, dnaState: { activeVersion: null, latestDraft: dna }, brandState: { activeVersion: null, latestDraft: partialBrand } })).currentStep, ONBOARDING_STEPS.BRAND);
  });
  await t.test("complete drafts with no Context advance to REVIEW", () => {
    assert.equal(deriveOnboardingStatus(state({ profile, dnaState: { activeVersion: null, latestDraft: dna }, brandState: { activeVersion: null, latestDraft: brand } })).currentStep, ONBOARDING_STEPS.REVIEW);
  });
  await t.test("only active sources plus a fresh supported Context are complete", () => {
    const contextState = { ...emptyContext, activeContext: { id: "context-1", contextSchemaVersion: "1.0" } };
    const result = deriveOnboardingStatus(state({ profile, dnaState: { activeVersion: dna, latestDraft: null }, brandState: { activeVersion: brand, latestDraft: null }, contextState }));
    assert.equal(result.complete, true); assert.equal(result.currentStep, "COMPLETE");
  });
  await t.test("stale and unsupported Contexts are not complete", () => {
    const base = { profile, dnaState: { activeVersion: dna, latestDraft: null }, brandState: { activeVersion: brand, latestDraft: null } };
    assert.equal(deriveOnboardingStatus(state({ ...base, contextState: { ...emptyContext, activeContext: { id: "c", contextSchemaVersion: "1.0" }, isStale: true } })).contextStale, true);
    assert.equal(deriveOnboardingStatus(state({ ...base, contextState: { ...emptyContext, activeContext: { id: "c", contextSchemaVersion: "2.0" } } })).contextReady, false);
  });

  function fixture({ currentProfile = profile, dnaDraft = dna, brandDraft = brand } = {}) {
    let dnaState = { activeVersion: null, latestDraft: dnaDraft };
    let brandState = { activeVersion: null, latestDraft: brandDraft };
    let contextState = structuredClone(emptyContext);
    let contextCreates = 0;
    const service = createOnboardingService({
      businessProfileService: { getBusinessProfile: () => currentProfile },
      businessDnaService: { getCurrent: () => dnaState, activateVersion(id) { assert.equal(id, dnaState.latestDraft.id); dnaState = { activeVersion: { ...dnaState.latestDraft, status: "active" }, latestDraft: null }; } },
      brandBookService: { getCurrent: () => brandState, activateVersion(id) { assert.equal(id, brandState.latestDraft.id); brandState = { activeVersion: { ...brandState.latestDraft, status: "active" }, latestDraft: null }; } },
      businessContextService: {
        getCurrent() {
          contextState.currentSources = { businessProfile: currentProfile ? { id: currentProfile.id, updatedAt: currentProfile.updatedAt } : null, businessDna: dnaState.activeVersion ? { id: dnaState.activeVersion.id, versionNumber: 1 } : null, brandBook: brandState.activeVersion ? { id: brandState.activeVersion.id, versionNumber: 1 } : null };
          return contextState;
        },
        createDraft() { contextCreates += 1; return { id: `context-${contextCreates}` }; },
        activateVersion(id) { contextState = { ...contextState, isStale: false, activeContext: { id, contextSchemaVersion: "1.0", sourceManifest: { businessProfile: { id: currentProfile.id, updatedAt: currentProfile.updatedAt }, businessDna: { id: dnaState.activeVersion.id }, brandBook: { id: brandState.activeVersion.id } } } }; },
      },
      operationMetrics: { record() {} },
    });
    return { service, contextCreates: () => contextCreates };
  }

  const code = (fn) => {
    try { fn(); } catch (error) { assert.ok(error instanceof OnboardingError); return error.code; }
    assert.fail("Expected onboarding operation to fail.");
  };
  await t.test("finalize rejects incomplete Profile", () => runWithWorkspace("workspace-a", () => {
    const { service } = fixture({ currentProfile: null });
    assert.equal(code(() => service.finalize({}, "user-1")), "ONBOARDING_PROFILE_INCOMPLETE");
  }));
  await t.test("finalize rejects incomplete offering, audience, and brand by stage", () => runWithWorkspace("workspace-a", () => {
    assert.equal(code(() => fixture({ dnaDraft: { ...dna, offerings: [] } }).service.finalize({}, "u")), "ONBOARDING_OFFERING_INCOMPLETE");
    assert.equal(code(() => fixture({ brandDraft: { ...brand, brandIdentity: {} } }).service.finalize({}, "u")), "ONBOARDING_AUDIENCE_INCOMPLETE");
    assert.equal(code(() => fixture({ brandDraft: { ...brand, brandPersonality: ["حرفه‌ای"] } }).service.finalize({}, "u")), "ONBOARDING_BRAND_INCOMPLETE");
  }));
  await t.test("finalize rejects all client fields including foreign workspace identifiers", () => runWithWorkspace("workspace-a", () => {
    const { service } = fixture();
    assert.equal(code(() => service.finalize({ workspaceId: "workspace-b" }, "u")), "ONBOARDING_FIELDS_FORBIDDEN");
    assert.equal(code(() => service.finalize({ dnaId: "foreign" }, "u")), "ONBOARDING_FIELDS_FORBIDDEN");
  }));
  await t.test("finalize activates drafts and creates one fresh Context", () => runWithWorkspace("workspace-a", () => {
    const fixtureState = fixture(); const result = fixtureState.service.finalize({}, "u");
    assert.equal(result.onboarding.complete, true); assert.equal(result.reusedContext, false); assert.equal(fixtureState.contextCreates(), 1);
    assert.equal(result.nextDestination, "/dashboard/content?template=instagram");
  }));
  await t.test("repeated finalize is idempotent and reuses exact fresh Context", () => runWithWorkspace("workspace-a", () => {
    const fixtureState = fixture(); fixtureState.service.finalize({}, "u"); const second = fixtureState.service.finalize({}, "u");
    assert.equal(second.reusedContext, true); assert.equal(fixtureState.contextCreates(), 1);
  }));
  await t.test("status DTO never returns domain payloads", () => {
    const publicKeys = Object.keys(deriveOnboardingStatus(state())).sort();
    assert.equal(publicKeys.includes("profile"), false); assert.equal(publicKeys.includes("dna"), false); assert.equal(publicKeys.includes("brand"), false);
  });
  await t.test("onboarding source has no AI, agent, execution, messaging, worker, or provider imports", () => {
    const source = ["../app/onboarding/onboarding-status.mjs", "../app/services/onboarding-service.mjs", "../app/routes/onboarding.mjs"].map((path) => readFileSync(new URL(path, import.meta.url), "utf8")).join("\n");
    assert.doesNotMatch(source, /from\s+["'][^"']*(openai|cloudflare|agent|messaging|automation|execution|provider|worker|queue)[^"']*["']/i);
  });
});
