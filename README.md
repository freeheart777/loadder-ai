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

Legacy standalone server files remain in `server/` for reference during the
incremental migration, but development scripts do not start them.
