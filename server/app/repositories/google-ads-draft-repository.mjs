import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";

const parse = (value, fallback) => { try { return JSON.parse(value); } catch { return fallback; } };
const map = (row) => row ? ({
  id: row.id,
  connectionId: row.connection_id,
  customerId: row.customer_id,
  name: row.name,
  status: row.status,
  payload: parse(row.payload_json, {}),
  validation: parse(row.validation_json, []),
  googleResource: parse(row.google_resource_json, {}),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
}) : null;

export function createGoogleAdsDraftRepository(db) {
  const workspaceId = () => requireWorkspaceId();
  const get = (id) => map(db.prepare("SELECT * FROM google_ads_campaign_drafts WHERE id=? AND workspace_id=?").get(id, workspaceId()));
  const list = () => db.prepare("SELECT * FROM google_ads_campaign_drafts WHERE workspace_id=? ORDER BY updated_at DESC LIMIT 100").all(workspaceId()).map(map);
  function create({ name, payload, validation, googleResource, status, connectionId = null, customerId = null, at }) {
    const id = crypto.randomUUID();
    db.prepare(`INSERT INTO google_ads_campaign_drafts(id,workspace_id,connection_id,customer_id,name,status,payload_json,validation_json,google_resource_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, workspaceId(), connectionId, customerId, name, status, JSON.stringify(payload), JSON.stringify(validation), JSON.stringify(googleResource), at, at);
    return get(id);
  }
  function update(id, { name, payload, validation, googleResource, status, connectionId = null, customerId = null, at }) {
    const result = db.prepare(`UPDATE google_ads_campaign_drafts SET connection_id=?,customer_id=?,name=?,status=?,payload_json=?,validation_json=?,google_resource_json=?,updated_at=? WHERE id=? AND workspace_id=?`)
      .run(connectionId, customerId, name, status, JSON.stringify(payload), JSON.stringify(validation), JSON.stringify(googleResource), at, id, workspaceId());
    return result.changes ? get(id) : null;
  }
  function remove(id) {
    return db.prepare("DELETE FROM google_ads_campaign_drafts WHERE id=? AND workspace_id=?").run(id, workspaceId()).changes > 0;
  }
  return Object.freeze({ get, list, create, update, remove });
}
