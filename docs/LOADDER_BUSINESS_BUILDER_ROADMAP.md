# Loadder Business Builder — Canonical Roadmap

> Repository source of truth for the Loadder-owned Business Builder / Business Operator. Permanent engineering constitution: `docs/LOADDER_ENGINEERING_SYSTEM.md`. Dated recovery checkpoints live under `docs/backups/` and must never be overwritten.

## North Star
Loadder is an AI Business Operating System where **ENGINE BUILDS, AI GUIDES**.

`User Goal -> Navigator -> Deterministic Engine -> App Definition -> Runtime -> Intelligence -> Governed Action -> Approval -> Execution -> Outcome`

## Permanent engineering law
All work follows LES. Development model: `FAST GATE -> DEVELOP -> FULL GATE -> RELEASE`. No newer SHA inherits an older SHA's green evidence.

## Core doctrine
- Deterministic Loadder code builds supported applications; deterministic build token budget is **zero**.
- AI navigates, teaches, reviews and proposes; AI outage must not break supported apps.
- Minimal UX remains: `چی می‌خوای بسازی؟ -> بساز -> ادیت -> استفاده -> انتشار`.
- No UI-only/mock-success capability is Done.

## Completed foundation
- [x] Deterministic Persian/English compiler + eight commercial blueprints
- [x] App Definition, RTL UI contract, Visual Editor, immutable versions, export/import
- [x] SQLite runtime + PostgreSQL production adapter/schema/integration foundation
- [x] Workflow runtime, intelligence, Action Ledger, append-only ordered history
- [x] Approval Center RBAC + Publish Center blockers
- [x] Zero-token Navigator + AI-offline acceptance
- [x] Backup/Restore Drill foundation
- [x] Fast Gate + exact-head Full Gates
- [x] Low-cost production profile and recovery snapshots

## Phase A — Quality hardening
- [x] Bounded transient retry + PostgreSQL recovery health contract
- [x] Builder/operator rate limiting + distributed-store injection contract
- [x] Deployment artifact integrity + canary/rollback contracts
- [x] Tenant-scoped deployment history persistence foundation
- [x] Isolated worker execution policy rejects privileged/host capabilities
- [x] Workspace/project cost + latency telemetry contract with zero-token assertion
- [x] Tenant-scoped operations dashboard aggregation + regression coverage
- [x] Owner/Admin-only Business Builder admin summary endpoint
- [~] Cross-tenant isolation coverage extended; continue across new production stores
- [ ] Provider outage/timeout suite across external services
- [ ] Fine-grained per-app/per-action RBAC

## Phase B — Minimal Product Studio
- [x] Minimal build entry, backend catalog, Visual Editor, Navigator, Approval Center, Publish Center
- [x] Business Builder Operations Dashboard route/UI
- [x] Business Builder Admin Console route/UI with Owner/Admin server enforcement
- [~] Block reorder backend complete; drag/drop UX pending
- [~] Field visibility complete; full page visibility pending
- [ ] Navigation/page rename UX polish
- [ ] Mobile/responsive acceptance suite

## Phase C — AI Navigator
- [x] Deterministic fallback guidance
- [ ] Context-aware screen guidance
- [ ] Natural language -> validated editor/workflow patches
- [ ] Error explanation/remediation
- [ ] Explicit AI cache/routing policy

## Phase D — Vertical expansion
Next: Real Estate -> Retail/Distribution -> Construction -> HR -> Procurement -> Support -> Lightweight ERP. Every vertical must ship deterministic blueprints + fixtures + roles + workflows + KPIs + governed actions.

## Phase E — Production runtime/deployment
- [x] PostgreSQL adapter, pool provider, schema mapping and real PostgreSQL 16 CI integration
- [x] Composable secret backend chain
- [x] Distributed rate-limit store contract
- [x] Production deploy adapter with SHA-256 verification
- [x] Canary controller + automatic rollback contract
- [x] Deployment history persistence foundation
- [x] Isolated worker execution contract/policy foundation
- [x] Cost/latency/token telemetry contract
- [x] Production operations Release Drill workflow foundation
- [~] Production smoke evaluator; real environment wiring pending
- [ ] Production PostgreSQL backup/restore drill
- [ ] Real external secret backend integration
- [ ] Real distributed limiter backend integration
- [ ] Real deploy provider integration
- [ ] Persisted telemetry dashboard and admin health controls

## Dashboard/Admin operating model
### User Dashboard
Shows only current workspace operational truth: app count, deployments, failed deployments, pending approvals/actions, runtime records and active members. Project operations can expose recent deployments/actions without exposing another tenant.

### Admin Console
Owner/Admin-only server-enforced surface for workspace membership, deployment history, failure reasons, canary state and future cost/security/health controls. Client-side hiding is never the authorization boundary.

## Canonical production topology
```text
Reverse Proxy/TLS
  -> Loadder Web + API (small shared instances)
  -> PostgreSQL
  -> Object Storage
  -> Distributed limiter/queue only when measured need exists
  -> Ephemeral isolated workers for builds/heavy AI/risky execution
```
No default Kubernetes, per-tenant always-on compute, host Docker socket, privileged runtime or host networking.

## Recovery memory
Canonical roadmap: this file. Engineering constitution: `docs/LOADDER_ENGINEERING_SYSTEM.md`. Dated checkpoints: `docs/backups/LOADDER_BUSINESS_BUILDER_SNAPSHOT_*.md`. Git memory never substitutes for encrypted production DB/object backups.
