import test from "node:test";
import assert from "node:assert/strict";
import { createGoogleAdsOauthService } from "../app/services/google-ads-oauth-service.mjs";

function fakeRepository() {
  let state = null;
  let row = null;
  let publicConnection = null;
  return {
    saveState(value) { state = value; },
    consumeState(hash, userId, at) {
      if (!state || state.stateHash !== hash || state.userId !== userId || state.expiresAt < at) return null;
      const result = { verifierCiphertext: state.verifierCiphertext, expiresAt: state.expiresAt };
      state = null;
      return result;
    },
    upsertConnection(value) {
      row = { refresh_token_ciphertext: value.refreshTokenCiphertext, status: "ACCOUNT_SELECTION_REQUIRED" };
      publicConnection = { id: "conn-1", status: "ACCOUNT_SELECTION_REQUIRED", accessibleCustomers: value.accessibleCustomers, selectedCustomerId: null, loginCustomerId: null };
      return publicConnection;
    },
    getConnection() { return publicConnection; },
    getConnectionRow() { return row; },
    selectAccount({ customerId, loginCustomerId }) {
      publicConnection = { ...publicConnection, status: "READY", selectedCustomerId: customerId, loginCustomerId: loginCustomerId || null };
      return publicConnection;
    },
    disconnect() { if (!publicConnection) return false; publicConnection = { ...publicConnection, status: "DISCONNECTED" }; return true; },
    inspectState: () => state,
    inspectRow: () => row,
  };
}

test("Google Ads OAuth uses PKCE, encrypted refresh tokens, and explicit account selection", async () => {
  const repository = fakeRepository();
  const requests = [];
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if (String(url).includes("oauth2.googleapis.com/token")) {
      return new Response(JSON.stringify({ access_token: "access-token", refresh_token: "super-secret-refresh", expires_in: 3600 }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (String(url).includes("customers:listAccessibleCustomers")) {
      return new Response(JSON.stringify({ resourceNames: ["customers/123-456-7890", "customers/9998887776"] }), { status: 200, headers: { "Content-Type": "application/json", "request-id": "req-1" } });
    }
    throw new Error(`Unexpected URL ${url}`);
  };

  const service = createGoogleAdsOauthService({
    repository,
    fetchImpl,
    clientId: "client-id",
    clientSecret: "client-secret",
    redirectUri: "https://loadder.example/api/google-ads/oauth/callback",
    developerToken: "developer-token",
    encryptionSecret: "this-is-a-long-test-secret-key-for-google-ads",
    apiVersion: "v25",
    now: () => new Date("2026-08-29T10:00:00.000Z"),
  });

  assert.equal(service.configured(), true);
  const started = service.start("user-1");
  const authorization = new URL(started.authorizationUrl);
  assert.equal(authorization.origin, "https://accounts.google.com");
  assert.equal(authorization.searchParams.get("scope"), "https://www.googleapis.com/auth/adwords");
  assert.equal(authorization.searchParams.get("access_type"), "offline");
  assert.equal(authorization.searchParams.get("code_challenge_method"), "S256");
  assert.ok(authorization.searchParams.get("code_challenge"));
  const state = authorization.searchParams.get("state");
  assert.ok(state);
  assert.notEqual(repository.inspectState().verifierCiphertext.includes("super-secret-refresh"), true);

  const completed = await service.callback({ state, code: "authorization-code" }, "user-1");
  assert.deepEqual(completed.accessibleCustomers, ["1234567890", "9998887776"]);
  assert.equal(repository.inspectRow().refresh_token_ciphertext.includes("super-secret-refresh"), false);
  assert.equal(requests[1].options.headers["developer-token"], "developer-token");
  assert.equal(requests[1].options.headers.Authorization, "Bearer access-token");
  await assert.rejects(() => service.callback({ state, code: "replay" }, "user-1"), (error) => error.code === "GOOGLE_ADS_OAUTH_STATE_INVALID");

  assert.deepEqual(service.accounts(), ["1234567890", "9998887776"]);
  const selected = service.selectAccount({ customerId: "123-456-7890" });
  assert.equal(selected.status, "READY");
  assert.equal(selected.selectedCustomerId, "1234567890");
  assert.throws(() => service.selectAccount({ customerId: "1112223334" }), (error) => error.code === "GOOGLE_ADS_CUSTOMER_NOT_ACCESSIBLE");
  assert.equal(service.decryptRefreshTokenForAdapter(), "super-secret-refresh");
  assert.equal(service.disconnect(), true);
});
