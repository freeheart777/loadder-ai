# Loadder Business Builder — Canonical Roadmap

> Source of truth. Engineering constitution: `docs/LOADDER_ENGINEERING_SYSTEM.md`. Competitive benchmark memory: `docs/backups/LOADDER_APP_BUILDER_COMPETITIVE_BENCHMARK_2026-09-04.md`.

## North Star
**ENGINE BUILDS, AI GUIDES.** Loadder builds owned, portable business software deterministically wherever possible; AI guides, proposes and explains.

## Competitive ten-gap program — ACTIVE
`FOUNDATION` = validated contract/test. `RUNTIME` = execution path exists. `PRODUCT` = persistence/API/UX exists. `DONE` still requires all applicable recovery/security + exact-head Full Gate.

1. **Visual Studio Complete — PRODUCT/P0** — page rename/visibility/width, field visibility, block properties, pointer Drag & Drop and responsive mobile/tablet/desktop layout are versioned and exposed in Studio. Remaining polish: richer component property inspector and responsive preview modes.
2. **App-level Auth & RBAC — PRODUCT/P0** — versioned Public/Customer/Employee/Manager/Admin policy; data/workflow runtime enforcement; tenant/project-scoped app users; hashed expiring sessions; one-time hashed invite exchange; admin user management UI; live runtime resolves only trusted app sessions. Fully public unauthenticated app shell/email delivery provider remains.
3. **Integration Hub — PRODUCT-/P0** — REST/Webhook/OAuth/Database/Event validation, tenant-scoped persistence, provider-neutral execution runtime, CRUD API and management UI; OAuth PKCE + signed state + token exchange contract. Real provider credentials/callback adapters remain.
4. **Blueprint/App Store — PRODUCT/P0** — deterministic catalog, zero-token install, Studio panel and persisted installation/upgrade lifecycle store exist. Rich visual previews/categories and migration-aware upgrade execution remain.
5. **Files/Object Storage — PRODUCT-/P1** — `file` field, upload policy, provider-neutral storage runtime, self-hosted local object provider, signed access and tenant-scoped metadata persistence exist. HTTP upload/download UX and optional S3-compatible adapter remain.
6. **Realtime Data — RUNTIME/P1** — tenant-safe subscriptions, reconnect/fallback and provider-neutral emit/watch runtime exist. SSE/WebSocket transport and client UX remain.
7. **Payments/Commerce Primitive — PRODUCT-/P1** — provider-neutral intent, verified webhook normalization, durable tenant/provider idempotency persistence. External provider adapter/checkout UI remain.
8. **Environment + Git Lifecycle — PRODUCT/P1** — dev->staging->production gates, tenant persistence, API and live-app control UI. Diff and optional Git synchronization remain.
9. **Shared Native Renderer — RUNTIME-/P1** — iOS/Android target contract plus shared-definition native manifest renderer preserving visible screens, entities, workflows and app access policy. Actual React Native/Expo renderer/build/sign/store pipeline remains.
10. **Collaboration — PRODUCT-/P2** — immutable-version conflict contract plus tenant-scoped persisted comments/patch events exist. Presence, apply/rebase workflow and collaborative UI remain.

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
- [x] App-user session/invite tenant/project isolation and hashed-token regression
- [x] OAuth PKCE/state and self-hosted storage security regression
- [x] Environment persistence + product control path
- [x] Durable payment idempotency tenant isolation
- [x] Native definition fidelity regression
- [x] Collaboration/App Store lifecycle tenant-isolation regression
- [x] Responsive/Drag-Drop patch regression
- [ ] Provider outage/timeout suite
- [ ] Production PostgreSQL restore drill
- [ ] Real external secrets/distributed limiter/deploy provider
- [ ] Persisted cost/health/security Admin controls

## Next execution order
Close exact product gaps instead of expanding breadth: public app shell/invite delivery -> real OAuth provider callback adapters -> file HTTP UX -> SSE/WebSocket transport -> real payment checkout provider -> App Store migration-aware upgrades -> environment diff/Git sync -> Native React renderer/build pipeline -> Collaboration UI/presence/rebase. Then run exact-head Full Gate before any `DONE` label.

## Dashboard/Admin law
Every operational backend capability must expose appropriate visibility: user Dashboard for app/workspace truth and next actions; Admin Console for tenant health, deployment, incident, backup/restore, security/RBAC, cost/token and infrastructure controls. Client hiding is never authorization.

## Canonical topology
`Web/API -> PostgreSQL -> Object Storage -> optional measured distributed limiter/queue -> ephemeral isolated workers`. No default Kubernetes, per-tenant always-on compute, host Docker socket, privileged runtime or host networking.

## Recovery memory
Historical benchmark/snapshot files under `docs/backups/` are immutable-style project memory. Git memory never substitutes for encrypted production database/object-storage backups.
