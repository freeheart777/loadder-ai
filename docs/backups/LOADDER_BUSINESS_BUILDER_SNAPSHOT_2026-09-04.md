# Loadder Business Builder — GitHub Memory / Recovery Snapshot
Date: 2026-09-04
Branch at snapshot start: `feat/loadder-business-compiler-foundation`
Reference head before snapshot commit: `613868e7c5013b8bbbad35aff4ea94c57cb6425c`

## Permanent product law
- ENGINE BUILDS, AI GUIDES.
- Deterministic Loadder contracts/blueprints/runtime perform supported build/run/edit/restore/export operations.
- AI is optional guidance, teaching, review, proposal and complex-assistance layer.
- Loadder Engineering System (LES) is mandatory: Kaizen, Jidoka, Poka-Yoke, Genchi Genbutsu, Standard Work, Andon, Heijunka, Five Whys, quality-at-source and waste elimination.
- No capability is Done without real UI -> API -> service -> persistence/runtime -> recovery proof where applicable.

## Current owned architecture
User Goal -> Zero-token Navigator -> Deterministic Catalog/Blueprint -> Business Compiler -> LoadderAppDefinition -> UI/Data/Workflow contracts -> Immutable Version -> Runtime -> Intelligence -> Action Ledger -> Human Approval -> Executor -> Outcome.

## Deterministic application families
CRM, Inventory, Booking, Project Operations, Internal Approval Tools, Customer Portal, Logistics Operations and Agency Operations.

## Reliability/security state
- workspace-scoped persistence and runtime
- immutable app versions and restore
- provider-independent export/import bundle
- Action Ledger idempotency
- append-only ordered Action History
- Approval Center backed by real workspace membership RBAC
- Publish Readiness blockers
- canary/health/rollback deployment contracts
- CI gates: Server Tests, Frontend Build, Security Supply Chain run directly on feat/** branches
- database Backup/Restore Drill added for workspace/project/version/runtime/action/audit integrity

## Commercial UX
Minimal path: `چی می‌خوای بسازی؟ -> بساز -> ادیت -> استفاده -> انتشار`.
Visual Editor changes are validated patches and create versions; they do not directly mutate arbitrary application source.

## Production direction
Default low-cost topology: small Web/API + PostgreSQL + Object Storage; queue/ephemeral workers only for bursty build/AI/executor tasks. No default Kubernetes and no dedicated always-on compute per small tenant.

## Recovery rules
1. Git history and this snapshot are project-memory backups, not substitutes for database backups.
2. Production database backups must be encrypted, versioned and stored outside the primary server.
3. Restore drills must verify relational integrity, tenant isolation and append-only audit protections after restore.
4. Production release is blocked if current-head CI/security/recovery gates are red.
5. Provider outage must degrade AI guidance, not supported application runtime.

## Next seven-step production hardening sequence
1. Verify Backup/Restore Drill current-head gates.
2. Freeze this GitHub memory snapshot.
3. Introduce PostgreSQL runtime adapter contract without breaking SQLite development adapter.
4. Add SQLite -> PostgreSQL portability/migration verification path.
5. Add deterministic performance/cost benchmark harness.
6. Add low-cost production deployment profile + readiness checks.
7. Sync Roadmap/LES and re-run exact-head gates before expanding product surface.

This document is a recovery checkpoint. When a major architectural milestone changes, create a new dated snapshot rather than overwriting historical snapshots.
