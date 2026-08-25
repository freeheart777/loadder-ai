# Controlled Production Deployment Runbook

This runbook defines Loadder's first controlled-production deployment contract. It is provider-neutral and is intended for one ordinary Linux VPS or equivalent single-instance host. It does not authorize a deployment, DNS change, provider call, migration, or release.

## Architecture and release posture

Use one HTTPS reverse proxy, one statically served frontend build, one writable Node backend process, and one persistent local filesystem:

```text
Internet
  -> HTTPS reverse proxy / platform edge
     -> app.loadder.ir static frontend (`dist/`)
     -> app.loadder.ir/api/* -> 127.0.0.1:3001
     -> pages.loadder.ir published artifacts / public host router
  -> one writable Loadder backend
     -> /var/lib/loadder/db/loadder.sqlite
     -> /var/lib/loadder/artifacts/experiences
     -> /var/lib/loadder/artifacts/public
     -> /var/lib/loadder/backups
```

Exactly one writable backend is supported. Set `LOADDER_INSTANCE_COUNT=1`. Do not add replicas, horizontal autoscaling, Redis, Kubernetes, object-storage migration, or a second SQLite writer. The controlled-launch feature policy remains code-owned and active whenever `NODE_ENV=production`.

Recommended first topology: `VPS_SINGLE_INSTANCE_RECOMMENDED`. It has the fewest moving parts while matching the existing persistence, publishing, cookie, and backup contracts. No GPU is required.

## Runtime, install, build, and start

The verified runtime is Node `22.23.2` (see `.nvmrc`) with npm `10.x`. Vite 8 and the current server syntax require a modern Node runtime; do not silently substitute an older system Node.

The repository has two locked package trees. Install both from a clean checkout; never copy macOS `node_modules` to production:

```sh
nvm use
npm ci
npm --prefix server ci
```

Build the frontend only after setting its public production API URL:

```sh
NODE_ENV=production VITE_API_BASE_URL=https://app.loadder.ir npm run build
```

The frontend output is `dist/`. The canonical backend entrypoint is `server/index.mjs`; start it from the repository root with:

```sh
npm run start:server
```

The backend accepts `API_PORT` first, then `PORT`, and defaults to `3001`. For the recommended reverse-proxy topology set `API_HOST=127.0.0.1` and `API_PORT=3001`; the backend port must not be public. If a container platform requires direct container networking, explicitly use `API_HOST=0.0.0.0` and its injected `PORT`, leaving `API_PORT` unset. Local development keeps the existing loopback defaults.

Use systemd or the selected platform supervisor to restart the backend after failure and send `SIGTERM` with a bounded stop timeout. The current process writes logs to stdout/stderr and does not require a log file or a log-rotation dependency.

## Filesystem and permissions

Keep immutable application code separate from mutable data:

```text
/srv/loadder/app/                         release checkout and dist/
/var/lib/loadder/db/loadder.sqlite        canonical SQLite database
/var/lib/loadder/artifacts/experiences/   LANDING_STATIC_DIRECTORY
/var/lib/loadder/artifacts/public/        PUBLIC_STATIC_DIRECTORY
/var/lib/loadder/backups/                 LOADDER_BACKUP_DIR
```

The application OS user must be able to traverse and write the database directory and both artifact directories. The backup directory must be persistent, non-public, outside both artifact roots, and writable only by the application/operator roles that execute backups. The SQLite file, WAL/SHM files, environment files, and backups must never be web-served.

Do not place mutable data in `/tmp`, the repository checkout, `dist/`, or a container ephemeral layer. A redeploy replaces `/srv/loadder/app` only and mounts/reuses `/var/lib/loadder`. Do not ship the tracked development database, `.env`, tests, backup files, `.git`, or local `node_modules` as release artifacts.

## Production environment contract

Store server secrets in a non-public, untracked environment file with restrictive OS permissions or in the host's secret manager. Never put server secrets in `VITE_*` variables.

| Variable | Class | Controlled-launch value/posture |
| --- | --- | --- |
| `NODE_ENV` | `OPERATIONAL_CONTROL` | exactly `production` |
| `API_HOST` | `PUBLIC_CONFIG` | `127.0.0.1` behind the same-host proxy |
| `API_PORT` or `PORT` | `PUBLIC_CONFIG` | one explicit internal port; do not set conflicting values |
| `VITE_API_BASE_URL` | `PUBLIC_CONFIG` | `https://app.loadder.ir` for same-origin `/api` |
| `CLIENT_ORIGINS` | `PUBLIC_CONFIG` | exactly `https://app.loadder.ir`; no wildcard/local/credentials |
| `AUTH_HASH_SECRET` | `SECRET` | unique high-entropy value, at least 24 characters |
| `DATABASE_PATH` | `PATH` | `/var/lib/loadder/db/loadder.sqlite` |
| `LANDING_STATIC_DIRECTORY` | `PATH` | `/var/lib/loadder/artifacts/experiences` |
| `LANDING_PUBLIC_BASE_URL` | `PUBLIC_CONFIG` | safe HTTPS artifact origin, initially `https://pages.loadder.ir` |
| `LANDING_PUBLIC_API_BASE_URL` | `PUBLIC_CONFIG` | `https://app.loadder.ir` |
| `LANDING_TRACKING_SECRET` | `SECRET` | unique high-entropy value, at least 24 characters |
| `PUBLIC_STATIC_DIRECTORY` | `PATH` | `/var/lib/loadder/artifacts/public` |
| `PUBLIC_BASE_URL` | `PUBLIC_CONFIG` | safe HTTPS public origin, initially `https://pages.loadder.ir` |
| `LOADDER_BACKUP_DIR` | `PATH` | `/var/lib/loadder/backups` |
| `LOADDER_INSTANCE_COUNT` | `OPERATIONAL_CONTROL` | exactly `1` |
| `LOADDER_PERSISTENCE_VALIDATED` | `OPERATIONAL_CONTROL` | `false` until real restart/redeploy/restore drills pass |
| `LOADDER_ALLOW_PRODUCTION_MIGRATIONS` | `OPERATIONAL_CONTROL` | normally `false`; temporarily `true` only in the migration runbook |
| `OPENAI_API_KEY` | `SECRET` | required for launch-visible Growth/Content readiness; never probed automatically |
| `AUTH_EXPOSE_DEV_OTP` | `OPERATIONAL_CONTROL` | `false` |
| `LOADDER_SEED_DEMO_DATA` | `OPERATIONAL_CONTROL` | `false` |

Optional hidden providers (`R2`, payment, shipping, marketplace, domains, uploads) remain unconfigured for the controlled launch. `LOADDER_INTERNAL_ACCESS_TOKEN` is secret and is not required for customer launch. Manual billing remains the commercial posture.

The integrated SMS.ir Verify adapter uses `SMS_IR_API_KEY` (`SECRET`), `SMS_IR_OTP_TEMPLATE_ID` (`PUBLIC_CONFIG`), and `SMS_IR_OTP_PARAMETER` (`PUBLIC_CONFIG`, default `CODE`). The rejected template `850415` must not be used. Configure only an explicitly approved replacement template; environment presence remains `CODE_READY_LIVE_VALIDATION_PENDING` until a real OTP is received and verified through the canonical Auth flow.

## Frontend, API, cookies, and proxy routing

Use `https://app.loadder.ir` for both the SPA and API from the browser. Build with `VITE_API_BASE_URL=https://app.loadder.ir`, proxy `/api/*` to the one backend, and set `CLIENT_ORIGINS=https://app.loadder.ir`. This avoids cross-site cookie behavior and is compatible with the existing `Secure`, `HttpOnly`, `SameSite=Lax` session cookie.

Proxy order is mandatory:

1. `/api/*` goes to the backend and is never handled by SPA fallback.
2. Explicit published Website/Landing hosts and paths go to their serving layer and are never handled by SPA fallback.
3. Existing static frontend files are served from `dist/`.
4. Remaining authenticated frontend routes, including direct `/dashboard/...` requests, fall back to `dist/index.html`.

Cache hashed frontend assets for a long duration; do not give `index.html` an immutable cache policy. Preserve the backend's bounded cache/CSP behavior for public artifacts. The reverse proxy must terminate HTTPS, preserve `Host` for public-host resolution, and add `X-Content-Type-Options: nosniff` and an appropriate `Referrer-Policy`. Add HSTS only after HTTPS is proven. Do not weaken the artifact CSP or add a frame policy that conflicts with the backend response.

The application accepts JSON up to 2 MiB generally, 40 KiB for public forms, and 8 KiB for public landing events. Set the proxy body limit at or above legitimate application limits, not below them. Governed Content AI uses a 25-second application timeout and Growth uses 40 seconds, so use a bounded proxy timeout with modest overhead above 40 seconds (for example 50 seconds), never an unbounded timeout. WebSocket support is not required.

`LANDING_STATIC_DIRECTORY` contains direct Landing and Website renderer artifacts. `PUBLIC_STATIC_DIRECTORY` contains activated public/domain publication trees. The serving layer must map the configured HTTPS base URLs to the correct persistent root without exposing sibling database or backup directories. Current custom-domain TLS provisioning remains unavailable; use only the operator-controlled Loadder-owned publication hostname for initial smoke. Do not enable customer custom domains.

For the initial `pages.loadder.ir` host, map only the generated `/landings/*` and `/experiences/*` file paths to `LANDING_STATIC_DIRECTORY`, require exact-file matches, and return 404 instead of SPA fallback on misses. Preserve `Host` and route future friendly/custom-domain paths through the backend public-host router, which resolves activated trees from `PUBLIC_STATIC_DIRECTORY`; never expose the raw `/publications/*` storage namespace. This mapping is an operator/reverse-proxy prerequisite—configuration values alone do not prove publication is live.

## Startup and readiness gate

The effective startup sequence is:

1. load environment;
2. validate production boot configuration and persistence contract;
3. open SQLite and enable WAL/foreign keys;
4. create/check `schema_migrations`;
5. if migrations are pending, require explicit production approval and create a validated backup before applying any migration;
6. construct services and product policy;
7. listen on the explicit host/port.

Before starting a release, run from the repository root with the production environment loaded:

```sh
npm run persistence:preflight
```

The preflight checks absolute safe paths, single-instance posture, directory writability, SQLite integrity, foreign keys, and migration state. Production misconfiguration fails boot with a non-zero exit. Do not route customer traffic merely because the process is live.

Probe `GET /api/health`. Its bounded public response distinguishes boot readiness, core-launch readiness, configured/not-probed AI, publishing posture, persistence posture, controlled-launch policy, and database migration state without returning secret values or filesystem paths. Traffic admission requires:

- process reachable;
- `configuration.bootReady=true`;
- `configuration.coreLaunchReady=true` for the full core launch claim;
- database status ready and migration count expected;
- auth live validation complete;
- required Website/Landing publication configured;
- controlled-launch policy active.

Until SMS live validation and real persistence drills pass, readiness must remain degraded/pending rather than being overridden. Never set `LOADDER_PERSISTENCE_VALIDATED=true` during code preparation.

## First database and migrations

Prefer a fresh production database for the first real customer launch. Migrations construct the canonical schema; do not copy development/demo customers. No default admin exists: the first user follows the normal OTP account creation path after live SMS validation, with no backdoor credentials.

Current code/database baseline is migration 69. For a fresh empty target or any target with pending migrations:

1. provision persistent directories and an empty/approved database target;
2. keep traffic off;
3. run persistence preflight where applicable;
4. create and validate an operator backup for any non-empty target;
5. temporarily set `LOADDER_ALLOW_PRODUCTION_MIGRATIONS=true` for the controlled start;
6. start exactly one backend and allow the canonical migrator to apply pending versions transactionally after its automatic backup gate;
7. verify health, integrity, foreign keys, and expected migration count;
8. stop and return `LOADDER_ALLOW_PRODUCTION_MIGRATIONS=false` for normal operation;
9. restart and smoke before admitting traffic.

If transferring an approved existing database, stop its writer, make a SQLite-safe backup, verify checksum/integrity/FK/migrations, transfer the backup securely, restore to a new explicit production path, and validate it before boot. Never copy a live WAL-mode database with an ordinary file copy.

For every later migration use this order: backup -> validate checksum/integrity/FK -> enable migration approval for one controlled deployment -> deploy/start -> migrate -> disable approval -> health -> smoke.

## Backup, restore, restart, redeploy, and rollback

Create a SQLite-safe backup with:

```sh
npm run persistence:backup
```

Capture its bounded JSON result and checksum without publishing the backup path. Keep protected off-host retention in addition to the local persistent backup directory.

Restore only while the production writer is stopped, and first restore into an isolated staging path:

```sh
node server/scripts/restore-database.mjs /absolute/backup.sqlite /absolute/staging-restored.sqlite EXPECTED_SHA256
```

Verify boot, integrity, foreign keys, migrations, a known safe record count, and artifact linkage. Never overwrite the live database during a drill.

Restart validation: create a canonical record and Website/Landing artifacts, stop/start the same process with the same volume, then verify the database and both artifacts persist. Redeploy validation: build release B in a new application directory, stop release A, mount/reuse the same `/var/lib/loadder`, start B, and repeat health/data/artifact checks. Only after restart, redeploy, backup, and isolated restore all pass may an operator set `LOADDER_PERSISTENCE_VALIDATED=true`.

Rollback is manual: stop traffic and the process, retain the failed state, restore the previous application revision, and restore the validated pre-migration backup only when schema/data rollback is actually required. Boot one writer, verify health and smoke, then restore traffic. Do not automate destructive rollback.

## Production smoke plan

Execute only after a real HTTPS staging/production candidate exists:

- Website: create, publish, GET its public URL, verify 200 and expected checksum/content, then repeat after restart and redeploy.
- Landing: create, publish, GET its public URL, verify 200 and expected checksum/content, then repeat after restart and redeploy.
- Form/CRM: submit one bounded form from a published page, verify success and one CRM lead, and verify an idempotent retry does not duplicate state.
- OpenAI: perform exactly one bounded Growth Strategy generation and one bounded Content generation. Record success/failure, latency, and normalized usage only; do not retain raw provider payloads.
- SMS OTP: after an explicitly approved replacement template is configured, send one real OTP, receive it on a controlled phone, verify it through the canonical Auth flow, and confirm session creation. Then consider restricting the SMS.ir key to the stable production egress IP.
- Mobile: test 320, 375, 390/414, tablet, and desktop widths; use an actual phone before RC. Verify auth, dashboard drawer, workspace switching, logout, and all core launch routes.
- Production E2E: auth -> onboarding -> Growth/Content -> Website/Landing publish -> public fetch -> form -> CRM, while hidden features remain denied.

No provider smoke runs automatically at boot or during deployment preparation.

## Network and operations

Expose only TCP 80/443 publicly. Redirect 80 to 443. Keep the backend port private and restrict SSH to operators. The backend needs outbound HTTPS for OpenAI and, after integration, SMS.ir. SQLite and backup files have no network listener.

Run as a non-root application user after directory setup. Use the platform/system journal for stdout/stderr retention and rotation. Logs must not contain environment values, provider payloads, OTPs, customer payloads, or credentials.

For a small controlled cohort, begin with a general-purpose 2-vCPU class, roughly 4 GiB RAM, and persistent SSD storage with at least 40 GiB usable capacity plus protected off-host backup capacity. These are conservative operational starting points, not benchmark-proven limits. Monitor database/artifact/backup growth and keep enough headroom for multiple releases, WAL activity, temporary build space, and several backup generations.

## Release-candidate operator checklist

- [ ] One writable backend and `LOADDER_INSTANCE_COUNT=1`.
- [ ] Node version matches `.nvmrc`; both lockfiles installed with `npm ci`.
- [ ] Production frontend built with the final safe HTTPS API origin.
- [ ] Code and `/var/lib/loadder` are separate; all mutable paths are persistent and writable.
- [ ] Backup directory is non-public and does not overlap artifact roots.
- [ ] `NODE_ENV=production`; dev OTP/demo seed disabled; no internal tools exposed.
- [ ] Exact `CLIENT_ORIGINS`; same-origin cookie/API route verified.
- [ ] `/api` proxy precedence, SPA fallback, and published-host routing verified.
- [ ] TLS, security headers, request limits, and proxy timeout verified.
- [ ] Persistence preflight, backup checksum, integrity, FK, and migration count pass.
- [ ] Migration approval is false outside the controlled migration window.
- [ ] Health is truthful; no operator flag is used to conceal an external blocker.
- [ ] OpenAI, SMS, publication, restart/redeploy/restore, mobile, and E2E smokes recorded.
- [ ] Rollback revision and validated backup identified before traffic.

Remaining external inputs are the selected server/volume, final hostnames and TLS, restricted production secrets, production OpenAI configuration, an approved replacement SMS.ir template and live OTP smoke, publication routing, persistence drills, real-device validation, and production E2E. Growth and Content provider paths are already live-validated; DNS and resource provisioning are intentionally outside this preparation phase.
