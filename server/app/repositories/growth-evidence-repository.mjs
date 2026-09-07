import { randomUUID } from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";
import { GrowthEvidenceError, normalizeEvidenceLink, evidencePayloadHash } from "../growth/evidence-contract.mjs";

// Closed resolver map: no caller-provided table, SQL, resolver or authority.
const tables = Object.freeze({ CAMPAIGN: "marketing_campaigns", EXPERIMENT: "experiments", EVENT: "business_events", ORDER: "ecommerce_orders", FINANCIAL_ENTRY: "ecommerce_financial_ledger", CONTENT_CANDIDATE: "growth_content_candidates" });
const reject = code => { throw new GrowthEvidenceError(code); };
export function createGrowthEvidenceRepository(db, { now = () => new Date() } = {}) {
  const resolve = (type, id, ws) => {
    if (!Object.hasOwn(tables, type)) reject("GROWTH_REFERENCE_TYPE_INVALID");
    const row = db.prepare(`SELECT * FROM ${tables[type]} WHERE id=? AND workspace_id=?`).get(id, ws);
    if (!row) reject("GROWTH_REFERENCE_NOT_FOUND");
    return row;
  };
  const get = id => db.prepare("SELECT * FROM growth_evidence_links WHERE id=? AND workspace_id=?").get(id, requireWorkspaceId()) || null;
  const create = db.transaction(input => {
    const ws = requireWorkspaceId();
    const n = normalizeEvidenceLink(input), hash = evidencePayloadHash(n);
    const existing = db.prepare("SELECT * FROM growth_evidence_links WHERE workspace_id=? AND producer=? AND idempotency_key=?").get(ws, n.producer, n.idempotencyKey);
    if (existing) {
      if (existing.payload_hash !== hash) throw new GrowthEvidenceError("GROWTH_IDEMPOTENCY_CONFLICT", 409);
      return { link: existing, duplicate: true };
    }
    const context = db.prepare("SELECT snapshot_json,status FROM business_context_versions WHERE id=? AND workspace_id=?").get(n.contextVersionId, ws);
    if (!context || !["active", "archived"].includes(context.status)) reject("GROWTH_CONTEXT_NOT_FOUND");
    let snapshot;
    try { snapshot = JSON.parse(context.snapshot_json); } catch { reject("GROWTH_CONTEXT_INVALID"); }
    const goals = snapshot?.strategy?.goals;
    const index = Number(n.goal.reference.split("/").at(-1));
    if (!Array.isArray(goals) || index >= goals.length || goals[index] == null) reject("GROWTH_GOAL_NOT_FOUND");
    const subject = resolve(n.subject.type, n.subject.id, ws);
    if (n.subject.type === "EXPERIMENT" && subject.context_version_id !== n.contextVersionId) reject("GROWTH_CONTEXT_MISMATCH");
    if (n.subject.type === "CONTENT_CANDIDATE") {
      const brief=db.prepare('SELECT b.id FROM growth_content_briefs b JOIN experiments e ON e.id=b.experiment_id AND e.workspace_id=b.workspace_id WHERE b.id=? AND b.workspace_id=? AND b.goal_context_version_id=? AND b.goal_ref=? AND e.goal_context_version_id=b.goal_context_version_id AND e.goal_ref=b.goal_ref').get(subject.brief_id,ws,n.contextVersionId,n.goal.reference);
      if(subject.state!=='APPROVED'||!brief)reject('GROWTH_APPROVED_TREATMENT_REQUIRED');
    }
    if (n.sourceEventId) resolve("EVENT", n.sourceEventId, ws);
    let authority = "UNKNOWN";
    if (n.object) {
      const object = resolve(n.object.type, n.object.id, ws);
      if (["PAYMENT", "VERIFIED_REVENUE"].includes(n.evidenceKind)) {
        if (n.object.type !== "FINANCIAL_ENTRY" || object.entry_type !== "PAYMENT_CAPTURED" || object.source_type !== "ORDER_PAYMENT") reject("GROWTH_FINANCIAL_EVIDENCE_REQUIRED");
        const order = resolve("ORDER", object.order_id, ws);
        if (object.source_id !== order.id || object.site_project_id !== order.site_project_id || object.amount_minor !== order.total_minor || object.currency !== order.currency || !order.payment_reference || !["PAID", "REFUNDED"].includes(order.payment_status)) reject("GROWTH_FINANCIAL_EVIDENCE_REQUIRED");
        authority = "CANONICAL_RECORD";
      } else if (n.evidenceKind === "ORDER") {
        if (n.object.type !== "ORDER") reject("GROWTH_EVIDENCE_KIND_MISMATCH");
        authority = "CANONICAL_RECORD";
      } else {
        // Events prove that a claim was recorded, not payment, causality or CRM state.
        if (n.object.type !== "EVENT") reject("GROWTH_EVIDENCE_KIND_MISMATCH");
        if (n.evidenceKind === "CRM_CONVERSION" && object.event_type !== "lead.converted") reject("GROWTH_EVIDENCE_KIND_MISMATCH");
        authority = "REPORTED";
      }
    }
    const recordedAt = now().toISOString();
    if (n.supersedesId) {
      const previous = get(n.supersedesId);
      if (!previous || previous.context_version_id !== n.contextVersionId || previous.goal_reference !== n.goal.reference || previous.subject_type !== n.subject.type || previous.subject_id !== n.subject.id || previous.evidence_kind !== n.evidenceKind || previous.recorded_at > recordedAt) reject("GROWTH_PREDECESSOR_MISMATCH");
      if (db.prepare("SELECT id FROM growth_evidence_links WHERE supersedes_id=?").get(n.supersedesId)) throw new GrowthEvidenceError("GROWTH_SUCCESSOR_CONFLICT", 409);
    }
    const id = randomUUID();
    db.prepare(`INSERT INTO growth_evidence_links(id,workspace_id,contract_version,context_version_id,goal_reference,goal_version,subject_type,subject_id,relation,object_type,object_id,evidence_kind,authority_class,producer,source,source_event_id,correlation_id,causation_id,idempotency_key,payload_hash,supersedes_id,recorded_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,ws,1,n.contextVersionId,n.goal.reference,n.goal.version,n.subject.type,n.subject.id,n.relation,n.object?.type ?? null,n.object?.id ?? null,n.evidenceKind,authority,n.producer,n.source,n.sourceEventId,n.correlationId,n.causationId,n.idempotencyKey,hash,n.supersedesId,recordedAt);
    return { link: get(id), duplicate: false };
  });
  return Object.freeze({ create: input => create.immediate(input), get });
}
