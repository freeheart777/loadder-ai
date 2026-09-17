import { documentHash } from "./site-document-revision-service.mjs";
import { LIMITS, classify, targetKind, targetSelector, validateValue } from "./v16-patch-policy.mjs";

// The deterministic mutation engine. It is pure: given a document and a patch
// it returns per-operation outcomes and a proposed document, and never touches
// the database, the network or the clock. Preview and apply share this code, so
// what a user previews is exactly what applies.

export const OP = Object.freeze(["SET", "UNSET", "INSERT", "REMOVE", "MOVE", "REORDER"]);

export const OUTCOME = Object.freeze({
  ACCEPTED: "ACCEPTED",
  REJECTED_INVALID_TARGET: "REJECTED_INVALID_TARGET",
  REJECTED_INVALID_PATH: "REJECTED_INVALID_PATH",
  REJECTED_INVALID_VALUE: "REJECTED_INVALID_VALUE",
  REJECTED_PROTECTED_PROPERTY: "REJECTED_PROTECTED_PROPERTY",
  REJECTED_SCHEMA: "REJECTED_SCHEMA",
  REJECTED_PERMISSION: "REJECTED_PERMISSION",
  CONFLICT_REVISION: "CONFLICT_REVISION",
});

const clone = (value) => JSON.parse(JSON.stringify(value ?? {}));
const v16 = (document) => (document && typeof document.storeBuilderV16 === "object" ? document.storeBuilderV16 : null);

/** Every section-bearing container in the document, with a stable address. */
function containers(builder) {
  const list = [];
  if (Array.isArray(builder.pages) && builder.pages.length) {
    builder.pages.forEach((page, index) => list.push({ kind: "page", index, slug: index === 0 ? "" : String(page?.slug ?? ""), node: page }));
  }
  // A legacy single-page document keeps its top-level sections as the container.
  if (!list.length) list.push({ kind: "root", index: 0, slug: "", node: builder });
  return list;
}

/** A section is addressable only by a non-empty string id. */
const sectionId = (section) => (typeof section?.id === "string" && section.id.trim() ? section.id : null);

/** Every section carrying this id, across every container. */
function sectionMatches(builder, id) {
  const hits = [];
  if (typeof id !== "string" || !id.trim()) return hits;
  for (const entry of containers(builder)) {
    (entry.node.sections || []).forEach((section, index) => {
      if (sectionId(section) === id) hits.push({ entry, index });
    });
  }
  return hits;
}

/**
 * The container holding a section, for REMOVE/MOVE/SET/UNSET.
 *
 * This fails CLOSED: a target resolves only when exactly one section carries
 * that id. A legacy document may hold duplicate or id-less sections — those
 * targets are unresolved rather than silently first-match, so a patch can never
 * mutate a different section than the one it named. Nothing is rewritten to
 * make such a document addressable.
 */
function sectionHome(builder, id) {
  const hits = sectionMatches(builder, id);
  return hits.length === 1 ? hits[0] : null;
}

/** Section ids for a REORDER: null when any is missing or duplicated. */
function orderableIds(list) {
  const ids = list.map(sectionId);
  if (ids.some((id) => id === null)) return null;
  return new Set(ids).size === ids.length ? ids : null;
}

/** Resolve a semantic target to the object a path applies to. */
export function resolveTarget(builder, target) {
  const kind = targetKind(target);
  if (!kind) return null;
  if (kind === "page") {
    const slug = targetSelector(target);
    return containers(builder).find((entry) => entry.slug === slug)?.node || null;
  }
  if (kind === "section") {
    const home = sectionHome(builder, targetSelector(target));
    return home ? home.entry.node.sections[home.index] : null;
  }
  return builder[kind] && typeof builder[kind] === "object" ? builder[kind] : null;
}

const readPath = (node, segments) => segments.slice(0, -1).reduce((acc, key) => (acc && typeof acc === "object" ? acc[key] : undefined), node);

function applyOne(builder, operation) {
  const { type, target, path, value, index, order, toTarget } = operation;

  if (type === "SET" || type === "UNSET") {
    const node = resolveTarget(builder, target);
    const segments = classify(target, path).segments;
    const parent = segments.length === 1 ? node : readPath(node, segments);
    if (!parent || typeof parent !== "object") return false;
    const key = segments[segments.length - 1];
    if (type === "SET") parent[key] = clone({ v: value }).v;
    else delete parent[key];
    return true;
  }

  if (type === "INSERT") {
    const node = resolveTarget(builder, target);
    if (!node) return false;
    const list = Array.isArray(node.sections) ? node.sections : (node.sections = []);
    if (list.length >= LIMITS.maxCollection) return false;
    const at = Number.isInteger(index) ? Math.max(0, Math.min(index, list.length)) : list.length;
    list.splice(at, 0, clone({ v: value }).v);
    return true;
  }

  if (type === "REMOVE") {
    const home = sectionHome(builder, targetSelector(target));
    if (!home) return false;
    home.entry.node.sections.splice(home.index, 1);
    return true;
  }

  if (type === "MOVE") {
    const home = sectionHome(builder, targetSelector(target));
    if (!home) return false;
    const [moved] = home.entry.node.sections.splice(home.index, 1);
    const destination = toTarget ? resolveTarget(builder, toTarget) : home.entry.node;
    if (!destination) { home.entry.node.sections.splice(home.index, 0, moved); return false; }
    const list = Array.isArray(destination.sections) ? destination.sections : (destination.sections = []);
    list.splice(Number.isInteger(index) ? Math.max(0, Math.min(index, list.length)) : list.length, 0, moved);
    return true;
  }

  if (type === "REORDER") {
    const node = resolveTarget(builder, target);
    const list = node && Array.isArray(node.sections) ? node.sections : null;
    if (!list) return false;
    const ids = orderableIds(list);
    if (!ids) return false;
    const byId = new Map(list.map((section, index) => [ids[index], section]));
    // A reorder is a permutation of exactly the ids already present.
    if (order.length !== list.length || !order.every((id) => byId.has(String(id)))) return false;
    node.sections = order.map((id) => byId.get(String(id)));
    return true;
  }

  return false;
}

/** Static validation of one operation against the document and the policy. */
function validateOne(builder, operation) {
  if (!operation || typeof operation !== "object") return { outcome: OUTCOME.REJECTED_SCHEMA };
  const { type, target, path, value, order, toTarget } = operation;
  if (!OP.includes(type)) return { outcome: OUTCOME.REJECTED_SCHEMA };

  if (type === "SET" || type === "UNSET") {
    const verdict = classify(target, path);
    if (verdict.reason) return { outcome: OUTCOME[verdict.reason] };
    if (!resolveTarget(builder, target)) return { outcome: OUTCOME.REJECTED_INVALID_TARGET };
    if (type === "SET" && !validateValue(value)) return { outcome: OUTCOME.REJECTED_INVALID_VALUE };
    return { outcome: OUTCOME.ACCEPTED, klass: verdict.klass };
  }

  if (type === "INSERT") {
    const verdict = classify(target, "sections");
    if (verdict.reason) return { outcome: OUTCOME[verdict.reason] };
    if (!resolveTarget(builder, target)) return { outcome: OUTCOME.REJECTED_INVALID_TARGET };
    if (!value || typeof value !== "object" || Array.isArray(value) || !sectionId(value) || typeof value.type !== "string" || !value.type.trim()) {
      return { outcome: OUTCOME.REJECTED_SCHEMA };
    }
    if (!validateValue(value)) return { outcome: OUTCOME.REJECTED_INVALID_VALUE };
    // Collision is checked against EVERY match, not the resolvable one, so a
    // document that already holds duplicates cannot gain another.
    if (sectionMatches(builder, value.id).length) return { outcome: OUTCOME.REJECTED_SCHEMA };
    return { outcome: OUTCOME.ACCEPTED, klass: verdict.klass };
  }

  if (type === "REMOVE" || type === "MOVE") {
    if (targetKind(target) !== "section") return { outcome: OUTCOME.REJECTED_INVALID_TARGET };
    if (!sectionHome(builder, targetSelector(target))) return { outcome: OUTCOME.REJECTED_INVALID_TARGET };
    // A section may only move into a page container; omitting toTarget moves it
    // within the container it already lives in.
    if (type === "MOVE" && toTarget) {
      if (targetKind(toTarget) !== "page") return { outcome: OUTCOME.REJECTED_INVALID_TARGET };
      if (!resolveTarget(builder, toTarget)) return { outcome: OUTCOME.REJECTED_INVALID_TARGET };
    }
    return { outcome: OUTCOME.ACCEPTED, klass: "PRESENTATION" };
  }

  if (type === "REORDER") {
    const verdict = classify(target, "sections");
    if (verdict.reason) return { outcome: OUTCOME[verdict.reason] };
    const node = resolveTarget(builder, target);
    if (!node || !Array.isArray(node.sections)) return { outcome: OUTCOME.REJECTED_INVALID_TARGET };
    if (!Array.isArray(order) || order.length > LIMITS.maxCollection) return { outcome: OUTCOME.REJECTED_SCHEMA };
    const ordered = orderableIds(node.sections);
    if (!ordered) return { outcome: OUTCOME.REJECTED_INVALID_TARGET };
    const ids = new Set(ordered);
    if (order.length !== ids.size || !order.every((id) => ids.has(String(id)))) return { outcome: OUTCOME.REJECTED_SCHEMA };
    return { outcome: OUTCOME.ACCEPTED, klass: verdict.klass };
  }

  return { outcome: OUTCOME.REJECTED_SCHEMA };
}

/**
 * Validate a patch and compute the proposed document.
 *
 * Partial rejection is the point: an independent operation that is protected or
 * malformed is rejected on its own, and the remaining accepted operations still
 * produce a usable proposal. A rejected operation never reaches the output.
 */
export function evaluatePatch(document, operations) {
  const builder = v16(document);
  if (!builder) return { ok: false, results: [], proposed: document, proposedHash: documentHash(document), accepted: 0 };
  if (!Array.isArray(operations) || operations.length === 0 || operations.length > LIMITS.maxOperations) {
    return { ok: false, tooMany: Array.isArray(operations) && operations.length > LIMITS.maxOperations, results: [], proposed: document, proposedHash: documentHash(document), accepted: 0 };
  }

  const proposed = clone(document);
  const workingBuilder = v16(proposed);
  const results = [];

  operations.forEach((operation, index) => {
    // Each operation is validated against the document as it stands after the
    // previously accepted ones, so a sequence stays deterministic.
    const verdict = validateOne(workingBuilder, operation);
    if (verdict.outcome !== OUTCOME.ACCEPTED) {
      results.push({ index, outcome: verdict.outcome });
      return;
    }
    const applied = applyOne(workingBuilder, operation);
    results.push(applied
      ? { index, outcome: OUTCOME.ACCEPTED, propertyClass: verdict.klass }
      : { index, outcome: OUTCOME.REJECTED_SCHEMA });
  });

  const accepted = results.filter((result) => result.outcome === OUTCOME.ACCEPTED).length;
  return { ok: true, results, proposed, proposedHash: documentHash(proposed), accepted };
}

/** Stable identity of a patch body, for idempotent proposal convergence. */
export const patchHash = (operations) => documentHash({ operations });
