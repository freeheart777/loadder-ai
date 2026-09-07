# Growth content brief/candidate v1

## Ownership and compatibility

Experiments and their scalar context/goal references remain authoritative. An immutable
brief pins one authored experiment and its context; its provenance comes from the
existing context consumer gateway, not client claims. Brand Book/DNA are not copied
into another editable truth system. `CONTEXT_OFFERING` references an index in that
pinned context's offerings; arbitrary external references are rejected.

This API foundation produces TEXT candidates. It does not generate/upload media,
replace Content Studio, or change the legacy `/api/agent/run` response contract.
The same agent executor/provider registry is reused; an optional server-owned abort
signal is passed through to the existing provider. No second provider path exists.

## API

All paths require the existing authenticated workspace boundary. Active members can
read; only current owner/admin membership can author or decide, checked in storage.

- POST `/api/growth/content/briefs`
- GET `/api/growth/content/briefs/:id`
- GET `/api/growth/experiments/:id/briefs`
- POST/GET `/api/growth/content/briefs/:id/candidates`
- GET `/api/growth/content/candidates/:id`
- POST `/api/growth/content/candidates/:id/decision` (`APPROVED` or `REJECTED`)

Pagination defaults to page 1 / 25, maximum page size 100 and page 10,000.
Creation requires an explicit idempotency key in the body. Same normalized request
converges; conflicting reuse returns 409. Tenant/creator/status/provider/timeout
authority is not accepted from the client.

## Lifecycle

`PENDING → VALIDATED → APPROVED | REJECTED`

Generation can instead end in `PROVIDER_FAILED`, `VALIDATION_FAILED`, or
`RECONCILIATION_REQUIRED`. Provider/network ambiguity is never retried automatically.
An unresolved pending/unknown call blocks another call for that brief, even under a
different key. A replay after the 40-second deadline converts a lost pending call
to reconciliation-required. Reads remain read-only. No background polling or
reconciliation worker is introduced; resolving unknown outcomes is deferred and
must not be implemented as a blind retry.

The candidate body is immutable after validation. Human decisions update only
lifecycle metadata and become terminal. Editing supplies a predecessor and a new
idempotency key/body, creating a new validated identity requiring its own approval.
Brief revisions also create new identities. Neither approval nor the response's
`publishingAuthorized: false` grants distribution/execution permission.

Validation here proves bounded, nonempty text and normalized provenance, not factual
accuracy or automatic compliance with free-text brand constraints; those still need
human review. No revenue, causality, or publish claim is inferred.

## Evidence and migration

082 adds only `growth_content_briefs` and `growth_content_candidates`, including
tenant/predecessor/transition/immutability guards. 083 expands only the evidence
subject CHECK to include `CONTENT_CANDIDATE`. Objects, relation and financial
authority semantics remain unchanged. Approved candidates resolve through their
brief to the pinned experiment/context/goal. Evidence never copies candidate content.

083 copies existing columns unchanged inside a transaction, preserving IDs, hashes,
supersession and all prior indexes/triggers. It checks the entire final FK graph
before clearing SQLite's obsolete deferred counters from the old table. Failure
rolls back the table replacement; repeated application is safe. Tests exercise the
canonical migrator, including its migration-record rollback. Migration 080 is untouched.

Operational rollback: disable the new authoring endpoints or deploy a compatible
forward fix; retain all briefs, candidates and evidence. Do not down-migrate by
dropping evidence or rewriting approved identities. Back up before deployment.

## Lean bounds and evidence limits

- At most 10 candidate attempts per brief; one generation per explicit request.
- 1,000 output tokens; 8,000-character topic projection; 12,000-character output.
- 40-second maximum provider deadline, AbortController, zero automatic retries.
- Context projection includes only selected identity/brand fields and the selected
  offering. No entire tenant history; no raw provider payload persistence/response.
- Usage is `UNKNOWN` unless normalized usage was actually returned. Existing executor
  may not supply token usage; no invented count or monetary cost is emitted.
- Tenant-leading paginated queries; no services, queues, workers, polling or dependencies.

At 50/500/5,000 users, ordinary reads remain page-bounded. Provider concurrency scales
with simultaneous explicit calls, not registered-user count. This PR does not claim
load-tested capacity. Measure provider concurrency, DB contention and request latency
before adding infrastructure; evaluate admission limits before wider rollout.

## Evidence-backed backlog

- P1 / NEXT / S-M: Unknown provider outcomes remain intentionally blocked. Add a
  provider-evidence-backed operator reconciliation contract, with no retry on guesswork;
  test restart, concurrent completion and terminal decisions before enabling it.
- P2 / NEXT / S: Existing executor does not expose normalized usage consistently.
  Add tested normalization at the existing boundary, without persisting raw responses.
- P2 / NEXT / S: Existing dependency audit advisories (`fast-uri`, `qs`) are unchanged.
  Address in a separate dependency/security PR with full regression gates.
- P2 / NEXT / M: Measure concurrent generation before paid-pilot scale; add bounded
  admission only against evidence, without a new service by default.

The existing context, experiment and evidence separation is strong and is preserved.
