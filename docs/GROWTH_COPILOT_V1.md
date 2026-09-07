# Growth Copilot v1 — coordination receipts

One request-driven coordinator reads existing context, experiment, approved candidate
and CRM evidence ownership. It does not own those records. No LLM, external call,
domain mutation, adoption, recommendation ranking or autonomous loop runs here.

## Contract and API

`POST /api/growth/copilot/runs` accepts only `capability`, `experimentId`,
`contextVersionId`, `goalRef`, optional `candidateId`, and `idempotencyKey`.
Workspace/actor come from authenticated server context. Active owner/admin membership
is checked from the database on prepare, replay, get and list.

Allowlist:
- `READ_GROWTH_CONTEXT`: validated canonical context/goal/experiment references.
- `READ_APPROVED_TREATMENT`: validated candidate reference, no copied body.
- `READ_CRM_OUTCOME_EVIDENCE`: at most 25 recent candidate evidence references,
  verified against PR4's reserved event source and actual CRM relationship.
- `PREPARE_NEXT_EXPERIMENT_DRAFT`: reference-based authoring scaffold with required
  human-authored fields, not a generated hypothesis or adopted experiment. Existing
  experiment authoring/governance must independently validate any later adoption.

`GET /api/growth/copilot/runs/:id` reads historical receipts, not current truth.
`GET /api/growth/copilot/runs?limit=25&cursor=...` uses stable keyset pagination,
maximum 100 summaries; it does not load all result envelopes.

## Durability and safety

Migration 084 adds only `growth_copilot_runs`, one tenant-page index and three guards
(plus the workspace/idempotency uniqueness index). All receipts are final and
append-only. `SUCCEEDED` means a read completed; `PREPARED` means a scaffold was
prepared. Neither means growth success or execution permission. Failed validation
or persistence returns a safe error and rolls back; no FAILED success-like artifact
is inserted. `error_code` is therefore null for every persisted V1 receipt.

The normalized hash includes actor, contract version, capability and pinned refs.
Same-key/same-input replay converges; conflicting input rejects. Replay revalidates
current context and approved treatment before returning the historical receipt.
GET/list recheck current permission but retain historical readability. New evidence
does not rewrite an old receipt: a new idempotency key requests a new observation.

Validate → compute → insert runs in one synchronous immediate SQLite transaction.
Crash before commit leaves no receipt; restart never infers success. There is no
pending state, lease, resume worker or automatic retry. Disable the feature to roll
back deployment; retain the table and receipts, with no destructive down migration.

## Evidence and cost truth

The query inspects only 26 recent candidate links through the existing subject index,
then validates CRM provenance with joins. It returns at most 25 references, explicitly
marks truncation, ignores superseded/noncanonical links, and does not claim an exhaustive
count. No matching evidence means UNKNOWN, not zero. Attribution remains UNKNOWN and
causal lift INCONCLUSIVE. No revenue values or customer records are copied.

Zero dependencies, services, workers, polling, provider calls or AI tokens. Per-request
work is bounded at 50/500/5,000 registered users; actual concurrent request volume and
SQLite writer serialization determine capacity. No measured production latency claim.
Receipt JSON is capped at 16 KiB; input refs at 2 KiB. Global concurrency remains the
existing synchronous single-process/SQLite transaction boundary, not a new scheduler.

## LOADDER_IMPROVEMENT_BACKLOG / TOP_5_LOADDER_GAPS

1. **P2 / NEXT / S — Human adoption handoff.** The scaffold deliberately has no adoption
   endpoint. Users still need domain authoring/governance. Reuse that API in a later
   focused handoff; prove approval checks and idempotency. No schema/dependency expected.
2. **P2 / NEXT / M — Complete evidence assessment.** Recent-25 is not a total or causal
   assessment. Add explicit bounded window analysis only when required; reuse evidence
   and experiment ownership, measure indexes/query cost, review schema separately.
3. **P2 / NEXT / S — Operator diagnostics.** Safe HTTP failure codes exist but there is
   no persisted failed receipt. Evaluate existing operation metrics for failure visibility;
   prove redaction and bounded retention, avoid a new monitoring service.
4. **P2 / LATER / M — Observed attribution.** Operator-linked treatment does not prove
   acquisition. Connect independent touch evidence before ROI/causality claims; contract
   and tenant tests required, persistence changes need review.
5. **P2 / NEXT / S — Production load evidence.** User count is not throughput proof.
   Measure context-read cost, transaction duration and contention on a normal VPS at
   representative 50/500/5,000-user activity. Optimize only measured bottlenecks.

Existing domain versioning and immutable Growth evidence are strong and preserved.
