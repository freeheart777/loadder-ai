# Loadder Business Builder — Canonical Roadmap

> Repository source of truth for the Loadder-owned Business Builder / Business Operator. Permanent engineering constitution: `docs/LOADDER_ENGINEERING_SYSTEM.md`. Dated recovery checkpoints live under `docs/backups/` and must never be overwritten.

## North Star
Loadder is an AI Business Operating System where **ENGINE BUILDS, AI GUIDES**.

`User Goal -> Navigator -> Deterministic Engine -> App Definition -> Runtime -> Intelligence -> Governed Action -> Approval -> Execution -> Outcome`

## Permanent engineering law
All work follows LES: Kaizen, Jidoka, Poka-Yoke, Genchi Genbutsu, Standard Work, Andon, Heijunka, waste elimination, Five Whys and quality-at-source.

### Development/release gate model
`FAST GATE -> DEVELOP -> FULL GATE -> RELEASE`

Fast Gate gives targeted feedback on the Business Builder surface and is allowed to cancel stale runs on the same branch. Full Gate remains mandatory on the exact release SHA for merge/release/production. A queued Full Gate does not freeze unrelated reversible development, but no newer SHA inherits an older SHA's green evidence.

### Definition of Done
No UI-only/mock-success capability is Done. A feature must prove its real UI/API/service/persistence-or-runtime path, define failure/retry behavior, add regression/integration coverage, and pass the exact release SHA Full Gate before merge/release.

## Core doctrine — ENGINE BUILDS, AI GUIDES
- Deterministic Loadder code/blueprints/contracts build supported applications.
- AI is optional for normal build/run/edit/restore/export operation.
- AI navigates, teaches, reviews, proposes safe deltas and explains.
- Deterministic/catalog/rule/cached paths are checked before any LLM call.
- Deterministic build token budget is **zero**.
- AI outage degrades guidance, not supported applications.
- Minimal UX: `چی می‌خوای بسازی؟ -> بساز -> ادیت -> استفاده -> انتشار`.

## Lean commercial principles
1. Operational completeness over feature count.
2. No token spend for deterministic work.
3. Shared multi-tenant runtime; no dedicated always-on compute for small idle tenants by default.
4. PostgreSQL + Object Storage production baseline; avoid service sprawl.
5. Queue/ephemeral workers only for bursty work.
6. Provider-independent critical contracts.
7. Security, idempotency, audit, rate limits and recovery are release gates.
8. No default Kubernetes, host Docker socket, privileged runtime or host networking.
9. Cost, tokens, errors and latency attributable per workspace/app/task.
10. Dated GitHub snapshots + encrypted off-primary database backups + verified restore drills.

## Completed foundation
- [x] Deterministic Persian/English compiler
- [x] Loadder App Definition + validation
- [x] CRM / Inventory / Booking / Project / Approval / Customer Portal / Logistics / Agency blueprints
- [x] UI contract + RTL renderer
- [x] Versioned Visual Editor patch path; rename/hide/theme controls
- [x] Portable bundle; persistence; immutable versions; restore/export/import
- [x] SQLite workspace-scoped CRUD runtime + references/search/pagination
- [x] Workflow runtime + runtime Copilot fallback
- [x] Live generated-app route
- [x] Vertical intelligence for CRM/Inventory/Booking
- [x] Governed action drafts
- [x] Action Ledger + idempotency
- [x] Append-only ordered Action History
- [x] Approval Center UI + real workspace membership RBAC
- [x] Publish Center UI + explicit blocker backend
- [x] Deployment canary/health/rollback contracts
- [x] Commercial catalog
- [x] Zero-token deterministic Navigator
- [x] LES permanent engineering law
- [x] AI-offline commercial acceptance
- [x] Low-cost production runbook
- [x] Feature-branch exact-head Server/Frontend/Security Full Gates
- [x] Business Builder targeted Fast Gate with stale-run cancellation
- [x] Dated GitHub architecture/recovery snapshot

## Phase A — Quality hardening (ACTIVE)
- [x] LES Fast Gate / Full Gate development model codified and automated for Business Builder
- [x] Approval Center UI
- [~] Action Ledger recommendation -> approval -> execution -> outcome; external executors pending
- [~] Idempotency on mutating operator/executor paths
- [x] Immutable action audit trail
- [x] Owner/Admin approval RBAC; finer per-app/per-action RBAC pending
- [~] Cross-tenant isolation coverage extended to records/approvals/actions
- [ ] Restart/retry recovery suite
- [~] Corrupt payload/malformed definition tests
- [ ] Provider outage/timeout suite
- [ ] Rate limiting/abuse limits for Builder/operator endpoints
- [x] Database Backup/Restore Drill foundation
- [x] Performance/cost budget contract including zero-token deterministic build
- [x] Deterministic AI-offline acceptance

## Phase B — Minimal Product Studio
- [x] Minimal `چی می‌خوای بسازی؟` entry
- [x] Commercial catalog from backend
- [x] Visual editor side panel
- [x] Zero-token next-step Navigator
- [~] Block reorder validated backend; Studio drag/drop UX pending
- [~] Field visibility controls; full page visibility pending
- [ ] Navigation/page rename UX polish
- [ ] Mobile/responsive acceptance suite
- [x] Publish Center with readiness blockers and next-action guidance

## Phase C — AI Navigator
- [x] Deterministic fallback guidance foundation
- [ ] Context-aware screen guidance
- [ ] Natural language -> validated editor patch
- [ ] Natural language -> validated workflow proposal
- [ ] Error explanation/remediation
- [ ] Explicit AI token budget/cache routing policy

## Phase D — Vertical expansion
Logistics + Agency deterministic foundations complete. Next: Real Estate -> Retail/Distribution -> Construction -> HR -> Procurement -> Support -> Lightweight ERP.
Every vertical ships as deterministic blueprints + fixtures + roles + workflows + KPIs + alerts + governed actions.

## Phase E — Production runtime/deployment
- [~] Provider-neutral PostgreSQL runtime adapter foundation added; real PostgreSQL integration/connection pool validation pending
- [x] PostgreSQL runtime schema + SQLite->PostgreSQL deterministic mapping contract
- [ ] Loadder production deploy adapter
- [ ] Isolated ephemeral worker implementation
- [ ] Secrets manager
- [ ] Artifact checksums/signing
- [ ] Synthetic smoke + canary + automatic rollback against real environment
- [ ] Deployment history
- [x] SQLite database backup/restore drill foundation; production PostgreSQL drill pending
- [x] Reference low-cost single-node profile documented and codified
- [x] Performance/cost budget contract
- [ ] Real benchmark telemetry and per-workspace cost accounting

## Phase F — Native / enterprise / ecosystem
- [ ] Shared Native Renderer
- [ ] iOS build/sign/TestFlight/App Store gates
- [ ] Android build/sign gates
- [ ] SSO/SCIM, RBAC/ABAC, retention/audit export
- [ ] App Store / Agent Store / signed templates / safe integration SDK

## Canonical architecture
```text
MINIMAL PRODUCT EXPERIENCE
  User Goal
    -> Zero-token Navigator / optional AI guide
    -> Deterministic Catalog + Blueprints + Rules
    -> Business Compiler
    -> Loadder App Definition
    -> UI/Data/Workflow Contracts
    -> Immutable Version
    -> Shared Runtime (SQLite dev / PostgreSQL production target)
    -> Intelligence
    -> Governed Action Ledger
    -> Append-only Action Events
    -> Human Approval
    -> Replaceable Executor
    -> Outcome
```

## Reference production topology
```text
Reverse Proxy/TLS
  -> Loadder Web + API (1 small instance baseline; scale to 2+ when measured)
  -> PostgreSQL
  -> Object Storage
  -> Queue only when bursty work requires it
  -> Ephemeral workers for builds/heavy AI/risky execution
```
No default Kubernetes or per-tenant always-on container requirement.

## Recovery memory
- Canonical roadmap: this file.
- Engineering constitution: `docs/LOADDER_ENGINEERING_SYSTEM.md`.
- Dated immutable-style checkpoints: `docs/backups/LOADDER_BUSINESS_BUILDER_SNAPSHOT_*.md`.
- Git snapshots are architecture/recovery memory, not substitutes for encrypted production database/object-storage backups.

## Documentation rule
Material architecture/quality changes update this roadmap and, when appropriate, create a new dated snapshot. Historical snapshots are never overwritten.
