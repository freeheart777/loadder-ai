# Loadder

Loadder currently uses a React/Vite frontend and one canonical Express backend.

## Local development

Copy `.env.example` to `.env` and add only the provider credentials needed for
the feature you are testing. Never commit real credentials.

```bash
npm run dev
```

This starts:

- the Vite frontend on its normal development port;
- the canonical backend at `API_HOST:API_PORT` (defaults to
  `127.0.0.1:3001`).

The frontend uses `VITE_API_BASE_URL` for every backend request.

## Canonical backend

`server/index.mjs` is the only supported backend entry point. It exposes CRM,
marketing, automation, messaging, prototype authentication, Business Brain,
and AI agent routes through the same Express application.

The Phase 1 authentication foundation uses persistent hashed OTP challenges
and opaque server-side sessions. Set
`AUTH_EXPOSE_DEV_OTP=true` only in a local development environment when no SMS
provider is connected; the Auth page will display that development-only code.
Production requires `AUTH_HASH_SECRET` and never returns an OTP code.

Tenant-facing runtime code must use `server/db/workspace-database.mjs`; direct
access to `server/db/database.mjs` is reserved for migrations, maintenance
scripts, database initialization, and isolated tests. Run
`npm run check:db-boundary` to enforce this boundary. A legacy-data workspace
owner can be assigned explicitly and idempotently with
`npm run workspace:assign-legacy-owner -- <mobile-or-user-id>`.

## Tenant data boundary

Authenticated API requests resolve an active membership and run domain access
inside that workspace context. CRM, automation, events, executions, campaigns,
metrics, and attribution records are workspace-owned. Marketing channels,
platforms, and advertising-service definitions remain global reference data.
Existing pre-tenant records belong to the reserved `loadder-legacy-data`
workspace and are not exposed to newly created workspaces.

## Business Context contract

Business Context is assembled deterministically by the backend from the
workspace's Business Profile and its active Business DNA and Brand Book
versions. A context snapshot pins those exact sources and never changes after
activation. Missing scalar values are represented as `null`, missing lists as
`[]`, and missing structured values as `{}`; the assembler does not invent
content. Later source changes mark the active context as stale and require an
explicit rebuild and activation.

Intelligence modules must consume this snapshot through the read-only Business
Context Consumer Gateway in `server/app/context-consumers/`. The gateway checks
workspace scope, freshness, consumer capabilities, and schema compatibility,
then records content-free usage attribution. Its stable states are `READY`,
`MISSING_CONTEXT`, `STALE_CONTEXT`, and `UNSUPPORTED_SCHEMA`. Consumer modules
must not import Business Profile, Business DNA, Brand Book, or context
repositories directly; `npm run check:db-boundary` enforces that boundary.

## Intelligence data foundation

Canonical intelligence data follows an append-oriented contract:

`Business Context → Business Events → Normalized Observations → Derived Signals → Deterministic Feature Values`

`business_events` is separate from the legacy automation `events` table.
Canonical event types are code-registered and schema-validated, preserve event
time separately from ingestion time, support provider idempotency, and may be
ingested without a ready context so factual data is not lost. Observation and
signal production requires a fresh context through the Consumer Gateway.
Signal producers live in `server/app/signal-producers/` and are covered by the
same direct-source-access boundary check. Phase 3B signals are explanatory
data only; they do not trigger recommendations or actions.

Feature definitions are code-versioned while immutable calculated values are
stored with their exact Context, Observation, Signal, window, producer, and
calculation-policy references. Feature producers consume only the canonical
Observation/Signal layer and are covered by the architecture boundary check.
Features are deterministic model-ready inputs: they are not predictions,
recommendations, decisions, or actions. Phase 3C contains no machine learning,
embeddings, or external AI calls. Future models must consume Feature Values
instead of reading operational source tables directly.

Phase 3D extends the canonical path as:

`Deterministic Feature Values → immutable Model Input Snapshots → versioned Evaluations`

Model specifications are code-defined and versioned. A Model Input Snapshot is
built only from Feature Values and pins their IDs, feature and producer
versions, the exact Business Context version, subject, point-in-time cutoff,
and snapshot schema. Missing, expired, incompatible, and context-unavailable
features are recorded explicitly; there is no silent imputation. Identical
construction inputs reuse the same immutable snapshot.

The initial evaluator is a transparent deterministic input-consistency
baseline. It returns completeness and consistency metrics plus explanation
codes. An Evaluation is not a forecast, prediction, recommendation, decision,
or action. Future forecasting must consume Model Input Snapshots rather than
read Feature Values or operational tables directly, preserving point-in-time
correctness and complete provenance.

## Forecast foundation

Phase 3E adds immutable Forecast records after Model Input Snapshots. Forecast
specifications declare target type, horizon, compatible input/context versions,
method version, minimum inputs, missing-data policy, and uncertainty policy.
Forecast builders never read operational or intermediate intelligence tables.
The initial cart-recovery probability baseline is a visible deterministic rule
set, is not empirically calibrated, and reports uncertainty as unavailable.
Forecasts contain no recommendation, decision, action, or automation command.

## Knowledge and integration foundation

Phase 4A introduces provider-independent read-only connector definitions,
workspace-owned connection health, sync/import lifecycle records, immutable
canonical imported facts, knowledge artifact versions, and versioned KPI
definitions and measurements. Connector availability is region metadata
(`GLOBAL`, `IRAN`, or `MENA`) while the intelligence core remains shared.
Credentials are represented only by `secret://` or `vault://` references and
are omitted from APIs and audits.

The pilot imports CSV or structured JSON invoices through
`financial.invoice@1.0`. Rows are validated independently, partial failures are
inspectable, exact imports are idempotent, and external identity is scoped by
workspace, connection, object type, and object ID. No external write-back
capability exists.

Canonical CRM terminology maps provider contacts, accounts, leads, deals, and
activities into shared Loadder concepts. The financial contract supports
invoice, payment, refund, expense, revenue, receivable, payable, tax, account,
transaction, gross-profit, cash-movement, amount, and currency facts without
inventing unavailable fields.

Knowledge artifacts preserve immutable hashes and provenance. JSON can be
parsed deterministically into proposed structured content, but artifacts do
not update Business Profile, DNA, Brand Book, KPI, or Business Context. Those
changes require a future explicit review and activation workflow.

## Knowledge extraction and canonical mapping

Phase 4B uses this evidence lifecycle:

`Artifact → Parsed Document → Extraction Run → Field Candidate → Conflict → Review → Proposed Canonical Version → Explicit Activation`

JSON, CSV, and plain text are parsed deterministically with structure and
source locations preserved. PDF, DOCX, XLSX, and PPTX have versioned parser
contracts but return an explicit runtime-unavailable state until vetted parser
libraries are installed; OCR is never performed silently. Documents are
untrusted input: size, MIME/extension, nesting, paths, CSV formula-like cells,
and malformed structures are checked, and no macros, scripts, links, or
formulas execute.

Extracted information is evidence, not truth. Candidates are immutable field
proposals with source provenance, language/locale/direction metadata, and a
null confidence plus reason when statistical confidence is unavailable.
Conflicts are deterministic and never semantically auto-resolved. Approval is
an append-only review event that creates an immutable draft proposal; approval
is not activation and no document overrides active business knowledge.

External factual mapping follows:

`External Provider/File → Canonical Imported Fact → Versioned Mapper → Business Event → Observation → Signal → Feature → Model Input → Forecast`

Import adapters cannot write Business Events directly. The initial invoice
mapper consumes an immutable canonical imported fact, validates required
financial fields, creates an idempotent `invoice.issued` event, and records an
immutable provenance link. No missing financial value is inferred.

## Web and social listening foundation

Phase 4C extends factual ingestion without adding scraping, AI sentiment, or
external write-back:

`External source → versioned source adapter → immutable collection run → canonical listening record → versioned event mapper → Business Event → deterministic Observation/Signal`

Listening monitors are workspace-owned and versioned. Each immutable version
pins keywords, exact and excluded phrases, brand/competitor/product names,
domains, source categories, provider filters, languages, regions, frequency,
record/text limits, and retention policy. Collection runs preserve cursors,
rate-limit state, accepted/deduplicated/rejected counts, errors, and provider
provenance so a future queue worker can use the same contract.

Canonical listening records are provider-neutral and immutable. Supported
types are `web_document`, `news_article`, `social_post`, `social_comment`,
`social_mention`, `review`, and `engagement_metric`. SQLite stores normalized
text excerpts, hashes, references, timestamps, language/locale/direction,
bounded engagement counters, and provenance—not full HTML or media. Large
content is represented by an optional future object-storage reference.

Deduplication uses provider plus external object ID, then canonical URL, then a
content hash and event-day identity. Database uniqueness resolves concurrent
duplicate delivery. Normalization is deterministic and Unicode-safe; content
is never silently translated. Explicit numeric ratings may produce a factual
low-rating signal, but text sentiment, topic/entity inference, anomaly
detection, reputation scoring, and semantic similarity remain a future NLP
boundary.

The runtime pilot accepts supplied records only. Registered global, Iranian,
and MENA provider definitions describe official/permitted read capabilities,
but unavailable adapters fail explicitly. All capabilities are `READ_*`; no
posting, replies, messaging, advertising changes, or provider write-back are
implemented.

URL references accept only HTTP(S) and reject localhost, private/link-local
addresses, metadata hosts, file URLs, and unsupported protocols. No JavaScript,
forms, scripts, embedded resources, or remote links are executed or fetched.
Future live collectors must additionally enforce DNS rebinding protection,
robots/provider policy, response-size and redirect limits, timeouts, bounded
concurrency, and retry/backoff within their adapter.

Retention classes are `EPHEMERAL_RAW`, `NORMALIZED_ONLY`,
`COMPLIANCE_ARCHIVE`, and `EXTERNAL_REFERENCE_ONLY`. Per-monitor record count,
text length, and retention-day limits provide the current cost-control
boundary. The repository/service interfaces can later move collection work to
PostgreSQL, object storage, Redis, queues/streams, search indexes, and an
analytics warehouse without changing the canonical record or event contracts.

## Listening intelligence foundation

Phase 4D adds deterministic descriptive/diagnostic intelligence to the same
canonical pipeline:

`Listening Record → Topic Match / Aggregate → Normalized Observation → Derived Signal → Feature Value`

Metric contracts are code-versioned at version 1 for mention count, unique
source count, engagement total/rate, source/language/channel distributions,
mention velocity/growth, share of voice, topic frequency/velocity, competitor
mentions, and brand-versus-competitor ratio. Window policies are versioned for
1 hour, 24 hours, 7 days, and 30 days. Windows use `[windowStart, windowEnd)`;
the point-in-time cutoff additionally excludes records collected later, while
the original publication timestamp remains unchanged. Missing denominators,
entity sets, engagement counters, or baselines produce `unavailable` or
`insufficient_data`, never an invented zero.

Topics use configured monitor keywords, brand names, competitor names, product
names, and exact phrases. Matching is Unicode NFKC normalization, case folding,
safe Arabic/Persian character normalization, and deterministic substring or
exact-phrase matching. It preserves the configured text, matched text,
normalized form, language, method, rule version, and source-record ID. It does
not claim semantic understanding and performs no destructive transliteration.

Share of voice is `brand mentions / (tracked brand mentions + tracked
competitor mentions)` for the exact entity, source, language, time, and Context
scope recorded in provenance. The Business Context business name is used only
through the Consumer Gateway; monitor-configured entities remain explicit.
Absent competitors or a zero denominator are unavailable.

Trends compare the current window with the previous equal-size window.
Relative delta is `(current - baseline) / baseline`; ±25% is rising/falling and
an absolute relative delta of at least 100% is high severity. These are
versioned deterministic baseline thresholds, not learned or “optimal.”
Confidence is null with an explicit reason. Anomalies use prior windows only
and the robust score `0.6745 × |current - median| / MAD`, requiring four prior
observations. Zero dispersion never produces a fake probability or infinite
score.

Derived rows are immutable and idempotent at a workspace-scoped producer-key
uniqueness boundary. Provenance pins metric/window/producer versions, Context,
cutoff, entity/source/language scope, exact aggregate/observation IDs, and a
compact source-record manifest. Read APIs under `/api/listening/` are
authenticated, workspace-derived, filter validated, and capped at 100 rows.
The summary is factual JSON and contains no generated advice.

Storage remains bounded: derived tables reference record IDs and hashes rather
than copying bodies; media stays external-reference-only; duplicate records
converge at canonical identity. A future plan-aware retention worker may keep
raw records hot for 30–90 days and aggregates longer, but Phase 4D deletes
nothing automatically and preserves all historical data.

Phase 4D is not semantic sentiment understanding, causal inference,
recommendation, decisioning, optimization, action, provider write-back, or
autonomous agent behavior. Sparse-history anomaly interpretation, cross-monitor
entity resolution, multilingual semantics, and warehouse-scale rollups remain
known future limitations.

## Architecture hardening and lean evolution

Phase H1 keeps the application a modular monolith. Legacy CRM statistics and
core customer routes are mounted through a dedicated router while retaining
their original paths and response contracts. Further legacy marketing,
automation, messaging, and optimizer extraction remains incremental so route
movement does not become a behavior-changing rewrite.

Listening intelligence calculations first probe SQLite for an exact immutable
result set. The reuse identity pins the window policy/version, start/end,
point-in-time cutoff, Context version/state, metric and producer versions, and
workspace-wide source scope. A compact source snapshot (run/accepted/record
counts plus latest run and collection timestamps) invalidates reuse after new ingestion.
On a hit, raw listening records are not scanned and topic, aggregate, trend,
anomaly, observation, and feature rows are not recreated. SQLite is therefore
the durable deterministic cache; no external cache is required.

Critical listening calculations emit bounded, content-free in-process
measurements: operation, workspace ID, duration, rows read/written, reuse state,
error code, and timestamp. The default buffer retains only the latest 200
entries. It never records source text, business payloads, credentials, tokens,
or personal content and can later be connected to an operational sink without
changing calculation code.

### Future hourly listening buckets

Hourly buckets are intentionally not persisted yet: current production-like
tables are empty and no measured volume justifies their permanent write cost.
The forward design is an immutable `listening_hourly_buckets` row keyed by
workspace, UTC hour, monitor/topic/entity scope, metric contract version,
Context version, producer version, and source-manifest hash. Each row would
store additive counters, explicit missing-value counts, distinct-source hashes
or a bounded exact manifest, and source count—not copied text. A unique
producer key would converge concurrent writes. The 24-hour, 7-day, and 30-day
calculators would combine complete buckets and scan only the two partial edge
hours, preserving `[start,end)` semantics and point-in-time provenance. This
should be implemented only after scan telemetry proves that saved reads exceed
bucket write amplification.

### Future compact Business Context

Business Context remains backward-compatible `business-context/v1`; H1 adds no
schema or migration. Its lean evolution path is a compact immutable core plus a
versioned section manifest and lazy Consumer Gateway hydration. A section
reference has `sectionName`, `sectionVersion`, `sourceId`, `contentHash`, and
`schemaVersion`. Competitors, markets, pricing, funnels, sales structure,
budgets, KPIs, catalog references, channel/integration capabilities, policies,
and constraints can then evolve independently without copying operational
state into every Context snapshot. Migration should be additive: introduce
immutable section resources, allow a v2 manifest beside existing snapshots,
teach the Gateway to hydrate only consumer-declared sections, then retain v1
read support indefinitely. Live balances, campaign metrics, customer records,
and other operational state must never become Context sections.

## H2 modular runtime and growth controls

H2 adds optional keyset cursors to `GET /api/listening-records` and
`GET /api/events`. Existing `records` and `events` arrays and the `limit <= 100`
contract remain unchanged; responses additionally include nullable
`nextCursor`. Cursors are opaque base64url JSON envelopes with a version,
endpoint kind, and timestamp/ID position. They contain no workspace ID. Every
query still derives ownership from the authenticated active workspace, and
malformed or cross-endpoint cursors fail with `INVALID_CURSOR`.

Listening records use `(collected_at DESC, id DESC)`. Business Events use
`(occurred_at DESC, ingested_at DESC, id DESC)`. Repositories read one bounded
look-ahead row to determine whether another page exists; OFFSET is not used.
Current tenant-leading indexes constrain both paths. Empty tracked tables do
not justify wider indexes solely to remove tie-column temporary sorting.

Exact listening reuse batch-loads pilot Feature Values in one query instead of
one lookup per feature. Invalidation is verified for new collection data and a
Context-version change. Metric/window and producer versions remain part of the
request fingerprint and producer identity. Hourly buckets remain deferred
until operational measurements demonstrate sustained tail-latency, records per
window, or repeated cache-miss pressure. H2 asserts no numeric production
threshold without production telemetry.

### Retention tiers

- **HOT:** active configuration, recent operational events, normalized
  listening excerpts required by active windows, current features, and recent
  audits remain fully queryable in the primary database.
- **WARM:** older immutable events, aggregates, topic matches, features,
  evaluations, forecasts, and compact provenance remain online with less
  frequent access. Raw bodies are not duplicated.
- **ARCHIVED:** expired raw listening/document detail and older audit history
  may later move to compliant archive storage. The primary database retains
  immutable IDs, hashes, references, schema/producer versions, timestamps,
  tenant ownership, and manifests sufficient to verify and locate evidence.

Tier movement must be explicit, workspace-policy driven, audited, and
reversible at the reference level. H2 performs no deletion or automatic
archival.

## H3 lean read paths and runtime decoupling

H3 keeps public list contracts intact while adding optional keyset cursors to
`GET /api/features` and `GET /api/observations`. Feature Values order by
`(calculated_at DESC, id DESC)` and Observations use the same stable ordering.
The existing arrays, filters, authentication, active-workspace resolution, and
100-row maximum remain unchanged; `nextCursor` is an additive nullable field.
The versioned cursor contains only its endpoint kind and ordering position, so
it cannot select a tenant and cannot be replayed across endpoints.

Legacy Marketing catalog reads (`channels`, `platforms`, `services`,
`structure`) and the campaign list now live in an injected router. Optimizer,
attribution, campaign mutation, and runtime-control routes remain in the
composition root because moving them safely requires separating their current
cross-domain orchestration first. The extraction changes no route paths or
response shapes.

The bounded in-process operation buffer can summarize each operation's count,
errors, reuse, average/p50/p95/max duration, and average rows read, rows written,
and result count. Listening calculation entries additionally count current and
previous source-window rows, generated topic matches and aggregates, Feature
count, and cache reuse. Measurements contain identifiers and numeric metadata
only—not record text, business payloads, credentials, or personal content—and
are not exposed through a public endpoint.

Hourly listening buckets remain intentionally deferred. Operational evidence
should first show a combination of repeated cache misses, large source-row
windows, rising p95 calculation duration, or a poor raw-scan-to-derived-write
ratio. No absolute threshold is asserted without production telemetry. When
those categories persist, the immutable hourly-bucket design above can be
evaluated against measured scan savings and write amplification.

`server/db/database.mjs` remains a legacy persistence boundary containing
bootstrap/schema setup, mapping helpers, automation/execution persistence, CRM
and commerce persistence, Marketing/attribution persistence, derived KPI
queries, and seed data. Its next safe split is mechanical domain repositories
behind the existing `workspace-database.mjs` facade; H3 does not risk a broad
rewrite or schema change. `server/services/optimizer.mjs` remains a deterministic
and heuristic calculation module spanning catalog/control definitions,
planning/scenarios, KPI analysis, problem detection, optimization/simulation,
and budget reallocation. Future decomposition should separate pure numeric
primitives, planning, diagnosis, and simulation while retaining the current
public facade and formulas.

Legacy standalone server files remain in `server/` for reference during the
incremental migration, but development scripts do not start them.
