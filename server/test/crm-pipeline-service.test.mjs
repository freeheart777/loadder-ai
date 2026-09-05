import test from "node:test";
import assert from "node:assert/strict";
import {
  CrmPipelineError,
  createCrmPipelineService,
} from "../app/services/crm-pipeline-service.mjs";

function fixture(overrides = {}) {
  let lead = {
    id: "deal-1",
    name: "فرصت فروش آزمایشی",
    company: "Loadder Test",
    opportunityValue: 125_000_000,
    status: "new",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-04T00:00:00.000Z",
    ...overrides,
  };

  const service = createCrmPipelineService({
    getLeads: () => [lead],
    getLeadById: (id) => (id === lead.id ? lead : null),
    updateLead: (id, updates) => {
      if (id !== lead.id) return null;
      lead = {
        ...lead,
        ...updates,
        updatedAt: "2026-09-05T00:00:00.000Z",
      };
      return lead;
    },
    now: () => Date.parse("2026-09-05T12:00:00.000Z"),
  });

  return { service, getLead: () => lead };
}

test("board enriches real leads without moving business logic into the Kanban", () => {
  const { service } = fixture();
  const board = service.board();

  assert.equal(board.stages[0].id, "new");
  assert.deepEqual(board.stages[0].allowedTargets, ["hot", "qualified"]);
  assert.equal(board.deals.length, 1);
  assert.equal(board.deals[0].amount, 125_000_000);
  assert.equal(board.deals[0].stage, "new");
  assert.equal(board.deals[0].probability, 10);
  assert.equal(board.deals[0].ageDays, 4);
});

test("valid transition is persisted only through the pipeline service", () => {
  const { service, getLead } = fixture();
  const result = service.transition({
    dealId: "deal-1",
    toStage: "qualified",
    expectedUpdatedAt: "2026-09-04T00:00:00.000Z",
  });

  assert.equal(getLead().status, "qualified");
  assert.equal(result.stage, "qualified");
  assert.equal(result.probability, 50);
  assert.equal(result.expectedUpdatedAt, "2026-09-05T00:00:00.000Z");
});

test("forbidden stage jump is rejected", () => {
  const { service, getLead } = fixture();

  assert.throws(
    () =>
      service.transition({
        dealId: "deal-1",
        toStage: "converted",
        expectedUpdatedAt: "2026-09-04T00:00:00.000Z",
      }),
    (error) =>
      error instanceof CrmPipelineError &&
      error.code === "TRANSITION_NOT_ALLOWED" &&
      error.status === 409
  );

  assert.equal(getLead().status, "new");
});

test("stale drag-and-drop cannot overwrite a newer deal state", () => {
  const { service, getLead } = fixture({
    status: "hot",
    updatedAt: "2026-09-05T10:00:00.000Z",
  });

  assert.throws(
    () =>
      service.transition({
        dealId: "deal-1",
        toStage: "qualified",
        expectedUpdatedAt: "2026-09-04T00:00:00.000Z",
      }),
    (error) =>
      error instanceof CrmPipelineError &&
      error.code === "STALE_DEAL_VERSION" &&
      error.status === 409
  );

  assert.equal(getLead().status, "hot");
});
