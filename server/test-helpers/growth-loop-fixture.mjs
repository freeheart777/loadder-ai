import { createHash, randomUUID } from "node:crypto";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { createIdentityRepository } from "../app/repositories/identity-repository.mjs";
import { createBusinessProfileRepository } from "../app/repositories/business-profile-repository.mjs";
import { createBusinessDnaRepository } from "../app/repositories/business-dna-repository.mjs";
import { createBrandBookRepository } from "../app/repositories/brand-book-repository.mjs";
import { createBusinessContextRepository } from "../app/repositories/business-context-repository.mjs";
import { createBusinessContextUsageRepository } from "../app/repositories/business-context-usage-repository.mjs";
import { createBusinessProfileService } from "../app/services/business-profile-service.mjs";
import { createBusinessDnaService } from "../app/services/business-dna-service.mjs";
import { createBrandBookService } from "../app/services/brand-book-service.mjs";
import { createBusinessContextService } from "../app/services/business-context-service.mjs";
import { createBusinessContextConsumerGateway } from "../app/context-consumers/business-context-consumer-gateway.mjs";
import { contextCapabilityRegistry } from "../app/context-consumers/capability-registry.mjs";
import { createIntelligenceRecommendationRepository } from "../app/repositories/intelligence-recommendation-repository.mjs";
import { createHumanGovernanceRepository } from "../app/repositories/human-governance-repository.mjs";
import { createHumanGovernanceService } from "../app/services/human-governance-service.mjs";
import { createExperimentRepository } from "../app/repositories/experiment-repository.mjs";
import { createGrowthContentRepository } from "../app/repositories/growth-content-repository.mjs";
import { createGrowthContentService } from "../app/services/growth-content-service.mjs";

const sha = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const deterministicId = (namespace, workspaceId) => {
  const value = sha({ namespace, workspaceId });
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-4${value.slice(13, 16)}-a${value.slice(17, 20)}-${value.slice(20, 32)}`;
};

// Reuse-or-create mode needs a byte-identical goal contract across reruns so
// experiment-repository's (workspace_id, decision_id) idempotency check
// matches. A Date.now()-relative window (as E2E uses) would differ every run.
const DEMO_WINDOW_START = "2025-01-01T00:00:00.000Z";
const DEMO_WINDOW_END = "2025-01-02T00:00:00.000Z";
const DEMO_LEADS = Object.freeze([
  { key: "growth-demo-lead-1", name: "نیلوفر پارسا", phone: "09120000001", company: "استودیو سپهر", source: "referral", score: 86 },
  { key: "growth-demo-lead-2", name: "کیان مهرگان", phone: "09120000002", company: "راهکار نوین", source: "website", score: 78 },
  { key: "growth-demo-lead-3", name: "رها نیک‌فر", phone: "09120000003", company: "خانه خلاقیت آبان", source: "social", score: 72 },
]);
const DEMO_SUBJECT_KEY = "growth-demo-setup";
const DEMO_DECISION_KEY = "growth-demo-goal";
const DEMO_BRIEF_KEY = "growth-demo-brief";
const DEMO_CANDIDATE_KEY = "growth-demo-candidate";
const DEMO_ATTENTION_BRIEF_KEY = "growth-demo-attention-brief";
const DEMO_ATTENTION_CANDIDATE_KEY = "growth-demo-attention-candidate";

/**
 * Author the canonical Growth Loop prerequisites (business profile -> DNA ->
 * brand book -> business context -> setup recommendation -> ADOPT decision
 * -> experiment -> brief -> candidate -> lead) through the same canonical
 * repositories/services the E2E fixture uses.
 *
 * mode:'create'          preserves the original E2E behavior exactly: every
 *                         call authors fresh state and throws if prerequisite
 *                         state already exists (unchanged one-shot semantics
 *                         for a disposable, per-run database).
 * mode:'reuse-or-create'  is safe to call repeatedly against a persistent
 *                         local database: it reuses existing state wherever
 *                         canonical getters/idempotency keys allow it, and
 *                         only authors what is actually missing.
 */
export async function seedGrowthLoopFixture({
  db,
  workspaceId,
  userId,
  membershipId,
  mode = "create",
}) {
  if (mode !== "create" && mode !== "reuse-or-create") {
    throw new Error(`Unknown growth loop fixture mode: ${mode}`);
  }
  if (!db || !workspaceId || !userId || !membershipId) {
    throw new Error("db, workspaceId, userId and membershipId are required.");
  }
  const reuse = mode === "reuse-or-create";
  const now = () => new Date();

  return runWithWorkspace(workspaceId, async () => {
    const identities = createIdentityRepository(db);
    const profiles = createBusinessProfileService({ repository: createBusinessProfileRepository(db), auditRepository: identities, now });
    const dna = createBusinessDnaService({ repository: createBusinessDnaRepository(db), auditRepository: identities, now });
    const brand = createBrandBookService({ repository: createBrandBookRepository(db), auditRepository: identities, now });
    const contexts = createBusinessContextService({ repository: createBusinessContextRepository(db), auditRepository: identities, now });

    const currentProfile = profiles.getBusinessProfile();
    if (!reuse || !currentProfile) {
      profiles.createBusinessProfile({ name: reuse ? "استودیو رشد سپهر" : "کسب‌وکار آزمایشی چرخه رشد", industry: "Services" }, userId);
    } else if (/آزمایش|آزمون|test|e2e/i.test(currentProfile.name)) {
      // This is a DEV-only display-fixture correction. Using the production
      // update operation would truthfully stale the already pinned context
      // and change the demo's business-state scenario for a cosmetic rename.
      db.prepare("UPDATE business_profiles SET name=? WHERE id=? AND workspace_id=?")
        .run("استودیو رشد سپهر", currentProfile.id, workspaceId);
    }

    let dnaVersion = reuse ? dna.getCurrent().activeVersion : null;
    if (!dnaVersion) {
      const draft = dna.createDraft({ valueProposition: "مشاوره شفاف", goals: ["افزایش لیدهای واجد شرایط"] }, userId);
      dnaVersion = dna.activateVersion(draft.id, userId);
    }

    let brandVersion = reuse ? brand.getCurrent().activeVersion : null;
    if (!brandVersion) {
      const draft = brand.createDraft({ toneOfVoice: "شفاف و حرفه‌ای" }, userId);
      brandVersion = brand.activateVersion(draft.id, userId);
    }

    let context = reuse ? contexts.getCurrent().activeContext : null;
    if (!context) {
      context = contexts.activateVersion(contexts.createDraft({}, userId).id, userId);
    }

    const recommendationRepository = createIntelligenceRecommendationRepository(db);
    const at = now().toISOString();
    // intelligence-recommendation-repository.create() already dedupes on
    // (workspace_id, producer, producer_version, producer_key) — a stable,
    // deterministic key (not crypto.randomUUID()) is what makes this reusable.
    const producerKey = reuse ? sha({ marker: DEMO_SUBJECT_KEY, workspaceId }) : randomUUID();
    const seedRecommendation = recommendationRepository.create({
      recommendationType: "attention_evidence_review",
      recommendationVersion: 1,
      schemaVersion: 1,
      subjectType: "listening_scope",
      subjectId: null,
      subjectKey: reuse ? DEMO_SUBJECT_KEY : "growth-e2e-setup",
      considerationCode: "REVIEW_ATTENTION_INCREASE",
      rationaleCode: "ATTENTION_RISING",
      reviewPriority: "MEDIUM",
      semanticFindingReferences: [],
      semanticManifestHash: sha([]),
      contextVersionId: context.id,
      pointInTimeCutoff: at,
      producer: reuse ? "growth_demo_setup" : "growth_e2e_setup",
      producerVersion: "1",
      producerKey,
      confidence: null,
      confidenceReason: reuse ? "Local demo prerequisite only" : "E2E prerequisite only",
      provenance: { setupOnly: true },
      calculatedAt: at,
      createdAt: at,
    }).recommendation;

    const governance = createHumanGovernanceService({
      repository: createHumanGovernanceRepository(db),
      recommendationRepository,
      freshnessQuery: { resolve: () => "CURRENT" },
      now,
    });
    // human-governance createDecision dedupes on (actor.userId, idempotencyKey)
    // and requires the request hash (which embeds recommendationId) to match
    // — safe to call again once the recommendation above is itself stable.
    const decision = governance.createDecision(
      seedRecommendation.id,
      { decisionType: "ADOPT", allowStale: false, supersedesDecisionId: null },
      { userId, membershipId, role: "owner" },
      reuse ? DEMO_DECISION_KEY : "growth-e2e-goal"
    ).decision;

    const start = reuse ? DEMO_WINDOW_START : new Date(Date.now() - 86400000).toISOString();
    const end = reuse ? DEMO_WINDOW_END : new Date(Date.now() - 60000).toISOString();
    const experiments = createExperimentRepository(db, {
      currentContextState: () => ({ contextVersionId: context.id, isStale: false }),
      now,
    });
    // experiments.author() dedupes on (workspace_id, decision_id) as long as
    // every compared field (including the serialized goal contract) matches
    // byte-for-byte with the prior call — hence the fixed window above.
    const experiment = experiments.author(
      {
        decisionId: decision.id,
        contextVersionId: context.id,
        goalRef: "/strategy/goals/0",
        goalContractVersion: 1,
        hypothesis: "محتوای شفاف درخواست مشاوره را بیشتر می‌کند",
        treatment: "دعوت روشن به مشاوره",
        goalContract: {
          metric: "lead_count",
          direction: "INCREASE",
          target: 1,
          unit: "COUNT",
          measurementWindow: { start, end },
          baseline: { state: "UNKNOWN" },
        },
        supersedesExperimentId: null,
      },
      { userId }
    ).experiment;

    const gateway = createBusinessContextConsumerGateway({
      businessContextService: contexts,
      usageRepository: createBusinessContextUsageRepository(db),
      capabilityRegistry: contextCapabilityRegistry,
      now,
    });
    const content = createGrowthContentRepository(db, { contextGateway: gateway, now });
    const brief = content.createBrief(
      {
        experimentId: experiment.id,
        contextVersionId: context.id,
        goalRef: "/strategy/goals/0",
        audience: "مدیر کسب‌وکار کوچک",
        message: "رزرو مشاوره",
        channel: "SOCIAL",
        contentType: "instagram",
        constraints: ["بدون ادعای تضمینی"],
        idempotencyKey: reuse ? DEMO_BRIEF_KEY : "growth-e2e-brief",
      },
      { userId }
    ).brief;

    const generated = createGrowthContentService({
      repository: content,
      execute: async () => ({
        success: true,
        answer: "برای بررسی مسیر رشد کسب‌وکارتان، یک جلسه مشاوره رزرو کنید.",
        provider: "deterministic-e2e",
        model: "fixture-v1",
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      }),
    });
    const { candidate } = await generated.generate(
      brief.id,
      { idempotencyKey: reuse ? DEMO_CANDIDATE_KEY : "growth-e2e-candidate" },
      { userId }
    );
    const approved = content.decide(candidate.id, { decision: "APPROVED" }, { userId });

    // Persistent local demos also need one truthful operational attention
    // item. The create-mode browser fixture remains unchanged. An uncertain
    // provider outcome is represented explicitly and is never regenerated on
    // replay, so Mission Control can surface S3 without inventing success.
    let attentionCandidateId = null;
    if (reuse) {
      const attentionBrief = content.createBrief(
        {
          experimentId: experiment.id,
          contextVersionId: context.id,
          goalRef: "/strategy/goals/0",
          audience: "مدیر کسب‌وکار کوچک",
          message: "پیگیری نتیجه نامشخص ارائه‌دهنده",
          channel: "SOCIAL",
          contentType: "instagram",
          constraints: ["نیازمند تطبیق انسانی"],
          idempotencyKey: DEMO_ATTENTION_BRIEF_KEY,
        },
        { userId }
      ).brief;
      const uncertain = createGrowthContentService({
        repository: content,
        execute: async () => { throw new Error("DEMO_PROVIDER_OUTCOME_UNKNOWN"); },
      });
      const attention = await uncertain.generate(
        attentionBrief.id,
        { idempotencyKey: DEMO_ATTENTION_CANDIDATE_KEY },
        { userId }
      );
      attentionCandidateId = attention.candidate.id;
    }

    // Leads are created via raw SQL against the injected `db` rather than
    // server/db/database.mjs's createLead(), which is bound to that module's
    // own singleton connection (opened as a side effect of import) instead
    // of whatever `db` this fixture was called with.
    let lead = null;
    const demoLeadInputs = reuse
      ? DEMO_LEADS
      : [{ key: randomUUID(), name: "لید واقعی آزمون مرورگر", phone: "09120000001", company: null, source: "growth-e2e", score: 80 }];
    for (const input of demoLeadInputs) {
      let current = db
        .prepare("SELECT id, workspace_id AS workspaceId, name, phone FROM leads WHERE workspace_id=? AND phone=?")
        .get(workspaceId, input.phone);
      if (current && reuse) {
        db.prepare("UPDATE leads SET name=?, company=?, source=?, score=? WHERE id=? AND workspace_id=?")
          .run(input.name, input.company, input.source, input.score, current.id, workspaceId);
      } else if (!current) {
        const id = reuse ? deterministicId(input.key, workspaceId) : randomUUID();
        const timestamp = now().toISOString();
        db.prepare(
          `INSERT INTO leads (id, workspace_id, name, phone, email, company, source, score, status, opportunity_value, customer_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, NULL, ?, ?, ?, 'new', 0, NULL, ?, ?)`
        ).run(id, workspaceId, input.name, input.phone, input.company, input.source, input.score, timestamp, timestamp);
        current = { id, phone: input.phone };
      }
      if (input.phone === DEMO_LEADS[0].phone) lead = current;
    }
    if (!lead) {
      const id = randomUUID();
      const timestamp = now().toISOString();
      db.prepare(
        `INSERT INTO leads (id, workspace_id, name, phone, email, company, source, score, status, opportunity_value, customer_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, 'new', 0, NULL, ?, ?)`
      ).run(id, workspaceId, "لید واقعی آزمون مرورگر", "09120000001", "growth-e2e", 80, timestamp, timestamp);
      lead = { id };
    }

    return { experimentId: experiment.id, contextId: context.id, candidateId: approved.id, attentionCandidateId, leadId: lead.id };
  });
}
