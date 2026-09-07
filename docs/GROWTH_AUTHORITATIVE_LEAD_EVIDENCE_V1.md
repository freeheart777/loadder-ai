# Authoritative CRM lead evidence v1

## Canonical owner and scope

The actual CRM owner is `db/workspace-database.mjs::convertLeadToCustomer`, delegating
to `db/database.mjs`. It creates a customer and updates the real lead relationship.
A client `lead.converted` event, or merely changing a pipeline stage, is not this
operation. Lead creation alone is not a conversion.

`POST /api/growth/leads/:id/convert` wraps that existing operation; it does not create
another CRM implementation. The legacy CRM route remains unchanged, including its
legacy automation behavior. This bridge does not dispatch automation or providers.

Request: `idempotencyKey`, optionally the complete tuple `candidateId`, `experimentId`,
`contextVersionId`, `goalRef`. Active owner/admin membership is checked server-side.
No customer overrides, tenant, authority or arbitrary event payload are accepted.

## Atomic flow

Approved candidate → immutable brief → pinned experiment/context/goal
→ canonical CRM conversion → registry-validated `lead.converted` business event
→ `CRM_CONVERSION` Growth Evidence with the candidate as typed subject.

All writes use the same SQLite connection inside one immediate transaction. Event
or evidence failure rolls back the customer, lead update and event. There is no
external call, worker, polling or partial-success claim. Return values contain only
bounded identifiers, not lead PII.

The event uses reserved source `loadder.crm.lead-conversion.v1`, one source/lead/key
identity, and a normalized request hash. Generic ingestion rejects the reserved
namespace before duplicate handling. Replays revalidate the actual lead/customer
relationship; same request converges, different request conflicts. Evidence cannot
remap this event to another candidate or upgrade it to payment/revenue.

Authority is deliberately conservative: the bridge proves the CRM domain transition
(`factAuthority: CRM_DOMAIN`), but the existing evidence `authority_class` remains
`REPORTED` under #214's unchanged schema. Consumers must not treat a producer label,
client metadata, CRM conversion, or reported customer ID as financial proof.
Treatment linkage is operator-declared provenance, not demonstrated attribution or
causal lift. No new authority enum or schema is introduced.

Missing treatment linkage returns `UNKNOWN` with the actual event but no evidence
link. Previously converted leads lacking a canonical bridge event return `UNKNOWN`
without fabricating a historical transition. No semantic backfill is performed.
Archived pinned context can still describe a real later outcome; no automatic goal
matching across context versions occurs.

## Lean footprint

One bounded request and constant-count indexed reads/writes; no N+1 or background
processing. Existing tenant/event idempotency/evidence indexes are reused. At
50/500/5,000 registered users, work scales with actual conversions, not user count.
Concurrent writes remain SQLite-serialized; measure contention and read latency
before changing infrastructure. No throughput or sub-300ms production claim is made.
Schema, migration and dependency deltas are zero. Tracked SQLite is untouched.

## Proof

Tests use the real workspace-scoped CRM operation in a disposable file, real business
event/evidence repositories and guards, HTTP composition, and a reopened connection.
They cover rollback, replay/conflict, tenant/role negatives, approval/pinning,
reserved-source spoofing, false source lookalikes, nonfinancial semantics, UNKNOWN,
legacy CRM compatibility, and durable reload.

## LOADDER_IMPROVEMENT_BACKLOG / TOP_5_LOADDER_GAPS

1. **P1 — Legacy conversion path has different completion semantics.**
   GAP: `server/index.mjs` emits a random legacy event and awaits `processEvent` after
   conversion; this is not atomic canonical evidence. Users on that route have no
   new Growth receipt. SOLUTION: NEXT, M; intentionally converge route composition
   while preserving attribution/automation responses. Likely CRM route/service tests;
   zero schema/dependencies expected. Prove legacy HTTP responses and failure/replay
   semantics before switching callers. Do not silently cut over in this PR.
2. **P2 — Generic business-event replay ignores conflicting payloads.**
   GAP: `business-event-service.mjs::ingest` returns duplicates before comparing
   content. This can hide changed reported input; the new bridge independently checks
   its normalized hash. SOLUTION: NEXT, S-M; normalize/compare existing event payloads
   in the canonical ingestion path, no second event store; likely no schema needed.
   Prove old producer compatibility and concurrent conflict behavior.
3. **P2 — Treatment provenance is not observed acquisition attribution.**
   GAP: this API accepts an operator-selected approved candidate; it proves conversion,
   not how the person arrived. Incorrect downstream interpretation risks false ROI.
   SOLUTION: LATER, M; connect independently observed distribution/touch evidence,
   without upgrading these facts. Contracts/ingestion tests required; schema review
   before any new persistence. No attribution engine in this PR.
4. **P2 — Unknown AI outcomes remain blocked.**
   GAP: Growth Content intentionally retains reconciliation-required outcomes, limiting
   recovery. SOLUTION: NEXT, M; provider-evidence-backed operator reconciliation in
   the existing candidate lifecycle, no blind regeneration. Schema impact must be
   reviewed against terminal guards; no service/dependency assumed. Prove restart,
   late completion and competing decisions.
5. **P2 — Existing dependency advisories remain.**
   GAP: configured audit passes its critical threshold but reports `fast-uri` high and
   `qs` moderate findings. SOLUTION: NEXT, S; focused dependency patch PR with supply
   chain and full regression checks, zero schema impact. Do not mix dependency changes
   into this evidence bridge.

Existing immutable context, experiment, candidate and evidence ownership is strong;
this implementation preserves it rather than adding replacement systems.
