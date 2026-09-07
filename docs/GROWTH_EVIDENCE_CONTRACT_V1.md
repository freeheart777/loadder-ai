# Growth evidence contract v1

Internal repository contract only; no public API, orchestration, provider or UI.
Migration 080 adds one append-only link table. Existing events and domain stores
remain authoritative and unchanged. Do not roll back by deleting evidence: disable
the consumer and retain the additive table.

Goal identity is `(contextVersionId, /strategy/goals/N)`, with goal version equal
to that immutable active/archived context ID. It does not claim a stable goal ID
across context versions. Draft contexts fail closed. Old contexts with no goal
remain readable by their existing owners but cannot supply a fabricated goal.

The initial relation is HAS_EVIDENCE. Subjects are existing CAMPAIGN or EXPERIMENT
records (the latter retains treatment_definition); objects are EVENT, ORDER or
FINANCIAL_ENTRY. This is an evidence association, **not proof of causation**.
Unknown types and extra fields fail closed. Future types require explicit resolvers.

The repository derives workspace from tenant context and validates references in
an immediate transaction. It never trusts caller authority, hashes or timestamps.
Same tenant/producer/key + normalized payload converges; conflicting payloads fail.
Corrections append a same-subject/goal/kind successor, with one direct successor.
Original evidence is never overwritten. Read by ID is tenant-scoped.

No object means UNKNOWN, including financial kinds. A missing referenced ID is an
error, not silently converted to UNKNOWN. Event evidence remains REPORTED: even
a lead.converted event is not independently verified CRM state. PAYMENT and
VERIFIED_REVENUE require a canonical PAYMENT_CAPTURED ledger entry matching its
order, amount, currency, project and recorded payment reference/status. This means
canonical recorded gross capture, **not** live provider validation, net revenue,
profit or incremental lift. Manual-payment records are not promoted to live-
provider proof. Refund evidence remains in its canonical domain. Attribution and
causal lift remain reported claims; no attribution/causality engine is introduced.

Producer/source and correlation/causation strings describe provenance, not trust.
All calls are internal; future routes must add actor authorization. Production
commerce and business-event idempotency behavior are unchanged.

## Lean review

One bounded insert, constant-number indexed owner lookups, no N+1 lists, provider
calls, polling, workers or dependencies. At 50/500/5000 users cost follows link
write rate rather than user count; SQLite writer contention must be measured
before adding processing infrastructure. Queries by subject/object/goal are indexed.
No performance capacity claim is made without load measurements.

## Backlog

P2: business-event ingest returns an existing idempotency match before comparing
payloads. Inspect compatibility in a separate PR; this repository uses its own
hash comparison and does not depend on that behavior. Required evidence: changed
payload conflicts without breaking valid existing event replays. No dependency
change expected; S/NEXT.
