import { requireWorkspaceId } from "../tenant-context.mjs";

export class LoadderPaymentIdempotencyStore {
  constructor(db, { provider, projectId = null } = {}) {
    if (!provider) throw new Error("provider is required");
    this.db = db;
    this.provider = provider;
    this.projectId = projectId;
  }

  async has(id) {
    return !!this.db.prepare("SELECT 1 FROM business_builder_payment_events WHERE workspace_id=? AND provider=? AND event_id=?")
      .get(requireWorkspaceId(), this.provider, id);
  }

  async claim(id, { reference = null, status = null } = {}) {
    const result = this.db.prepare("INSERT OR IGNORE INTO business_builder_payment_events(workspace_id,provider,event_id,project_id,reference,status,received_at) VALUES(?,?,?,?,?,?,?)")
      .run(requireWorkspaceId(), this.provider, id, this.projectId, reference, status, new Date().toISOString());
    return result.changes === 1;
  }

  async add(id, metadata = {}) {
    await this.claim(id, metadata);
    return true;
  }
}
