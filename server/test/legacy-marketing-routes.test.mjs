import assert from "node:assert/strict";
import test from "node:test";

import express from "express";

import { createLegacyMarketingRouter } from "../app/routes/legacy-marketing.mjs";

test("legacy Marketing read router preserves paths, filters, and response contracts", async (t) => {
  const calls = [];
  const channel = { id: "channel-1", name: "Owned" };
  const platform = { id: "platform-1", channelId: channel.id };
  const service = { id: "service-1", platformId: platform.id };
  const campaign = { id: "campaign-1", name: "Campaign" };
  const app = express();
  app.use("/api", createLegacyMarketingRouter({
    getMarketingChannels: () => [channel],
    getMarketingPlatforms: (channelId = null) => { calls.push(["platforms", channelId]); return [platform]; },
    getAdvertisingServices: (platformId = null) => { calls.push(["services", platformId]); return [service]; },
    getMarketingCampaigns: () => [campaign],
  }));
  const server = await new Promise((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;

  const channels = await (await fetch(`${base}/api/marketing/channels`)).json();
  assert.deepEqual(channels, { ok: true, count: 1, data: [channel] });
  const platforms = await (await fetch(`${base}/api/marketing/platforms?channelId=channel-1`)).json();
  assert.deepEqual(platforms, { ok: true, count: 1, data: [platform] });
  const services = await (await fetch(`${base}/api/marketing/services?platformId=platform-1`)).json();
  assert.deepEqual(services, { ok: true, count: 1, data: [service] });
  const structure = await (await fetch(`${base}/api/marketing/structure`)).json();
  assert.deepEqual(structure, { ok: true, count: 1, data: [{ ...channel, platforms: [{ ...platform, services: [service] }] }] });
  const campaigns = await (await fetch(`${base}/api/marketing/campaigns`)).json();
  assert.deepEqual(campaigns, { ok: true, count: 1, data: [campaign] });
  assert.deepEqual(calls, [["platforms", "channel-1"], ["services", "platform-1"], ["platforms", null], ["services", null]]);
});
