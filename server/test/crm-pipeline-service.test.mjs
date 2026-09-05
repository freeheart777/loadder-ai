import test from "node:test";
import assert from "node:assert/strict";
import {
  CrmPipelineError,
  createCrmPipelineService,
} from "../app/services/crm-pipeline-service.mjs";

function fixture(overrides = {}) {
  let deal = {
    id: "deal-1",
    leadId: "deal-1",
    title: "فرصت فروش آزمایشی",
    company: "Loadder Test",
    amount: 125_000_000,
    currency: "IRT",
    stage: "new",
    owner: "تیم فروش",
    nextAction: null,
    probabilityOverride: null,
    version: 1,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-04T00:00:00.000Z",
    ...overrides,
  };
  const history = [];

  const service = createCrmPipelineService({
    getDeals: () => [deal],
    getDealById: (id) => (id === deal.id ? deal : null),
    transitionDeal: (id, input) => {
      if (id !== deal.id) return { kind: "not_found" };
      if (input.expectedVersion !== deal.version) return { kind: "stale", current: deal };
      const previous = deal;
      deal = {
        ...deal,
        stage: input.toStage,
        lostReason: input.toStage === "lost" ? input.reason : null,
        version: deal.version + 1,
        updatedAt: "2026-09-05T00:00:00.000Z",
      };
      history.push({ fromStage: previous.stage, toStage: deal.stage, reason: input.reason, version: deal.version });
      return { kind: "ok", deal };
    },
    updateDealMetadata: (id, input) => {
      if (id !== deal.id) return { kind: "not_found" };
      if (input.expectedVersion !== deal.version) return { kind: "stale", current: deal };
      deal = { ...deal, owner: input.owner ?? deal.owner, nextAction: input.nextAction ?? deal.nextAction, version: deal.version + 1 };
      return { kind: "ok", deal };
    },
    getDealStageHistory: () => history,
    now: () => Date.parse("2026-09-05T12:00:00.000Z"),
  });

  return { service, getDeal: () => deal, history };
}

test("board is driven by persisted deals and exposes Lost as a terminal stage", () => {
  const { service } = fixture();
  const board = service.board();
  assert.equal(board.deals[0].amount, 125_000_000);
  assert.equal(board.deals[0].probability, 10);
  assert.equal(board.deals[0].expectedVersion, 1);
  assert.deepEqual(board.stages[0].allowedTargets, ["hot", "qualified", "lost"]);
  assert.equal(board.stages.at(-1).id, "lost");
});

test("valid transition uses optimistic deal version and appends history", () => {
  const { service, getDeal, history } = fixture();
  const result = service.transition({ dealId: "deal-1", toStage: "qualified", expectedVersion: 1 });
  assert.equal(getDeal().stage, "qualified");
  assert.equal(result.expectedVersion, 2);
  assert.equal(history.length, 1);
  assert.equal(history[0].fromStage, "new");
  assert.equal(history[0].toStage, "qualified");
});

test("legacy updatedAt concurrency token remains valid during board migration", () => {
  const { service } = fixture();
  const result = service.transition({ dealId: "deal-1", toStage: "qualified", expectedUpdatedAt: "2026-09-04T00:00:00.000Z" });
  assert.equal(result.stage, "qualified");
  assert.equal(result.expectedVersion, 2);
});

test("lost transition requires a reason and persists it in history", () => {
  const { service, getDeal, history } = fixture({ stage: "negotiating" });
  assert.throws(
    () => service.transition({ dealId: "deal-1", toStage: "lost", expectedVersion: 1 }),
    (error) => error instanceof CrmPipelineError && error.code === "LOST_REASON_REQUIRED"
  );
  const result = service.transition({ dealId: "deal-1", toStage: "lost", expectedVersion: 1, reason: "بودجه مشتری تأیید نشد" });
  assert.equal(result.stage, "lost");
  assert.equal(getDeal().lostReason, "بودجه مشتری تأیید نشد");
  assert.equal(history[0].reason, "بودجه مشتری تأیید نشد");
});

test("stale deal version cannot overwrite a newer state", () => {
  const { service, getDeal } = fixture({ stage: "hot", version: 3 });
  assert.throws(
    () => service.transition({ dealId: "deal-1", toStage: "qualified", expectedVersion: 2 }),
    (error) => error instanceof CrmPipelineError && error.code === "STALE_DEAL_VERSION" && error.status === 409
  );
  assert.equal(getDeal().stage, "hot");
});

test("owner and next action are persisted through guarded metadata update", () => {
  const { service } = fixture();
  const result = service.updateMetadata({
    dealId: "deal-1",
    expectedVersion: 1,
    owner: "سارا احمدی",
    nextAction: "ارسال پروپوزال نهایی",
  });
  assert.equal(result.owner, "سارا احمدی");
  assert.equal(result.nextAction, "ارسال پروپوزال نهایی");
  assert.equal(result.expectedVersion, 2);
});
