# Loadder runtime architecture map

Snapshot of the code at commit `5f62b94` (branch `automation/loadder-roadmap`). Companion documents:
[dependency audit](LOADDER_DEPENDENCY_AUDIT.md) · [Graphify workflow](LOADDER_GRAPHIFY_WORKFLOW.md) ·
[domain capability map](LOADDER_DOMAIN_CAPABILITY_MAP.md) · [Docker D1](../DOCKER_D1.md).

This map describes **implemented behaviour found in source**, not intended design. Where it could not be confirmed, the relationship is marked.

## Evidence legend

| Tag | Meaning |
|---|---|
| **[G]** | Static import/export edge, `EXTRACTED` in the Graphify graph (file and line anchored). Reproducible with `get_neighbors`. |
| **[S]** | Confirmed by reading the cited source lines. |
| **[I]** | Inferred, e.g. an HTTP path string matched between frontend and server, or a graph edge marked `INFERRED`. Plausible, not proven. |
| **[U]** | Unverified. Stated so a future reader does not mistake it for fact. |

**Blind spots (apply to every diagram):** Graphify sees imports, calls and containment only. It does **not** see HTTP calls between `src/` and `server/`, SQL tables/queries, Express route-to-handler wiring by path string, runtime configuration, or anything in `server/test/` and `e2e/` (excluded from the graph on purpose). Those links below are [S] or [I].

---

## 1. System / runtime topology

Two halves: the Vite/React frontend in `src/` and the Node/Express backend in `server/`. The backend is **three OS processes** started by one supervisor.

```mermaid
flowchart LR
  B["Browser"]
  subgraph FE["Frontend (src/)"]
    SPA["React SPA<br/>src/main.tsx, src/App.tsx"]
  end
  subgraph BE["Backend (server/), started by server/start.mjs"]
    SUP["supervisor<br/>server/start.mjs<br/>server/process-supervisor.mjs"]
    API["API process<br/>server/index.mjs :3001"]
    PUB["Public-site runtime<br/>server/public-site-server.mjs :3002"]
    OBX["Commerce outbox worker<br/>server/commerce-outbox-worker.mjs"]
  end
  DB[("SQLite WAL<br/>server/db/database.mjs")]
  FS[["Local files<br/>site media, medical private,<br/>object storage"]]
  B -->|"HTML, JS"| SPA
  SPA -->|"fetch /api/* via src/lib/api.ts [I]"| API
  B -->|"published pages /sites/:id, /preview/sites/:id"| PUB
  SUP -->|spawn| API
  SUP -->|spawn| PUB
  SUP -->|spawn| OBX
  API --> DB
  PUB --> DB
  OBX --> DB
  API --> FS
```

- Supervisor spawns the three children [S: `server/start.mjs:4-8`]. `npm run dev` (root `package.json`) instead runs Vite, `node --watch server/index.mjs` and `node --watch server/public-site-server.mjs` side by side [S]; the worker is **not** part of that dev command.
- All three processes open the same SQLite file through `server/db/database.mjs` (WAL, foreign keys on) [S]. Only `server/index.mjs` runs migrations (`runMigrations(db)`) [S].
- Published sites are reachable two ways: the SPA routes `/site/:id`, `/store/:id` rendered client-side [S: `src/App.tsx`], and the server-rendered runtime `/sites/:id`, `/preview/sites/:id`, plus Host-based custom domains [S: `server/app/routes/public-sites.mjs`].
- Health: `GET /api/health` only. The public-site runtime has no health route [S].

## 2. API request pipeline (tenant and auth order)

The order of `app.use(...)` in `server/index.mjs` *is* the security model. [S: `server/index.mjs` lines ~221-453, 3537]

```mermaid
flowchart TD
  R["Request"] --> M1["cors, json body limit<br/>index.mjs ~221-233"]
  M1 --> PUBAUTH["/api/auth router (PUBLIC, no session)<br/>createAuthRouter in routes/auth.mjs"]
  M1 --> HEALTH["GET /api/health (public)"]
  PUBAUTH --- NOTE1["also hosts public site, booking,<br/>storefront, patient, doctor,<br/>consultation, medical-document APIs [S]"]
  M1 --> RA["createRequireAuth(authService)<br/>index.mjs:385"]
  RA --> WS["/api/workspaces, /api/platform-admin"]
  RA --> RW["createRequireWorkspace(identityRepository)<br/>index.mjs:397"]
  RW --> TC["runWithWorkspace(req.workspace.id)<br/>AsyncLocalStorage, app/tenant-context.mjs, index.mjs:399"]
  TC --> DOM["domain routers under /api<br/>business-profile, brand-book, forecasts,<br/>growth-*, mission-control, legacy CRM ..."]
  TC --> AIR["aiRouter  routes/ai.mjs:453"]
  AIR --> CC["canonical-commerce router"]
  AIR --> BB["business-builder router"]
  AIR --> SB["site-builder-runtime.mjs<br/>mountSiteBuilderControlPlane"]
```

- `routes/ai.mjs` imports `openai` and the Cloudflare agent executor **and** mounts `canonicalCommerceRouter`, `businessBuilderRouter` and `siteBuilderRouter` [S: `server/app/routes/ai.mjs:2-8,198-200`; G: `site-builder-runtime.mjs` ← `ai.mjs`]. Core builder, commerce and operator-booking APIs are therefore wired *through the AI router file*. See audit finding F1.
- `requireWorkspaceId()` throws when no workspace is in the async context [S: `server/app/tenant-context.mjs:9-15`], so repository code fails closed outside a tenant context.

## 3. Frontend → API → service → repository → database

```mermaid
flowchart LR
  P["page / component<br/>src/pages, src/components"] --> L["src/lib/api.ts<br/>apiFetch, global fetch patch"]
  L -. "HTTP: not visible to graph [I]" .-> RT["route<br/>server/app/routes/*.mjs"]
  RT --> SV["service<br/>server/app/services, commerce, ..."]
  RT --> RP["repository<br/>server/app/repositories"]
  SV --> RP
  RP --> TC2["tenant-context.mjs<br/>requireWorkspaceId"]
  RP --> DBW["server/db/workspace-database.mjs<br/>or raw server/db/database.mjs"]
  DBW --> SQL[("SQLite<br/>106 migration files in server/db/migrations")]
```

Worked example, **site projects** (the most-called API family: ~114 string-literal call sites in `src/`, [I]):
`src/pages/StoreWebsiteStudioPageV16Core.tsx` → `src/lib/api.ts` → `/api/site-projects` [I] → `server/app/routes/site-projects.mjs` → `services/site-project-service.mjs` → `repositories/site-project-repository.mjs` → `site-platform/publish-manifest.mjs` [G for every server-side hop].

Layer facts: routes depend on services (75 file edges) more than on repositories directly (15) [G, aggregate]; `src/pages` depends on `src/lib` 95 times, and 86 files import `src/lib/api.ts` [G].

## 4. Website Studio and publishing

```mermaid
flowchart TD
  WP["WebsiteProjectsPage<br/>src/pages/WebsiteProjectsPage.tsx"] -->|"websiteStudioPath()"| ST["Website Studio<br/>src/pages/StoreWebsiteStudioPageV16Core.tsx"]
  ST --> CV["StudioCanvas, StudioToolbar, InspectorPanel<br/>src/components/store-studio-v16"]
  ST -->|"/api/site-projects [I]"| SP["routes/site-projects.mjs"]
  SP --> SPS["services/site-project-service.mjs"]
  SPS --> SPR["repositories/site-project-repository.mjs"]
  SPR --> PM["site-platform/publish-manifest.mjs<br/>capability manifest"]
  SP --> CR["site-platform/capability-resolver.mjs"]
  PUB2["public-site-server.mjs"] --> PS["routes/public-sites.mjs"]
  PS --> HTML["services/corporate-site-html.mjs<br/>services/store-site-html.mjs"]
  PS --> RC["site-platform/runtime-capabilities.mjs"]
  ST -->|"controlCenterPath()"| CCP["ControlCenterPage<br/>src/pages/ControlCenterPage.tsx"]
  CCP -->|"publicSitePath()"| PUBSPA["/site/:id, /store/:id (SPA)"]
```

- Every server-side edge is [G] (e.g. `site-project-repository` → `publish-manifest`, `routes/public-sites` → the two HTML renderers).
- Studio ↔ Control Center ↔ public-site navigation is centralised in `src/components/control-center/modules.ts` (`controlCenterPath`, `websiteStudioPath`, `publicSitePath`, `bookingManagementPath`) and consumed by `StoreWebsiteStudioPageV16Core.tsx`, `WebsiteProjectsPage.tsx`, `DashboardPage.tsx` [G].
- Publishing content-to-snapshot semantics (versions, `getPublishedPublic`) live in repository SQL and were **not** traced here [U].
- Draft preview uses a hashed token against `repository.getPreviewByToken` [S: `routes/public-sites.mjs`].

## 5. Medical / Education shared Booking

One Control Center shell and one Booking engine; verticals only add modules and vocabulary.

```mermaid
flowchart TD
  CCPg["ControlCenterPage.tsx"] --> SH["ControlCenterShell.tsx"]
  CCPg --> REG["VERTICAL_MODULES registry<br/>MEDICAL, EDUCATION"]
  REG --> MM["MedicalModules.tsx"]
  REG --> EM["EducationModules.tsx"]
  MM --> BP["BookingPanels.tsx<br/>useBookingAdmin + 4 panels"]
  EM --> BP
  BSP["BookingStudioPage.tsx<br/>workspace-level"] --> BP
  BP --> BR["bookingRequest.ts<br/>pins siteProjectId"]
  CCPg --> MOD["modules.ts<br/>capability registry + vocabulary"]
  BP -. "/api/booking [I]" .-> BK["server/app/routes/booking.mjs"]
  BK --> BRP["repositories/booking-repository.mjs"]
  BRP --> BS["services/booking-scope.mjs<br/>legacy | compat | strict"]
  BK --> WA["workspace-authorization.mjs<br/>operator-only status changes"]
```

- All frontend edges [G] (`src/components/control-center/*`, `src/pages/ControlCenterPage.tsx`, `src/pages/BookingStudioPage.tsx`).
- Server: `routes/booking.mjs` → `booking-repository.mjs` → `booking-scope.mjs` [G]; mounted by `site-builder-control-plane.mjs:85` [S]. Importers of the repository: `routes/booking.mjs`, `routes/auth.mjs`, `services/booking-identity.mjs`, `site-builder-control-plane.mjs`, `public-site-server.mjs` [G].
- Scope rules (Medical strict, others compat, no id = legacy) are documented in `docs/architecture/ADR-005-medical-vertical-phase0.md` and implemented in `booking-scope.mjs` [S].
- Medical and Education modules import only `BookingPanels`, `ui`, `modules` and `lib/api`; neither imports the other [G].

## 6. Commerce and payment lifecycle (structure only)

```mermaid
flowchart TD
  PUBSF["public storefront routes<br/>inside routes/auth.mjs /storefront/* [S]"] --> ES["services/ecommerce-service.mjs"]
  ECR["routes/ecommerce.mjs (operator)"] --> ES
  ECR --> PAS["commerce/payment-attempt-service.mjs"]
  ECR --> RF["commerce/v2/refund-service.mjs"]
  ECR --> FL["commerce/v2/financial-ledger.mjs"]
  CCM["routes/canonical-commerce.mjs"] --> ES
  PPA["commerce/payment-provider-activation-service.mjs"] --> PAD["commerce/payment-adapters.mjs"]
  PAD --> ZP["commerce/zarinpal-payment-provider.mjs"]
  PVS["commerce/payment-verification-service.mjs"] --> PAD
  PVS --> PAS
  OW["business-builder/commerce-outbox-worker.mjs"] --> BR2["commerce-runtime-bridge.mjs"]
  BR2 --> EP["commerce-event-processor.mjs, commerce-runtime-handlers.mjs"]
  BBP["business-builder/payment-router.mjs"] --> HPP["http-payment-provider.mjs, secret-resolver.mjs"]
```

- All edges above are [G] file imports. The state machine (order, payment attempt, refund transitions), the callback and verification order, and idempotency behaviour were **not** traced [U].
- Two commerce code families exist: `server/app/commerce` (canonical store commerce) and `server/app/business-builder` (`payment-router`, `commerce-*` for generated business apps). Whether they share or duplicate behaviour is [U]; see audit finding F5.
- Payment callback URLs are derived from `req.protocol` and `Host` (`routes/auth.mjs:50-51`), which is why `TRUST_PROXY` matters behind TLS [S].

## 7. Intelligence and growth loop (structure only)

`server/index.mjs` instantiates and mounts about 30 intelligence/growth routers, each created from services and repositories built inline in the same file [S: `server/index.mjs` ~345-540].

```mermaid
flowchart LR
  IDX["server/index.mjs<br/>composition root, 3681 lines"] --> RTS["routers: forecasts, integrations, knowledge,<br/>listening, semantic, recommendations,<br/>human-governance, business-state, mission-control,<br/>experiments, growth-assessment/copilot/lead-evidence/content"]
  RTS --> SVC["services + repositories<br/>app/listening, app/semantic, app/recommendations,<br/>app/experiments, app/growth, app/mission-control, app/brain"]
  SVC --> DB3[("SQLite")]
```

- Directory sizes (files): `listening` 11, `experiments` 7, `growth` 6, `recommendations` 3, `semantic` 2, `mission-control` 1, `brain` 1, `orchestration` 2, `workers` 1 [S: filesystem].
- The data flow *between* these stages (events → features → forecasts → recommendations → experiments) was not traced end to end [U]. Use `docs/GROWTH_*` documents for intent; do not treat them as implemented behaviour.

## 8. Tenant and authorization boundaries

```mermaid
flowchart TD
  subgraph PUBLIC["Public (no session)"]
    A1["/api/auth/*  routes/auth.mjs"]
    A2["public-site-server.mjs :3002"]
  end
  subgraph AUTHED["Authenticated + workspace-scoped"]
    B1["requireAuth -> requireWorkspace -> runWithWorkspace"]
    B2["routers mounted after index.mjs:399"]
    B3["operator-only: workspace-authorization.mjs<br/>isWorkspaceOperator"]
  end
  A1 -->|"26 runWithWorkspace call sites [S]"| TCX["tenant-context.mjs<br/>114 importer files [G]"]
  A2 -->|"preview route: getProjectWorkspaceId then runWithWorkspace [S]; other routes [U]"| TCX
  B1 --> TCX
  TCX --> REPO["repositories: requireWorkspaceId() on every query path [S: pattern]"]
  B3 --> OPS["booking status, medical docs admin, learning enrollments, site media, consultations [G]"]
```

- 41 of 53 route files never import `tenant-context.mjs` or `workspace-authorization.mjs` [G]. They rely on being mounted after `index.mjs:397-399`. That ordering is the single guard for the whole authenticated surface [S].
- Public handlers enter a tenant explicitly. Whether **every** public route does so correctly is not provable from the graph [U]; the audit recommends a test that enumerates them.
- Only five files import the raw `db/database.mjs` handle: `workspace-database.mjs` (the wrapper), `commerce-outbox-worker.mjs`, `site-builder-runtime.mjs`, `scripts/assign-legacy-owner.mjs`, legacy `index.backup.mjs` [G].
- Booking adds a second boundary inside the tenant: site scope (`booking-scope.mjs`) [S].

## 9. Docker D1 runtime

```mermaid
flowchart LR
  subgraph HOST["Host (loopback only)"]
    H1["localhost:5173"]
    H2["localhost:3001"]
    H3["localhost:3002"]
  end
  subgraph COMPOSE["compose.yaml (project loadder)"]
    WEB["web<br/>vite --host 0.0.0.0 :5173<br/>bind: src, public, index.html"]
    SRV["server<br/>node start.mjs, user node<br/>API 3001, public 3002, worker"]
    VOL[("named volume loadder-data /data<br/>db, site-media, medical-private, object-storage")]
  end
  subgraph E2E["profile e2e (docker/e2e.sh, project loadder-e2e)"]
    PW["playwright container<br/>socat localhost to web/server<br/>E2E_DATABASE_PATH=/data/db/loadder.sqlite"]
  end
  H1 --> WEB
  H2 --> SRV
  H3 --> SRV
  SRV --> VOL
  PW --> VOL
  PW -. "http://localhost:5173 -> web" .-> WEB
  PW -. "http://localhost:3001/3002 -> server" .-> SRV
```

Sources: `Dockerfile`, `compose.yaml`, `compose.e2e.yaml`, `docker/*.sh`, `.dockerignore` [S]. The tracked `server/db/loadder.sqlite` is never copied into an image or volume. This is a **development-only** stack (`NODE_ENV=development`, dev OTP exposed); production topology is a separate milestone (D2) and is not described here.

---

## Refreshing this map

1. `git rev-parse HEAD` vs the commit in the header; if they differ, run `graphify update .` (about 6 s, AST only).
2. Re-query only the affected nodes with `get_neighbors` (see the workflow doc).
3. Update the sections touched and the commit hash. Do not regenerate the whole file.
