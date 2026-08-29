import crypto from "node:crypto";

const ADS_SCOPE = "https://www.googleapis.com/auth/adwords";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const ADS_API_BASE = "https://googleads.googleapis.com";

export class GoogleAdsOauthError extends Error {
  constructor(message, status = 400, code = "GOOGLE_ADS_OAUTH_ERROR", details = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const base64url = (buffer) => Buffer.from(buffer).toString("base64url");
const hash = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");
const challenge = (value) => base64url(crypto.createHash("sha256").update(value).digest());
const cleanCustomerId = (value) => String(value || "").replace(/\D/g, "");

function encryptionKey(secret) {
  if (!secret || String(secret).length < 32) throw new GoogleAdsOauthError("Google Ads token encryption is not configured.", 503, "GOOGLE_ADS_ENCRYPTION_NOT_CONFIGURED");
  return crypto.createHash("sha256").update(String(secret)).digest();
}

function encrypt(value, secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${base64url(iv)}.${base64url(tag)}.${base64url(ciphertext)}`;
}

function decrypt(value, secret) {
  const [version, ivRaw, tagRaw, dataRaw] = String(value || "").split(".");
  if (version !== "v1" || !ivRaw || !tagRaw || !dataRaw) throw new GoogleAdsOauthError("Stored Google Ads credential is invalid.", 500, "GOOGLE_ADS_CREDENTIAL_INVALID");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(secret), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataRaw, "base64url")), decipher.final()]).toString("utf8");
}

export function createGoogleAdsOauthService({
  repository,
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
  clientId = process.env.GOOGLE_ADS_OAUTH_CLIENT_ID,
  clientSecret = process.env.GOOGLE_ADS_OAUTH_CLIENT_SECRET,
  redirectUri = process.env.GOOGLE_ADS_OAUTH_REDIRECT_URI,
  developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
  encryptionSecret = process.env.GOOGLE_ADS_TOKEN_ENCRYPTION_KEY,
  apiVersion = process.env.GOOGLE_ADS_API_VERSION || "v25",
} = {}) {
  if (!repository) throw new TypeError("repository is required.");
  if (typeof fetchImpl !== "function") throw new TypeError("fetchImpl is required.");

  const configured = () => Boolean(clientId && clientSecret && redirectUri && developerToken && encryptionSecret);
  const requireConfigured = () => {
    if (!configured()) throw new GoogleAdsOauthError("Google Ads OAuth is not configured.", 503, "GOOGLE_ADS_OAUTH_NOT_CONFIGURED");
  };

  async function exchangeCode(code, verifier) {
    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: verifier,
    });
    const response = await fetchImpl(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.access_token) throw new GoogleAdsOauthError("Google OAuth token exchange failed.", 502, "GOOGLE_ADS_TOKEN_EXCHANGE_FAILED", { providerError: payload.error || null });
    if (!payload.refresh_token) throw new GoogleAdsOauthError("Google did not return an offline refresh token. Reconnect and grant consent again.", 409, "GOOGLE_ADS_REFRESH_TOKEN_MISSING");
    return payload;
  }

  async function listAccessibleCustomers(accessToken) {
    const response = await fetchImpl(`${ADS_API_BASE}/${apiVersion}/customers:listAccessibleCustomers`, {
      headers: { Authorization: `Bearer ${accessToken}`, "developer-token": developerToken },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new GoogleAdsOauthError("Unable to list Google Ads accounts.", 502, "GOOGLE_ADS_ACCOUNTS_LOOKUP_FAILED", { requestId: response.headers?.get?.("request-id") || null });
    return (payload.resourceNames || []).map((name) => cleanCustomerId(String(name).split("/").pop())).filter(Boolean);
  }

  return Object.freeze({
    configured,
    status() {
      const connection = repository.getConnection();
      return { configured: configured(), connected: Boolean(connection && connection.status !== "DISCONNECTED"), connection };
    },
    start(userId) {
      requireConfigured();
      const state = base64url(crypto.randomBytes(32));
      const verifier = base64url(crypto.randomBytes(48));
      const at = now();
      repository.saveState({
        stateHash: hash(state),
        userId,
        verifierCiphertext: encrypt(verifier, encryptionSecret),
        expiresAt: new Date(at.getTime() + 10 * 60 * 1000).toISOString(),
        at: at.toISOString(),
      });
      const url = new URL(AUTH_URL);
      url.search = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: ADS_SCOPE,
        access_type: "offline",
        prompt: "consent",
        state,
        code_challenge: challenge(verifier),
        code_challenge_method: "S256",
      }).toString();
      return { authorizationUrl: url.toString(), expiresInSeconds: 600 };
    },
    async callback({ state, code }, userId) {
      requireConfigured();
      if (!state || !code) throw new GoogleAdsOauthError("OAuth callback is incomplete.", 400, "GOOGLE_ADS_OAUTH_CALLBACK_INVALID");
      const at = now();
      const saved = repository.consumeState(hash(state), userId, at.toISOString());
      if (!saved) throw new GoogleAdsOauthError("OAuth state is invalid or expired.", 400, "GOOGLE_ADS_OAUTH_STATE_INVALID");
      const verifier = decrypt(saved.verifierCiphertext, encryptionSecret);
      const tokens = await exchangeCode(code, verifier);
      const accessibleCustomers = await listAccessibleCustomers(tokens.access_token);
      const connection = repository.upsertConnection({
        refreshTokenCiphertext: encrypt(tokens.refresh_token, encryptionSecret),
        accessibleCustomers,
        at: at.toISOString(),
      });
      return { connection, accessibleCustomers };
    },
    accounts() {
      const connection = repository.getConnection();
      if (!connection || connection.status === "DISCONNECTED") throw new GoogleAdsOauthError("Google Ads is not connected.", 409, "GOOGLE_ADS_NOT_CONNECTED");
      return connection.accessibleCustomers;
    },
    selectAccount({ customerId, loginCustomerId }) {
      const connection = repository.getConnection();
      if (!connection || connection.status === "DISCONNECTED") throw new GoogleAdsOauthError("Google Ads is not connected.", 409, "GOOGLE_ADS_NOT_CONNECTED");
      const customer = cleanCustomerId(customerId);
      const login = loginCustomerId ? cleanCustomerId(loginCustomerId) : null;
      if (!customer || !connection.accessibleCustomers.includes(customer)) throw new GoogleAdsOauthError("Selected Google Ads account is not directly accessible to this connection.", 400, "GOOGLE_ADS_CUSTOMER_NOT_ACCESSIBLE");
      if (login && !connection.accessibleCustomers.includes(login)) throw new GoogleAdsOauthError("Login customer is not directly accessible to this connection.", 400, "GOOGLE_ADS_LOGIN_CUSTOMER_NOT_ACCESSIBLE");
      return repository.selectAccount({ customerId: customer, loginCustomerId: login, at: now().toISOString() });
    },
    disconnect() {
      return repository.disconnect(now().toISOString());
    },
    decryptRefreshTokenForAdapter() {
      const row = repository.getConnectionRow();
      if (!row || row.status === "DISCONNECTED") throw new GoogleAdsOauthError("Google Ads is not connected.", 409, "GOOGLE_ADS_NOT_CONNECTED");
      return decrypt(row.refresh_token_ciphertext, encryptionSecret);
    },
  });
}
