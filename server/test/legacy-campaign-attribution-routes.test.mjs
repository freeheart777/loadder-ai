import assert from "node:assert/strict";
import test from "node:test";

import express from "express";

import { createLegacyAttributionRouter } from "../app/routes/legacy-attribution.mjs";
import { createLegacyCampaignsRouter } from "../app/routes/legacy-campaigns.mjs";

function fixture({ campaignExists = true } = {}) {
  const calls = [];
  const campaign = { id: "campaign-1", name: "Campaign", budget: 1000 };
  const metric = { id: "metric-1", campaignId: campaign.id, spend: 100 };
  const touchpoint = { id: "touch-1", campaignId: campaign.id, touchType: "click" };
  const control = { controlMode: "copilot", targets: { roasMin: 2 }, guardrails: {}, trackingHealthy: true };
  const dependencies = {
    getCampaignById: (id) => campaignExists && id === campaign.id ? campaign : null,
    createMarketingCampaign: (input) => { calls.push(["createCampaign", input]); return campaign; },
    getCampaignMetrics: (id) => { calls.push(["metrics", id]); return [metric]; },
    saveCampaignMetric: (input) => { calls.push(["saveMetric", input]); return metric; },
    calculateCampaignKPIs: (metrics) => ({ spend: metrics.reduce((sum, item) => sum + item.spend, 0) }),
    getAttributionTouchpoints: (filters) => { calls.push(["attribution", filters]); return [touchpoint]; },
    createAttributionTouchpoint: (input) => { calls.push(["createAttribution", input]); return touchpoint; },
    getCampaignAttributedPerformance: (id) => ({ campaignId: id, revenue: 400 }),
    getCampaignRuntimeConfig: () => control,
    updateCampaignRuntimeConfig: (id, updates) => { calls.push(["control", id, updates]); return { ...control, ...updates }; },
    defaultControlMode: "copilot",
  };
  return { calls, campaign, metric, touchpoint, control, dependencies };
}

async function serve(dependencies) {
  const app = express(); app.use(express.json());
  app.use("/api", createLegacyCampaignsRouter(dependencies));
  app.use("/api", createLegacyAttributionRouter(dependencies));
  const server = await new Promise((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

test("extracted Campaign and Attribution routes preserve successful contracts", async (t) => {
  const data = fixture(); const { server, base } = await serve(data.dependencies);
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const post = (path, body) => fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  let response = await post("/api/marketing/campaigns", { channelId: "channel-1", platformId: "platform-1", name: "Campaign", budget: "1000" });
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { ok: true, data: { campaign: data.campaign, control: data.control } });

  response = await fetch(`${base}/api/marketing/campaigns/campaign-1/performance`);
  assert.deepEqual(await response.json(), { ok: true, data: { campaign: data.campaign, performance: { campaignId: "campaign-1", revenue: 400 } } });
  response = await fetch(`${base}/api/marketing/campaigns/campaign-1/metrics`);
  assert.deepEqual(await response.json(), { ok: true, count: 1, data: [data.metric] });
  response = await post("/api/marketing/campaigns/campaign-1/metrics", { spend: 100 });
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { ok: true, data: { metric: data.metric, kpis: { spend: 100 } } });
  response = await fetch(`${base}/api/marketing/campaigns/campaign-1/kpis`);
  assert.deepEqual(await response.json(), { ok: true, data: { spend: 100 } });
  response = await fetch(`${base}/api/marketing/campaigns/campaign-1`);
  const detail = await response.json();
  assert.deepEqual(detail, { ok: true, data: { campaign: data.campaign, metrics: [data.metric], kpis: { spend: 100 }, performance: { campaignId: "campaign-1", revenue: 400 }, control: data.control, attribution: { count: 1, touchpoints: [data.touchpoint] } } });

  response = await fetch(`${base}/api/marketing/attribution?customerId=customer-1&leadId=lead-1&campaignId=campaign-1`);
  assert.deepEqual(await response.json(), { ok: true, count: 1, data: [data.touchpoint] });
  assert.deepEqual(data.calls.find(([name, filters]) => name === "attribution" && filters.customerId), ["attribution", { customerId: "customer-1", leadId: "lead-1", campaignId: "campaign-1" }]);
  response = await post("/api/marketing/attribution", { touchType: "click", campaignId: "campaign-1" });
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { ok: true, data: data.touchpoint });
});

test("extracted routes preserve validation, not-found, and Persian errors", async (t) => {
  const missing = fixture({ campaignExists: false }); const { server, base } = await serve(missing.dependencies);
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const post = (path, body) => fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  let response = await post("/api/marketing/campaigns", { name: "Incomplete" });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { ok: false, message: "channelId، platformId و name الزامی هستند." });
  for (const path of ["performance", "metrics", "kpis"]) {
    response = await fetch(`${base}/api/marketing/campaigns/guessed/${path}`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { ok: false, message: "کمپین پیدا نشد." });
  }
  response = await fetch(`${base}/api/marketing/campaigns/guessed`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { ok: false, message: "کمپین پیدا نشد." });
  response = await post("/api/marketing/attribution", {});
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { ok: false, message: "touchType الزامی است." });
});
