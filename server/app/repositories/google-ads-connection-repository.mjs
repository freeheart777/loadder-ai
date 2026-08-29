import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";

const parse = (value, fallback) => {
  try { return JSON.parse(value); } catch { return fallback; }
};

const connection = (row) => row ? {
  id: row.id,
  workspaceId: row.workspace_id,
  selectedCustomerId: row.selected_customer_id,
  loginCustomerId: row.login_customer_id,
  accessibleCustomers: parse(row.accessible_customers_json, []),
  status: row.status,
  lastErrorCode: row.last_error_code,
  connectedAt: row.connected_at,
  updatedAt: row.updated_at,
} : null;

export function createGoogleAdsConnectionRepository(db) {
  const wid = () => requireWorkspaceId();

  function saveState({ stateHash, userId, verifierCiphertext, expiresAt, at }) {
    db.prepare("DELETE FROM google_ads_oauth_states WHERE expires_at < ?").run(at);
    db.prepare(`INSERT INTO google_ads_oauth_states(state_hash,workspace_id,user_id,verifier_ciphertext,expires_at,created_at)
      VALUES(?,?,?,?,?,?)`).run(stateHash, wid(), userId, verifierCiphertext, expiresAt, at);
  }

  function consumeState(stateHash, userId, at) {
    const workspaceId = wid();
    const row = db.prepare(`SELECT * FROM google_ads_oauth_states
      WHERE state_hash=? AND workspace_id=? AND user_id=? AND expires_at>=?`).get(stateHash, workspaceId, userId, at);
    if (!row) return null;
    db.prepare("DELETE FROM google_ads_oauth_states WHERE state_hash=?").run(stateHash);
    return { verifierCiphertext: row.verifier_ciphertext, expiresAt: row.expires_at };
  }

  function upsertConnection({ refreshTokenCiphertext, accessibleCustomers, at }) {
    const workspaceId = wid();
    const existing = db.prepare("SELECT id FROM google_ads_connections WHERE workspace_id=?").get(workspaceId);
    const id = existing?.id || crypto.randomUUID();
    db.prepare(`INSERT INTO google_ads_connections(id,workspace_id,refresh_token_ciphertext,selected_customer_id,login_customer_id,accessible_customers_json,status,last_error_code,connected_at,updated_at)
      VALUES(?,?,?,NULL,NULL,?,'ACCOUNT_SELECTION_REQUIRED',NULL,?,?)
      ON CONFLICT(workspace_id) DO UPDATE SET
        refresh_token_ciphertext=excluded.refresh_token_ciphertext,
        selected_customer_id=NULL,
        login_customer_id=NULL,
        accessible_customers_json=excluded.accessible_customers_json,
        status='ACCOUNT_SELECTION_REQUIRED',
        last_error_code=NULL,
        updated_at=excluded.updated_at`).run(id, workspaceId, refreshTokenCiphertext, JSON.stringify(accessibleCustomers), at, at);
    return getConnection();
  }

  function getConnectionRow() {
    return db.prepare("SELECT * FROM google_ads_connections WHERE workspace_id=?").get(wid()) || null;
  }

  function getConnection() {
    return connection(getConnectionRow());
  }

  function selectAccount({ customerId, loginCustomerId, at }) {
    db.prepare(`UPDATE google_ads_connections SET selected_customer_id=?,login_customer_id=?,status='READY',last_error_code=NULL,updated_at=? WHERE workspace_id=?`)
      .run(customerId, loginCustomerId || null, at, wid());
    return getConnection();
  }

  function disconnect(at) {
    const result = db.prepare(`UPDATE google_ads_connections SET selected_customer_id=NULL,login_customer_id=NULL,status='DISCONNECTED',updated_at=? WHERE workspace_id=?`).run(at, wid());
    return result.changes > 0;
  }

  return Object.freeze({ saveState, consumeState, upsertConnection, getConnectionRow, getConnection, selectAccount, disconnect });
}
