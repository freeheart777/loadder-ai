import test from "node:test";
import assert from "node:assert/strict";
import express from "express";

import { acquisitionProviderRegistry } from "../app/integrations/acquisition-provider-registry.mjs";
import { createAcquisitionProviderRouter } from "../app/routes/acquisition-providers.mjs";

test("acquisition provider registry separates advertising and messaging execution providers", () => {
  const googleAds = acquisitionProviderRegistry.get("google_ads");
  const smsIr = acquisitionProviderRegistry.get("sms_ir");

  assert.equal(googleAds.auth.type, "oauth2");
  assert.equal(googleAds.auth.requiresDeveloperCredential, true);
  assert.ok(googleAds.capabilities.includes("READ_METRICS"));
  assert.ok(googleAds.capabilities.includes("CREATE_CAMPAIGN"));
  assert.equal(googleAds.executionPolicy, "explicit_user_authorization");

  assert.equal(smsIr.auth.type, "api_key");
  assert.ok(smsIr.capabilities.includes("SEND_SMS"));
  assert.ok(smsIr.capabilities.includes("READ_DELIVERY_STATUS"));
  assert.equal(smsIr.executionPolicy, "explicit_user_authorization");

  assert.deepEqual(
    acquisitionProviderRegistry.list({ region: "IRAN" }).map((provider) => provider.providerId).sort(),
    ["google_ads", "sms_ir"]
  );
  assert.deepEqual(
    acquisitionProviderRegistry.list({ category: "advertising" }).map((provider) => provider.providerId),
    ["google_ads"]
  );
});

test("acquisition provider HTTP catalog exposes definitions without credentials", async () => {
  const app = express();
  app.use("/api", createAcquisitionProviderRouter());
  const server = await new Promise((resolve) => {
    const candidate = app.listen(0, "127.0.0.1", () => resolve(candidate));
  });

  try {
    const base = `http://127.0.0.1:${server.address().port}/api/acquisition-providers`;
    const list = await (await fetch(base)).json();
    assert.equal(list.success, true);
    assert.ok(list.providers.some((provider) => provider.providerId === "google_ads"));
    assert.ok(list.providers.some((provider) => provider.providerId === "sms_ir"));
    assert.equal(JSON.stringify(list).includes("apiKey"), false);
    assert.equal(JSON.stringify(list).includes("clientSecret"), false);

    assert.equal((await fetch(`${base}/missing`)).status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
