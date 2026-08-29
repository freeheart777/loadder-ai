export const migration048GoogleAdsOauthConnections = {
  version: 48,
  name: "google_ads_oauth_connections",
  up(db) {
    db.exec(`
CREATE TABLE IF NOT EXISTS google_ads_oauth_states(
  state_hash TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  verifier_ciphertext TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_google_ads_oauth_states_expiry ON google_ads_oauth_states(expires_at);

CREATE TABLE IF NOT EXISTS google_ads_connections(
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL UNIQUE,
  refresh_token_ciphertext TEXT NOT NULL,
  selected_customer_id TEXT,
  login_customer_id TEXT,
  accessible_customers_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL CHECK(status IN('CONNECTED','ACCOUNT_SELECTION_REQUIRED','READY','ERROR','DISCONNECTED')),
  last_error_code TEXT,
  connected_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
  CHECK(json_valid(accessible_customers_json))
);
CREATE INDEX IF NOT EXISTS idx_google_ads_connections_workspace ON google_ads_connections(workspace_id,status);
`);
  }
};
