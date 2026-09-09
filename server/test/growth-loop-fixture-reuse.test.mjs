import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Bootstrap a disposable database in the same order server/index.mjs does:
// import workspace-database.mjs first (creates the raw legacy tables such as
// `leads`/`automations`), then run the full migration set on top of it.
const directory = mkdtempSync(join(tmpdir(), "loadder-growth-fixture-"));
process.env.DATABASE_PATH = join(directory, "test.sqlite");

const { db } = await import("../db/workspace-database.mjs");
const { runMigrations } = await import("../db/migrate.mjs");
const { runWithWorkspace } = await import("../app/tenant-context.mjs");
const { createIdentityRepository } = await import("../app/repositories/identity-repository.mjs");
const { createBusinessDnaRepository } = await import("../app/repositories/business-dna-repository.mjs");
const { createBusinessDnaService } = await import("../app/services/business-dna-service.mjs");
const { createBrandBookRepository } = await import("../app/repositories/brand-book-repository.mjs");
const { createBrandBookService } = await import("../app/services/brand-book-service.mjs");
const { createBusinessContextRepository } = await import("../app/repositories/business-context-repository.mjs");
const { createBusinessContextService } = await import("../app/services/business-context-service.mjs");
const { createIntelligenceRecommendationRepository } = await import("../app/repositories/intelligence-recommendation-repository.mjs");
const { createHumanGovernanceRepository } = await import("../app/repositories/human-governance-repository.mjs");
const { createHumanGovernanceService } = await import("../app/services/human-governance-service.mjs");
const { seedGrowthLoopFixture } = await import("../test-helpers/growth-loop-fixture.mjs");

runMigrations(db);

after(() => {
  db.close();
  rmSync(directory, { recursive: true, force: true });
});

let workspaceCounter = 0;
function setup() {
  workspaceCounter += 1;
  const identities = createIdentityRepository(db);
  const timestamp = new Date().toISOString();
  const { user, memberships } = identities.createUserWorkspaceAndMembership({
    mobile: `0912000${String(1000 + workspaceCounter).slice(-4)}`,
    name: "Fixture Test User",
    workspaceName: "Fixture Test Workspace",
    workspaceSlug: `fixture-test-${workspaceCounter}-${Date.now()}`,
    timestamp,
  });
  return { userId: user.id, workspaceId: memberships[0].workspace.id, membershipId: memberships[0].id };
}

test("reuse-or-create: running the fixture twice returns the same bounded identity and does not duplicate rows", async () => {
  const { userId, workspaceId, membershipId } = setup();

  const first = await seedGrowthLoopFixture({ db, workspaceId, userId, membershipId, mode: "reuse-or-create" });
  const second = await seedGrowthLoopFixture({ db, workspaceId, userId, membershipId, mode: "reuse-or-create" });

  assert.equal(second.experimentId, first.experimentId, "experiment must be reused, not duplicated");
  assert.equal(second.contextId, first.contextId, "business context version must be reused");
  assert.equal(second.candidateId, first.candidateId, "approved candidate must be reused");
  assert.equal(second.attentionCandidateId, first.attentionCandidateId, "attention candidate must be reused, not regenerated");
  assert.equal(second.leadId, first.leadId, "the demo lead must be reused, not duplicated");

  await runWithWorkspace(workspaceId, async () => {
    const dna = createBusinessDnaService({ repository: createBusinessDnaRepository(db), auditRepository: createIdentityRepository(db) });
    assert.equal(dna.listVersions().length, 1, "only one DNA version should exist after two runs");

    const brand = createBrandBookService({ repository: createBrandBookRepository(db), auditRepository: createIdentityRepository(db) });
    assert.equal(brand.listVersions().length, 1, "only one brand book version should exist after two runs");

    const contexts = createBusinessContextService({ repository: createBusinessContextRepository(db), auditRepository: createIdentityRepository(db) });
    assert.equal(contexts.listVersions().length, 1, "only one business context version should exist after two runs");

    const recommendationRepository = createIntelligenceRecommendationRepository(db);
    const recommendations = recommendationRepository.listPage({ limit: 100 });
    assert.equal(recommendations.items.length, 1, "only one setup recommendation should exist after two runs");

    const governance = createHumanGovernanceService({
      repository: createHumanGovernanceRepository(db),
      recommendationRepository,
      freshnessQuery: { resolve: () => "CURRENT" },
    });
    const decisions = governance.listDecisions(recommendations.items[0].id, {});
    assert.equal(decisions.items.length, 1, "only one ADOPT decision should exist after two runs");

    const briefRows = db.prepare("SELECT count(*) n FROM growth_content_briefs WHERE workspace_id=?").get(workspaceId).n;
    assert.equal(briefRows, 2, "the approved and attention briefs should each exist exactly once after two runs");

    const candidateRows = db.prepare("SELECT count(*) n FROM growth_content_candidates WHERE workspace_id=?").get(workspaceId).n;
    assert.equal(candidateRows, 2, "the approved and reconciliation candidates should each exist exactly once after two runs");
    assert.equal(
      db.prepare("SELECT state FROM growth_content_candidates WHERE id=?").get(second.attentionCandidateId).state,
      "RECONCILIATION_REQUIRED",
      "the demo attention signal must preserve an explicit unknown provider outcome"
    );

    const leadRows = db.prepare("SELECT count(*) n FROM leads WHERE workspace_id=? AND phone=?").get(workspaceId, "09120000001").n;
    assert.equal(leadRows, 1, "only one demo lead should exist after two runs");
  });
});

test("create mode preserves the original E2E one-shot semantics (second call fails)", async () => {
  const { userId, workspaceId, membershipId } = setup();

  const first = await seedGrowthLoopFixture({ db, workspaceId, userId, membershipId, mode: "create" });
  assert.ok(first.experimentId);

  await assert.rejects(
    () => seedGrowthLoopFixture({ db, workspaceId, userId, membershipId, mode: "create" }),
    /already exists for this workspace/,
    "create mode must remain strictly one-shot, unchanged from the original E2E fixture"
  );
});

test("rejects an unknown mode", async () => {
  const { userId, workspaceId, membershipId } = setup();
  await assert.rejects(
    () => seedGrowthLoopFixture({ db, workspaceId, userId, membershipId, mode: "bogus" }),
    /Unknown growth loop fixture mode/
  );
});

test("requires db, workspaceId, userId and membershipId", async () => {
  await assert.rejects(() => seedGrowthLoopFixture({ mode: "create" }), /are required/);
});
