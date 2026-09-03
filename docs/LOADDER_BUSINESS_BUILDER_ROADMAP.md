# Loadder Business Builder — Canonical Roadmap

> Source of truth. Engineering constitution: `docs/LOADDER_ENGINEERING_SYSTEM.md`. Competitive benchmark memory: `docs/backups/LOADDER_APP_BUILDER_COMPETITIVE_BENCHMARK_2026-09-04.md`.

## North Star
**ENGINE BUILDS, AI GUIDES.** Loadder builds owned, portable business software deterministically wherever possible; AI guides, proposes and explains.

## Competitive ten-gap program — ACTIVE
Benchmark-derived program against leading AI-first, no-code/low-code, internal-tool, mobile and self-hosted builders. `FOUNDATION` means validated contract/test exists; `DONE` requires persistence/runtime/API/UX/recovery/security as applicable plus exact-head Full Gate.

1. **Visual Studio Complete — PARTIAL/P0** — reorder + visibility foundations exist; drag/drop, responsive/page/property UX remain.
2. **App-level Auth & RBAC — FOUNDATION/P0** — Public/Customer/Employee/Manager/Admin policy with entity/action/field authorization contract exists; runtime/auth UX wiring remains.
3. **Integration Hub — FOUNDATION/P0** — REST/Webhook/OAuth/Database/Event validated primitives exist; persistence, connector execution and UI remain.
4. **Blueprint/App Store — FOUNDATION+/P0** — deterministic catalog/install contract, version metadata and zero-token doctrine exist; storefront install UX/persistence remain.
5. **Files/Object Storage — FOUNDATION/P1** — `file` App Definition field type, portable descriptor and bounded upload policy exist; real object-store adapter/signed access/UI remain.
6. **Realtime Data — FOUNDATION/P1** — tenant-safe subscription/delivery, reconnect strategy and poll fallback contract exist; transport/provider wiring remains.
7. **Payments/Commerce Primitive — FOUNDATION/P1** — provider-neutral payment intent/event + idempotency contract exists; provider adapter/webhook persistence/UI remain.
8. **Environment + Git Lifecycle — FOUNDATION/P1** — development->staging->production sequential promotion and production gates exist; persistence/diff/Git sync UX remain.
9. **Shared Native Renderer — FOUNDATION/P1** — iOS/Android target + explicit device capability/signing/store-gate contract exists; renderer/build/sign pipeline remains.
10. **Collaboration — FOUNDATION/P2** — optimistic immutable-version patch/conflict contract exists; presence/comments/rebase UX/persistence remain.

## Competitive rule
Do not copy competitor complexity. Loadder target: simple onboarding + deep business capability + enterprise governance + source/infra ownership + deterministic cost. Provider/native/integration layers remain replaceable adapters.

## Existing differentiation
- deterministic compiler and zero-token supported build/install doctrine;
- immutable versions, portability and provider independence;
- Action Ledger, append-only history, Approval Center and Publish Center;
- PostgreSQL production target, backup/recovery discipline, canary/rollback and artifact integrity;
- tenant-scoped Dashboard/Admin foundations;
- cost/token attribution and AI-offline operation;
- low-cost shared runtime rather than default per-tenant infrastructure.

## Quality / Production hardening
- [x] Fast Gate -> Develop -> Full Gate -> Release
- [x] PostgreSQL adapter/pool/schema + real PostgreSQL CI foundation
- [x] Backup/Restore Drill foundation
- [x] Rate limiting + distributed-store contract
- [x] Deployment history + canary/rollback + checksum
- [x] Isolated worker policy
- [x] Operations Dashboard + server-enforced Owner/Admin Console
- [ ] Provider outage/timeout suite
- [ ] Production PostgreSQL restore drill
- [ ] Real external secrets/distributed limiter/deploy provider
- [ ] Persisted cost/health/security Admin controls

## Next execution order
Finish P0 before broad P1 expansion: Visual Studio Complete -> App Auth/RBAC runtime -> Integration Hub execution -> App Store UX. Then Object Storage -> Realtime -> Payments -> Environment/Git -> Native Renderer. Collaboration follows after immutable multi-user semantics are proven.

## Dashboard/Admin law
Every operational backend capability must expose appropriate visibility: user Dashboard for app/workspace truth and next actions; Admin Console for tenant health, deployment, incident, backup/restore, security/RBAC, cost/token and infrastructure controls. Client hiding is never authorization.

## Canonical topology
`Web/API -> PostgreSQL -> Object Storage -> optional measured distributed limiter/queue -> ephemeral isolated workers`. No default Kubernetes, per-tenant always-on compute, host Docker socket, privileged runtime or host networking.

## Recovery memory
Historical benchmark/snapshot files under `docs/backups/` are immutable-style project memory. Git memory never substitutes for encrypted production database/object-storage backups.
