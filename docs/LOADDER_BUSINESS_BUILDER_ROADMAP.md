# Loadder Business Builder — Canonical Roadmap

> Source of truth. Engineering constitution: `docs/LOADDER_ENGINEERING_SYSTEM.md`. Competitive benchmark memory: `docs/backups/LOADDER_APP_BUILDER_COMPETITIVE_BENCHMARK_2026-09-04.md`.

## North Star
**ENGINE BUILDS, AI GUIDES.** Loadder builds owned, portable business software deterministically wherever possible; AI guides, proposes and explains.

## Competitive ten-gap program — ACTIVE
`FOUNDATION` = validated contract/test. `RUNTIME` = execution path exists. `PRODUCT` = persistence/API/UX exists. `DONE` still requires all applicable recovery/security + exact-head Full Gate.

1. **Visual Studio Complete — PRODUCT-/P0** — page rename/visibility/width, block reorder/visibility/properties, field visibility and theme controls are versioned and exposed in Studio UI. Pointer drag/drop and responsive breakpoints remain.
2. **App-level Auth & RBAC — RUNTIME/P0** — versioned Public/Customer/Employee/Manager/Admin policy with entity/action/field rules; data/workflow runtime enforcement exists and fails closed for protected resources. Trusted app-principal authentication UX/session layer remains.
3. **Integration Hub — PRODUCT-/P0** — REST/Webhook/OAuth/Database/Event validation, tenant-scoped persistence, provider-neutral execution runtime, CRUD API and management UI exist. Real provider adapters/OAuth handshake and execution UX remain.
4. **Blueprint/App Store — PRODUCT-/P0** — deterministic catalog, zero-token installs, install API and Studio App Store panel exist. Rich previews/categories/version upgrade lifecycle remain.
5. **Files/Object Storage — RUNTIME/P1** — `file` field type, portable descriptor/upload policy and provider-neutral upload/signed-url/delete runtime exist. Real storage provider, metadata persistence and UI remain.
6. **Realtime Data — RUNTIME/P1** — tenant-safe subscriptions, reconnect/fallback contract and provider-neutral emit/watch runtime exist. Real transport/provider and client subscription UX remain.
7. **Payments/Commerce Primitive — RUNTIME/P1** — provider-neutral intent, checkout adapter, verified webhook normalization and idempotency runtime exist. Durable idempotency store/provider adapter/UI remain.
8. **Environment + Git Lifecycle — PRODUCT-/P1** — sequential dev->staging->production gates plus tenant-scoped environment persistence exist. API/UI, diff and optional Git sync remain.
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
- [x] Integration persistence tenant-isolation regression
- [x] Environment persistence tenant-isolation regression
- [x] Object storage/realtime/payment runtime regression coverage
- [ ] Provider outage/timeout suite
- [ ] Production PostgreSQL restore drill
- [ ] Real external secrets/distributed limiter/deploy provider
- [ ] Persisted cost/health/security Admin controls

## Next execution order
Close remaining P0 gaps before calling them Done: trusted app-user authentication/session layer -> Integration provider execution/OAuth -> richer App Store lifecycle -> pointer drag/drop/responsive breakpoints. Then wire real object storage, realtime transport, durable payments and environment control UI. Native Renderer follows only after shared definition fidelity is proven. Collaboration follows after immutable multi-user semantics are proven.

## Dashboard/Admin law
Every operational backend capability must expose appropriate visibility: user Dashboard for app/workspace truth and next actions; Admin Console for tenant health, deployment, incident, backup/restore, security/RBAC, cost/token and infrastructure controls. Client hiding is never authorization.

## Canonical topology
`Web/API -> PostgreSQL -> Object Storage -> optional measured distributed limiter/queue -> ephemeral isolated workers`. No default Kubernetes, per-tenant always-on compute, host Docker socket, privileged runtime or host networking.

## Recovery memory
Historical benchmark/snapshot files under `docs/backups/` are immutable-style project memory. Git memory never substitutes for encrypted production database/object-storage backups.
