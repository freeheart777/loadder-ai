import { createHash } from "node:crypto";

export class GrowthEvidenceError extends Error {
  constructor(code, status = 400) { super(code); this.code = code; this.status = status; }
}
const fail = () => { throw new GrowthEvidenceError("GROWTH_CONTRACT_INVALID"); };
const text = (v, max = 200) => typeof v === "string" && v.trim() && v.length <= max ? v.trim() : fail();
const optional = v => v === undefined || v === null ? null : text(v);
const fields = (v, allowed) => {
  if (!v || typeof v !== "object" || Array.isArray(v) || Object.keys(v).some(k => !allowed.includes(k))) fail();
};
const reference = (v, types) => {
  fields(v, ["type", "id"]);
  if (!types.includes(v.type)) fail();
  return { type: v.type, id: text(v.id) };
};
export function normalizeEvidenceLink(input) {
  fields(input, ["contractVersion", "contextVersionId", "goal", "subject", "relation", "object", "evidenceKind", "producer", "source", "sourceEventId", "correlationId", "causationId", "idempotencyKey", "supersedesId"]);
  if (input.contractVersion !== 1 || input.relation !== "HAS_EVIDENCE") fail();
  fields(input.goal, ["reference", "version"]);
  const contextVersionId = text(input.contextVersionId);
  if (input.goal.version !== contextVersionId || !/^\/strategy\/goals\/(0|[1-9]\d{0,3})$/.test(input.goal.reference)) fail();
  if (!["REPORTED_CONVERSION", "CRM_CONVERSION", "ORDER", "PAYMENT", "VERIFIED_REVENUE", "ATTRIBUTED_REVENUE", "CAUSAL_LIFT"].includes(input.evidenceKind)) fail();
  return {
    contractVersion: 1, contextVersionId,
    goal: { reference: input.goal.reference, version: contextVersionId },
    subject: reference(input.subject, ["CAMPAIGN", "EXPERIMENT", "CONTENT_CANDIDATE"]), relation: "HAS_EVIDENCE",
    object: input.object == null ? null : reference(input.object, ["EVENT", "ORDER", "FINANCIAL_ENTRY"]),
    evidenceKind: input.evidenceKind, producer: text(input.producer, 100), source: text(input.source),
    sourceEventId: optional(input.sourceEventId), correlationId: optional(input.correlationId), causationId: optional(input.causationId),
    idempotencyKey: text(input.idempotencyKey), supersedesId: optional(input.supersedesId),
  };
}
// normalizeEvidenceLink supplies stable key order; generated identity/time are excluded.
export const evidencePayloadHash = normalized => createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
