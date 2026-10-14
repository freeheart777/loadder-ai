# Docker D1 - local development

Development only (`NODE_ENV=development`). It is not a production setup: no TLS, no reverse proxy, SQLite on a local volume.

**Docker data is independent of the repository's tracked `server/db/loadder.sqlite`.** That file is never copied into an image or volume, and nothing here reads or writes it. The stack starts from an empty database created by the application's own schema and migrations.

## Prerequisites
Docker with Compose v2 (Docker Desktop is fine). Nothing else; dependencies are installed inside Linux.

## First and normal startup
```bash
docker compose up --build        # first time, or after dependency/server changes
docker compose up                # afterwards
```
| Service | URL | Notes |
|---|---|---|
| web | http://localhost:5173 | Vite dev server, `src/` and `public/` are bind-mounted (hot reload) |
| server | http://localhost:3001 (API), http://localhost:3002 (public sites) | `server/start.mjs`: API + public-site runtime + commerce outbox worker. Server code is baked into the image: rebuild with `--build` after changing it |

Host ports are loopback-only. If one is taken, set `LOADDER_WEB_PORT`, `LOADDER_API_PORT` and/or `LOADDER_PUBLIC_PORT` (environment or an untracked `.env`); every browser-facing URL, CORS origin and generated link follows them.

The browser calls the API at `http://localhost:<api port>` (never a Docker service name). `AUTH_HASH_SECRET` defaults to a development-only value; override it in an untracked `.env` if you like. Sign-in codes are exposed in API responses (`AUTH_EXPOSE_DEV_OTP`) for development.

## Data
One named volume, `loadder_loadder-data`, mounted at `/data`: `db/` (SQLite + WAL), `site-media/`, `medical-private/`, `object-storage/`. It survives `docker compose down` and container recreation.
```bash
docker compose down              # stop, keep data
docker compose down -v           # stop and DELETE all Docker data (fresh database on next start)
docker compose logs -f server    # logs (also: web)
docker compose ps                # server shows healthy via GET /api/health
```

## Browser tests (Medical / Education)
```bash
docker/e2e.sh medical            # 17 tests
docker/e2e.sh education          # 5 tests
```
Each run uses its own throw-away compose project (`loadder-e2e`) and data volume, so your dev stack and data are untouched and no host ports are needed. Playwright runs inside Linux next to the same `/data` volume because the suites read SQLite directly; do not run them from the host against a database held by a container (WAL across the Docker Desktop VM boundary is unsafe). Screenshots and traces appear in `./test-results`.

## Not in D1
Production image, static frontend build, non-dev secrets, TLS/proxy, PostgreSQL, object storage and horizontal scaling are later milestones (D2/D3).
