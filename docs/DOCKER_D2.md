# Docker D2: single-server production deployment

One Linux server, one `server` replica, SQLite on a local volume. Not horizontally scalable (see "Limits"). Dev setup is in [DOCKER_D1.md](DOCKER_D1.md); the architecture around it is in [architecture/LOADDER_RUNTIME_ARCHITECTURE_MAP.md](architecture/LOADDER_RUNTIME_ARCHITECTURE_MAP.md).

```
Internet ──443/80──> web (Caddy: TLS, static SPA, routing)
                       ├─ https://APP_HOST/*       static SPA (built by Vite, SPA fallback, hashed assets immutable)
                       ├─ https://APP_HOST/api/*   ──> server:3001 (API)
                       └─ https://SITES_HOST/*     ──> server:3002 (published-site runtime)
server (internal only): API + public-site runtime + outbox worker, started by server/start.mjs
migrate (one-shot):     applies pending migrations before `server` starts
volumes:  loadder-data (/data: db, site-media, medical-private, object-storage), caddy-data (certificates)
```

Only Caddy publishes ports (80, 443). The application and the published sites use **two hostnames**, so user-authored pages never share an origin with the authenticated app. The browser talks to the API on the application origin, so the session cookie is host-only and CORS is not involved.

## Prerequisites
- A Linux host with Docker (Compose v2) and ports 80/443 free.
- Two DNS names pointing at the host: `LOADDER_APP_HOST` (e.g. `app.example.com`) and `LOADDER_SITES_HOST` (e.g. `sites.example.com`). Caddy obtains and renews certificates automatically; the host must be reachable on 80 and 443 for that.
- A Kavenegar SMS account. **Without a real SMS provider nobody can sign in**: the simulator is refused in production by design.
- Accurate system time (OTP expiry, certificates).

## Configure
```bash
cp deploy/.env.production.example deploy/.env.production
chmod 600 deploy/.env.production
$EDITOR deploy/.env.production      # hostnames, AUTH_HASH_SECRET (openssl rand -hex 32), SMS_PROVIDER, KAVENEGAR_API_KEY
```
`deploy/.env.production` is git-ignored and is passed to the containers at runtime only: it is never baked into an image (`.dockerignore` excludes it, and the image history contains no values).

| Setting | Class |
|---|---|
| `LOADDER_APP_HOST`, `LOADDER_SITES_HOST`, `LOADDER_ACME_EMAIL` | Required (compose refuses to start without them) |
| `AUTH_HASH_SECRET` | **Required for boot**; the server refuses to start in production without it |
| `SMS_PROVIDER=kavenegar`, `KAVENEGAR_API_KEY` | **Required for sign-in** (operators, patients, doctors) |
| `LOADDER_STORAGE_SIGNING_SECRET` | Recommended (defaults to `AUTH_HASH_SECRET`) |
| Payment, Google Ads, AI, e-mail variables | Per feature; leave empty if unused |

Derived by compose, do not set: `NODE_ENV=production`, `TRUST_PROXY=1`, `CLIENT_ORIGINS`, `API_PUBLIC_URL`, `PUBLIC_SITE_BASE_URL`, `AUTH_EXPOSE_DEV_OTP=false` (development codes are never exposed in production regardless).

`VITE_API_BASE_URL` is compiled into the web bundle from `LOADDER_APP_HOST`; changing the application hostname means rebuilding the web image.

## First deploy
```bash
export LOADDER_VERSION=$(git rev-parse --short HEAD)
docker compose --env-file deploy/.env.production -f deploy/compose.prod.yaml up -d --build
```
Order of events: images build, `migrate` runs and must exit 0, `server` starts and becomes healthy (`/api/health` and the public-site runtime), then `web` starts and requests certificates. Then verify:
```bash
bash deploy/smoke.sh "$LOADDER_APP_HOST" "$LOADDER_SITES_HOST"
```
The smoke test is read-only (never sends an SMS). It checks TLS, SPA fallback, caching headers, security headers, production mode, no development OTP, anonymous 401 on protected APIs, and the two origins. It prints `otpDelivery`; it must be `configured` before operators can sign in.

The first person to sign in with a mobile number and a name creates their own workspace (self-service sign-up is open by design).

## Upgrade
```bash
git pull   # or checkout the release tag
bash deploy/upgrade.sh
```
It takes a backup (`deploy/backups/pre-upgrade-<sha>/`), builds images tagged with the git SHA, runs the one-shot migration, restarts, waits for health and runs the smoke test. Previous images stay on the host.

## Roll back
Migrations are forward-only. Rolling back code is therefore two independent decisions:
1. **Code only** (no migration ran, or it was backwards compatible): start the previous image, no rebuild needed.
   ```bash
   LOADDER_VERSION=<previous-sha> docker compose --env-file deploy/.env.production -f deploy/compose.prod.yaml up -d
   ```
2. **Data too** (a migration ran and must be undone): restore the pre-upgrade backup, then do (1).
   ```bash
   bash deploy/restore.sh deploy/backups/pre-upgrade-<sha>/loadder-*.sqlite deploy/backups/pre-upgrade-<sha>/files-*.tgz --yes
   ```
   Everything written after the backup is lost; say so before doing this.

## Backup and restore
```bash
bash deploy/backup.sh /path/to/backups        # no downtime
bash deploy/restore.sh <db.sqlite> <files.tgz> --yes   # replaces ALL data; takes a safety backup first
```
- The database is copied with SQLite's online backup API (WAL-safe) and verified with `integrity_check`. **Never `cp` the `.sqlite` file while the server runs.**
- Files (site media, medical documents, object storage) are archived after the database. A file written between the two steps may be orphaned, never lost.
- Backups contain customer data. Copy them off the server, encrypt them at rest, restrict access. Nothing here does off-site copies or retention; schedule `backup.sh` (cron/systemd timer) and ship the output.
- A backup that has never been restored is not verified. `deploy/prod-auth-check.sh` performs a full backup, mutate, restore round trip on throw-away volumes.

## Operations
```bash
docker compose -p loadder-prod --env-file deploy/.env.production -f deploy/compose.prod.yaml ps
docker compose -p loadder-prod ... logs -f server       # JSON logs, rotated (10 MB x 5)
docker compose -p loadder-prod ... restart server       # graceful: up to 40 s to drain
```
Hardening in place: non-root user, read-only root filesystem (writable `/data` and `/tmp` only), all capabilities dropped (Caddy keeps only `NET_BIND_SERVICE`), `no-new-privileges`, init process, restart policy, health checks, memory limit, no published ports except Caddy's, no compiler/test/dev tooling in the images, secrets only at runtime.

## What was validated (local, `*.localhost` with Caddy's internal CA)
| Check | Result |
|---|---|
| Server unit/integration suite incl. production-boot, migrate, backup, boundary tests | `npm test` in `server/` |
| Production boot: no dev OTP, SMS fails closed, no demo customers, clean SIGTERM | `server/test/deploy-scripts-and-production-boot.test.mjs` |
| TLS edge, SPA fallback, caching, headers, API/sites routing | `deploy/smoke.sh` |
| Production-mode sign-in over TLS (Secure/HttpOnly/SameSite=Lax host-only cookie), publishing, sites origin CSP, SMS outage fails closed with no leakage, restart persistence, backup/restore round trip | `deploy/prod-auth-check.sh` |
| Browser suites on the production images and topology (Medical 17, Education 5) | `docker/prod-e2e.sh medical|education` |

The browser suites run with development-style sign-in over plain HTTP (`deploy/compose.test.yaml`) because they obtain codes from the API response; production-mode behaviour is covered by `prod-auth-check.sh`. **Not validated:** a real DNS name with a public certificate, a real SMS provider, x86-64 hardware (tested on arm64; the bundled SQLite binding ships Linux x86-64 and arm64 builds), load, and real payment providers.

## Limits and known gaps
- **Single node.** SQLite, local files, in-memory rate limits and one outbox worker: do not run more than one `server` container or put the volume on network storage.
- **Medical documents are disabled in production** (they answer `503 MEDICAL_STORAGE_NOT_CONFIGURED`) until private encrypted storage and a malware scanner are wired and validated. Everything else in the Medical vertical works.
- Custom customer domains need on-demand TLS (not part of D2).
- `/api/health` and `/api/auth/status` are public and show the environment name, migration list and OTP readiness.
- No off-site backups, retention, metrics or alerting.
