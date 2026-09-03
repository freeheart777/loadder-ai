# Loadder Business Builder — Canonical Roadmap

> Source of truth. Engineering constitution: `docs/LOADDER_ENGINEERING_SYSTEM.md`. Competitive benchmark memory: `docs/backups/LOADDER_APP_BUILDER_COMPETITIVE_BENCHMARK_2026-09-04.md`.

## North Star
**ENGINE BUILDS, AI GUIDES.** Loadder builds owned, portable business software deterministically wherever possible; AI guides, proposes and explains.

## Competitive ten-gap program — ACTIVE
`FOUNDATION` = validated contract/test. `RUNTIME` = execution path exists. `PRODUCT` = persistence/API/UX exists. `DONE` still requires all applicable recovery/security + exact-head Full Gate.

1. **Visual Studio Complete — PRODUCT-/P0** — page rename/visibility/width, block reorder/visibility/properties, field visibility and theme controls are versioned and exposed in Studio UI. Pointer drag/drop and responsive breakpoints remain.
2. **App-level Auth & RBAC — PRODUCT-/P0** — versioned Public/Customer/Employee/Manager/Admin policy; data/workflow runtime enforcement; tenant/project-scoped app users; hashed expiring sessions; admin user management UI; live runtime resolves only trusted `X-Loadder-App-Token` sessions. Public self-service login/invite UX remains.
3. **Integration Hub — PRODUCT-/P0** — REST/Webhook/OAuth/Database/Event validation, tenant-scoped persistence, provider-neutral execution runtime, CRUD API and management UI exist. OAuth PKCE + signed state + token exchange contract exists. Real provider credentials/callback adapters remain.
4. **Blueprint/App Store — PRODUCT-/P0** — deterministic catalog, zero-token installs, install API and Studio App Store panel exist. Rich previews/categories/version upgrade lifecycle remain.
5. **Files/Object Storage — PRODUCT-/P1** — `file` field type, upload policy, provider-neutral runtime plus a safe self-hosted local object provider with traversal protection, checksums and signed access exist. Metadata persistence/upload UI and optional S3-compatible adapter remain.
6. **Realtime Data — RUNTIME/P1** — tenant-safe subscriptions, reconnect/fallback contract and provider-neutral emit/watch runtime exist. Real SSE/WebSocket transport and client subscription UX remain.
7. **Payments/Commerce Primitive — PRODUCT-/P1** — provider-neutral intent, verified webhook normalization, durable tenant/provider-scoped idempotency persistence and regression coverage exist. External payment provider adapter/checkout UI remain.
8. **Environment + Git Lifecycle — PRODUCT/P1** — sequential dev->staging->production promotion gates, tenant-scoped persistence, API and live-app environment control UI exist. Diff and optional Git synchronization remain.
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
- [x] App-user session tenant/project isolation and hashed-token regression
- [x] OAuth PKCE/state and self-hosted storage security regression
- [x] Environment persistence + product control path
- [x] Durable payment idempotency tenant isolation
- [ ] Provider outage/timeout suite
- [ ] Production PostgreSQL restore drill
- [ ] Real external secrets/distributed limiter/deploy provider
- [ ] Persisted cost/health/security Admin controls

## Next execution order
Finish the remaining product gaps instead of adding breadth: public app-user login/invite flow -> real OAuth callbacks/provider adapters -> storage metadata/upload UX -> SSE/WebSocket realtime transport -> payment provider checkout/webhooks -> Visual Studio pointer drag/drop/responsive breakpoints -> App Store upgrade lifecycle -> Git diff/sync. Native Renderer follows only after shared definition fidelity is proven. Collaboration follows after immutable multi-user semantics are proven.

## Dashboard/Admin law
Every operational backend capability must expose appropriate visibility: user Dashboard for app/workspace truth and next actions; Admin Console for tenant health, deployment, incident, backup/restore, security/RBAC, cost/token and infrastructure controls. Client hiding is never authorization.

## Canonical topology
`Web/API -> PostgreSQL -> Object Storage -> optional measured distributed limiter/queue -> ephemeral isolated workers`. No default Kubernetes, per-tenant always-on compute, host Docker socket, privileged runtime or host networking.

## Recovery memory
Historical benchmark/snapshot files under `docs/backups/` are immutable-style project memory. Git memory never substitutes for encrypted production database/object-storage backups.
