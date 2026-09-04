# Loadder Business Builder — Launch Checklist

Launch standard: **no inferred green, no client-asserted evidence, no provider fiction.** The release SHA must pass the machine-readable `loadder.launch-readiness.v1` gate and the standard production runbook.

## Release Candidate classifications

| Area | Beta launch status | Acceptance evidence |
| --- | --- | --- |
| Deterministic build / blueprint compiler | PASS | Build, edit, preview and restore commercial acceptance tests; zero-AI deterministic path |
| Visual Studio | PASS for Beta | Versioned editor patches, responsive breakpoints and pointer drag/drop; advanced polish continues post-Beta |
| App users / RBAC / invites | PASS | App identity separated from workspace identity; hashed sessions; one-time invites; runtime policy enforcement |
| Public customer app | CONDITIONAL | Feature-gated; only `ready` projects; customer acceptance + session boundary + public rate-limit evidence required before enabling |
| Integration Hub core | PASS | Tenant-scoped definitions/runtime; secrets referenced, not embedded |
| External OAuth vendors | NEEDS_PROVIDER | Provider client IDs/secrets, callback domains and provider-specific acceptance are deployment inputs |
| File/Object Storage | PASS for controlled single-node; NEEDS_PROVIDER for standard production | Self-hosted provider and signed access work; standard production should use S3-compatible durable storage |
| Payments core | PASS | Intent/webhook/idempotency runtime tested |
| Payment processor | NEEDS_PROVIDER if payment is part of launch plan | Real merchant credentials and signed webhook acceptance required |
| Realtime | PASS for single-node Beta | SSE runtime; distributed multi-node transport is POST-BETA unless horizontal scale is enabled |
| Git lifecycle | PASS core / NEEDS_PROVIDER when enabled | Secret-reference connection and GitHub adapter exist; repository credential must be configured |
| Native renderer | POST-BETA launch dependency | Deterministic Expo/React Native source export exists; signing/store pipeline is not required for Web Beta |
| Collaboration | PASS basic / POST-BETA advanced | Persistent comments/version-conflict contract; live presence/advanced rebase can follow Beta |
| PostgreSQL | BLOCKED until deployment evidence | Production launch requires configured PostgreSQL and migration-copy verification |
| Backup / restore | BLOCKED until production drill evidence | SQLite drills are not a substitute for production PostgreSQL restore evidence |
| Secrets | BLOCKED until deployment evidence | Production secrets must be externalized/rotated in environment or secret manager |
| Canary / rollback | BLOCKED until deployment evidence | Synthetic health, canary and automatic rollback must be verified on the target environment |
| Exact-head CI | BLOCKED until green release SHA | Server Tests + Frontend Build + Security Gate + Business Builder Fast Gate must all be green on exact SHA |

## Launch sequence

`freeze SHA -> full CI -> backup -> restore drill -> migration copy -> deploy candidate -> smoke -> canary -> synthetic health -> public app acceptance (if enabled) -> promote -> observe -> close release`

## Web Beta policy

The first commercial release should be **Web/PWA-first** and may launch with public customer apps disabled or selectively enabled. Do not block Web Beta on native store signing, distributed realtime or advanced collaboration. Do block on tenant isolation, exact-head CI, PostgreSQL, secrets, backup/restore, rollback and target-environment health.

## Public App activation

Keep `BUSINESS_BUILDER_PUBLIC_APPS_ENABLED` off by default. Enable only after the release candidate has:
- a `ready` app version,
- public-app acceptance evidence,
- app-session boundary evidence,
- public rate-limit evidence,
- target-origin/CORS verification,
- rollback reference.

## Provider rule

A provider adapter is not a configured provider. OAuth, payment, Git and durable object storage may be marked `NEEDS_PROVIDER` until real credentials/endpoints are supplied and verified in staging. Never convert `NEEDS_PROVIDER` to `PASS` based only on mocks.
