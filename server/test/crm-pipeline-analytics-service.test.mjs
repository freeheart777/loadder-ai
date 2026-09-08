import test from "node:test";
import assert from "node:assert/strict";
import { createCrmPipelineAnalyticsService } from "../app/services/crm-pipeline-analytics-service.mjs";

const deals = [
  { id: "d1", title: "Won", stage: "converted", owner: "A", amount: 1000, updatedAt: "2026-09-04T00:00:00.000Z", lostReason: null },
  { id: "d2", title: "Lost", stage: "lost", owner: "B", amount: 500, updatedAt: "2026-09-03T00:00:00.000Z", lostReason: "بودجه" },
  { id: "d3", title: "Open", stage: "qualified", owner: "C", amount: 2000, updatedAt: "2026-09-01T00:00:00.000Z", lostReason: null },
];

const histories = {
  d1: [
    { toStage: "new", fromStage: null, occurredAt: "2026-09-01T00:00:00.000Z", version: 1 },
    { toStage: "qualified", fromStage: "new", occurredAt: "2026-09-02T00:00:00.000Z", version: 2 },
    { toStage: "negotiating", fromStage: "qualified", occurredAt: "2026-09-03T00:00:00.000Z", version: 3 },
    { toStage: "converted", fromStage: "negotiating", occurredAt: "2026-09-04T00:00:00.000Z", version: 4 },
  ],
  d2: [
    { toStage: "new", fromStage: null, occurredAt: "2026-09-01T00:00:00.000Z", version: 1 },
    { toStage: "lost", fromStage: "new", occurredAt: "2026-09-03T00:00:00.000Z", version: 2 },
  ],
  d3: [
    { toStage: "new", fromStage: null, occurredAt: "2026-09-01T00:00:00.000Z", version: 1 },
    { toStage: "qualified", fromStage: "new", occurredAt: "2026-09-02T00:00:00.000Z", version: 2 },
  ],
};

test("pipeline analytics calculates closed win rate, stage timing and lost reasons from immutable history", () => {
  const service = createCrmPipelineAnalyticsService({
    getDeals: () => deals,
    getDealStageHistory: (id) => histories[id],
    now: () => Date.parse("2026-09-05T00:00:00.000Z"),
  });

  const analytics = service.snapshot();
  assert.equal(analytics.summary.totalDeals, 3);
  assert.equal(analytics.summary.openDeals, 1);
  assert.equal(analytics.summary.winRate, 50);
  assert.equal(analytics.summary.pipelineValue, 2000);
  assert.equal(analytics.summary.stuckCount, 1);

  const newStage = analytics.stageMetrics.find((item) => item.stage === "new");
  assert.equal(newStage.enteredCount, 3);
  assert.equal(newStage.averageTimeDays, 1.3);

  const newToQualified = analytics.conversions.find((item) => item.fromStage === "new" && item.toStage === "qualified");
  assert.equal(newToQualified.count, 2);
  assert.equal(newToQualified.conversionRate, 66.7);

  assert.deepEqual(analytics.lostReasons, [{ reason: "بودجه", count: 1, share: 100 }]);
});
