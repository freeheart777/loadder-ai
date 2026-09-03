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
- Minimal UX: `چی می‌خوای بسازی؟ -> بساز -> ادیت -> استفاده -> انتشار`.
- No UI-only/mock-success capability is Done.

## Competitive ten-gap program — ACTIVE
Benchmark-derived gaps against leading AI/no-code/internal-tool/mobile builders. These are product capabilities, not checkbox clones; each must preserve Loadder ownership, deterministic-first economics and LES quality.

1. **Visual Studio Complete — P0**: drag/drop, responsive layout, page management, rename/hide/show, component properties, undo/version safety.
2. **App-level Auth & RBAC — P0**: Public/Customer/Employee/Manager/Admin roles plus entity/action/field policies independent from Loadder workspace admin.
3. **Integration Hub — P0**: generic REST, Webhook, OAuth, Database Connector and Event Trigger primitives; vendor integrations become adapters.
4. **Blueprint/App Store — P0**: installable deterministic apps/templates with preview, version, ownership metadata and zero-token install path.
5. **Files/Object Storage UX — P1**: file fields, uploads, quotas, signed access, lifecycle and portable metadata.
6. **Realtime Data — P1**: subscriptions/events with tenant boundaries, reconnect/backpressure and graceful fallback.
7. **Payments/Commerce Primitive — P1**: provider-neutral checkout/payment/webhook contracts; Stripe-like providers are replaceable adapters.
8. **Environment + Git Lifecycle — P1**: dev/staging/prod promotion, diffs, immutable release refs, rollback and optional Git synchronization.
9. **Shared Native Renderer — P1**: web definition reused for iOS/Android where possible; device capabilities explicitly permissioned; store signing gates remain separate.
10. **Collaboration — P2**: multi-user editing, comments/presence, conflict strategy and audit; never sacrifice deterministic version integrity.

### Competitive rule
Do not reproduce competitor complexity. Loadder should combine simple onboarding, deep business capability, enterprise governance, source/infra ownership and deterministic cost. Integrations and native platforms must remain replaceable adapters.

## Completed foundation
- [x] Deterministic Persian/English compiler + eight commercial blueprints
- [x] App Definition, RTL UI contract, Visual Editor foundation, immutable versions, export/import
- [x] SQLite runtime + PostgreSQL production adapter/schema/integration foundation
- [x] Workflow runtime, intelligence, Action Ledger, append-only ordered history
- [x] Approval Center RBAC + Publish Center blockers
- [x] Zero-token Navigator + AI-offline acceptance
- [x] Backup/Restore Drill foundation
- [x] Fast Gate + exact-head Full Gates
- [x] Operations Dashboard + Owner/Admin Console foundations
- [x] Low-cost production profile and recovery snapshots

## Quality / Production hardening
- [x] Bounded transient retry + PostgreSQL recovery health contract
- [x] Builder/operator rate limiting + distributed-store injection contract
- [x] Deployment artifact integrity + canary/rollback contracts
- [x] Tenant-scoped deployment history persistence
- [x] Isolated worker execution policy rejects privileged/host capabilities
- [x] Workspace/project cost + latency telemetry contract with zero-token assertion
- [x] Tenant-scoped operations aggregation + Owner/Admin server enforcement
- [ ] Provider outage/timeout suite across external services
- [ ] Production PostgreSQL backup/restore drill
- [ ] Real external secret backend / distributed limiter / deploy provider integrations
- [ ] Persisted telemetry dashboard and admin health controls

## Product Studio status
- [x] Minimal build entry, backend catalog, Visual Editor foundation, Navigator, Approval Center, Publish Center
- [x] Operations Dashboard and Admin Console routes
- [~] Visual Studio Complete: validated block reorder + field visibility exist; drag/drop/page/responsive/property UX pending
- [ ] App-level Auth/RBAC
- [ ] Integration Hub
- [~] Blueprint Store foundation: deterministic catalog exists; installable store UX/version metadata pending
- [ ] Files/Object Storage UX
- [ ] Realtime Data
- [ ] Payments primitive
- [ ] Environment/Git lifecycle
- [ ] Shared Native Renderer
- [ ] Collaboration

## Dashboard/Admin operating model
User Dashboard shows workspace/project operational truth and next actions. Admin Console is server-enforced Owner/Admin and evolves into the control plane for tenant health, deployments, incidents, backup/restore, security/RBAC, cost/token usage and infrastructure health. Client-side hiding is never authorization.

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
