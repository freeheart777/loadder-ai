# Loadder Business Builder — Canonical Roadmap

> Source of truth. Engineering constitution: `docs/LOADDER_ENGINEERING_SYSTEM.md`. Competitive benchmark memory: `docs/backups/LOADDER_APP_BUILDER_COMPETITIVE_BENCHMARK_2026-09-04.md`.

## North Star
**ENGINE BUILDS, AI GUIDES.** Loadder builds owned, portable business software deterministically wherever possible; AI guides, proposes and explains.

## Competitive ten-gap program — ACTIVE
`FOUNDATION` = validated contract/test. `RUNTIME` = execution path exists. `PRODUCT` = persistence/API/UX exists. `DONE` requires applicable recovery/security plus exact-head Full Gate.

1. **Visual Studio Complete — PRODUCT/P0** — page rename/visibility/width, fields, component properties, pointer Drag & Drop and mobile/tablet/desktop responsive layout are versioned and exposed in Studio. Remaining: richer visual property inspector/preview polish.
2. **App-level Auth & RBAC — PRODUCT/P0** — versioned app roles/policies, runtime enforcement, tenant/project app users, hashed expiring sessions, one-time hashed invites, invite-exchange UX, admin user controls and trusted runtime principal resolution. A separate public runtime router now resolves workspace by project server-side and enforces session/public-role policy; public mount remains intentionally gated until exact-head isolation tests pass.
3. **Integration Hub — PRODUCT-/P0** — REST/Webhook/OAuth/Database/Event primitives, tenant persistence, execution runtime, CRUD UI; OAuth PKCE, signed/expiring state and exchange contract. Remaining: real provider callback/credential adapters.
4. **Blueprint/App Store — PRODUCT/P0** — deterministic zero-token install, Studio Store UX, persisted install/version/upgrade lifecycle plus migration-aware upgrade planning. Additive upgrades are safe; destructive entity/field/type changes fail closed without explicit approval. Remaining: rich previews/categories and execution/migration UI.
5. **Files/Object Storage — PRODUCT/P1** — file field, provider-neutral runtime, self-hosted storage, checksum/signed access, tenant metadata, HTTP upload/download/delete API and Live App File Manager UI. Remaining: optional S3-compatible adapter and quotas/lifecycle polish.
6. **Realtime Data — PRODUCT-/P1** — workspace/app/entity event boundary, CRUD event emission, self-hosted SSE transport with heartbeat/cleanup and Live App streaming client preserving app-session headers. Remaining: distributed multi-node transport/presence.
7. **Payments/Commerce Primitive — PRODUCT/P1** — provider-neutral intents/webhooks, durable tenant/provider idempotency, generic HTTPS provider with secret-backed auth + HMAC verification, mounted checkout/status/webhook routes and Live App Checkout UI. If endpoint/secrets are missing the feature returns explicit `PAYMENT_NOT_CONFIGURED`; no fake success. Remaining: configured real provider credentials and provider-specific polish.
8. **Environment + Git Lifecycle — PRODUCT/P1** — persisted dev/staging/prod, API/UI, deterministic environment diff, server-derived Production gates, tenant-scoped Git history and secret-reference-only connections. Provider-neutral sync runtime plus concrete GitHub Contents API adapter now exist; repository/path validation is enforced and tokens resolve only through Secret Resolver. Remaining: Git connection UI and release evidence persistence.
9. **Shared Native Renderer — PRODUCT-/P1** — iOS/Android manifest API plus deterministic 0-token portable Expo/React Native source bundle and Live App export UI. Remaining: pinned native toolchain, actual build/sign/TestFlight/App Store/Android signing gates.
10. **Collaboration — PRODUCT/P2** — tenant-scoped persisted comments/patch activity, immutable-version conflict semantics and Live App collaboration UI. Remaining: presence and approved apply/rebase workflow.

## Security / quality corrections
- Production environment promotion evidence is server-derived only; client booleans are ignored.
- App runtime role is resolved only from trusted hashed app-session token, never a client role header.
- Public runtime workspace context is resolved server-side from project ownership before domain access.
- Invite tokens are one-time, hashed, project/workspace-scoped and expiry bounded.
- File signed access verifies key/expiry/signature; metadata is workspace scoped.
- SSE subscriptions pass app access policy and clean up listeners/heartbeats on disconnect.
- Git credentials are never stored in app definitions or Git connection rows; only secret references are persisted.
- Payment checkout is fail-closed when provider endpoint/secrets are absent.
- Destructive blueprint upgrades require explicit approval.
- Deterministic native/source generation remains 0 AI tokens.

## Admin control plane
Owner/Admin UI includes Business Builder health status, incident list and counters for failed deployments, pending actions, disabled app users, expired invites, payment events, active files, Git sync failures and collaboration activity. High-severity deployment failure degrades workspace health visibly.

## Quality / Production hardening
- [x] Fast Gate -> Develop -> Full Gate -> Release
- [x] Fast Gate imports/tests/types benchmark product surfaces and migrations 05x/06x
- [x] PostgreSQL adapter/pool/schema + real PostgreSQL CI foundation
- [x] Backup/Restore Drill foundation
- [x] Rate limiting + distributed-store contract
- [x] Deployment history + canary/rollback + checksum
- [x] Isolated worker policy
- [x] Operations Dashboard + server-enforced Owner/Admin Health Console
- [x] Auth/invite/OAuth/storage/realtime/payment/environment/native/collaboration/Git regression foundations
- [x] Public-app tenant/project credential isolation regression foundation
- [x] Migration-aware App Store upgrade regression foundation
- [x] GitHub secret/path safety regression foundation
- [ ] Exact-head public-router mount after Fast Gate evidence
- [ ] Provider outage/timeout suite
- [ ] Production PostgreSQL restore drill
- [ ] Real external secrets/distributed limiter/deploy provider
- [ ] Persisted cost telemetry dashboard and incident acknowledgement lifecycle

## Next execution order
Stop expanding breadth. Next: exact-head Fast Gate -> mount public app router before Loadder auth -> public frontend shell -> OAuth provider callbacks -> Git connection UI -> native pinned build/sign pipeline -> collaboration presence/apply/rebase -> multi-node realtime. Run exact-head Full Gate before any `DONE` label.

## Dashboard/Admin law
Every operational backend capability must expose appropriate visibility: user Dashboard for app/workspace truth and next actions; Admin Console for tenant health, deployment, incident, backup/restore, security/RBAC, cost/token and infrastructure controls. Client hiding is never authorization.

## Canonical topology
`Web/API -> PostgreSQL -> Object Storage -> optional measured distributed limiter/queue -> ephemeral isolated workers`. No default Kubernetes, per-tenant always-on compute, host Docker socket, privileged runtime or host networking.

## Recovery memory
Historical benchmark/snapshot files under `docs/backups/` are immutable-style project memory. Git memory never substitutes for encrypted production database/object-storage backups.
