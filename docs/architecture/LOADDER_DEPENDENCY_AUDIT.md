# Loadder dependency audit

Static dependency analysis at commit `5f62b94`, from the Graphify graph (`graphify-out/graph.json`, `built_at_commit` = `5f62b94…`) plus targeted source reads. Read-only: nothing in the application was changed. See the [runtime map](LOADDER_RUNTIME_ARCHITECTURE_MAP.md) for diagrams and the [workflow](LOADDER_GRAPHIFY_WORKFLOW.md) for how to reproduce.

Evidence tags: **[G]** graph static edge, **[S]** source read, **[I]** inferred, **[U]** unverified.

## 1. Graph coverage and limits

| Item | Value |
|---|---|
| Source commit | `5f62b94f00b17fab8b5a8fda266922436f99ee5c` |
| Files scanned (AST) | 769 (code: `src/`, `server/`, root configs) |
| Nodes / edges / communities | 6,005 / 12,363 / 373 |
| Edge confidence | `EXTRACTED` 11,735 (95%), `INFERRED` 628 (5%), `AMBIGUOUS` 0 |
| Dangling / missing endpoints | 0 / 0 (`graphify diagnose multigraph`); 96 self-loop edges |
| Relations | contains 4,615 · calls 3,560 · imports_from 1,697 · imports 1,594 · indirect_call 464 · method 225 · references 122 · dynamic_import 63 |
| File-level import graph | 635 files, 1,141 distinct static import edges |
| Document nodes | 690 (629 from `docs/`), unrelated to code structure; ignore for dependency questions |

**Excluded on purpose** (`.graphifyignore`): `node_modules`, `dist`, runtime data and databases, `.env*`, `test-results`, `server/test*`, `e2e`, `public` media, `*.bak`, `LOADDER_*.txt`, tooling directories.

**What the graph cannot prove (blind spots):**
- HTTP links between `src/` and `server/` (joined here only by matching `/api/...` string literals, **[I]**).
- SQL: table ownership, cross-domain joins, triggers, migrations' effects.
- Express route paths ↔ handlers (registrations are call expressions, not graph nodes). A regex count finds ~366 `router.<verb>("…")` registrations in 47 route files; it is a lower bound.
- Runtime wiring done with variables, `dynamic_import` (63 edges) and `indirect_call` (464 edges, `INFERRED`).
- Anything in tests/e2e (excluded) and anything the Docker layer does at runtime.

## 2. Structure

- **Import cycles: none.** Tarjan SCC over the 1,141 static file edges found no component larger than one file **[G]**. (Dynamic imports and test code are not included.)
- **Direction of dependencies is clean at the directory level**: routes → services (75 file edges) → repositories; `src/pages` → `src/components` → `src/lib`. There is no edge from repositories back up to routes **[G, aggregate]**.

### Highest fan-in (most depended on)

| Files importing it | File | Role |
|---:|---|---|
| 114 | `server/app/tenant-context.mjs` | AsyncLocalStorage tenant context; `requireWorkspaceId()` |
| 86 | `src/lib/api.ts` | `apiFetch`, API base URL, global fetch patch |
| 16 | `server/app/query/cursor-pagination.mjs` | shared pagination |
| 15 | `src/components/store-studio-v16/types.ts` | Studio type contract |
| 11 | `server/app/workspace-authorization.mjs`, `src/lib/demoMode.ts` | operator authorization; demo flag |
| 9 | `server/db/workspace-database.mjs`, `src/components/control-center/modules.ts` | tenant-guarded DB wrapper; Control Center registry |

### Highest fan-out (composition roots)

| Imports | File | Note |
|---:|---|---|
| 116 | `server/index.mjs` (3,681 lines, ~77 KB) | wires ~30 routers and builds services inline |
| 104 | `server/db/migrations/index.mjs` | expected (migration list) |
| 58 | `src/App.tsx` | route table |
| 40 | `server/app/site-builder-control-plane.mjs` | mounts site projects, booking, media, medical, payments, control center |
| 37 | `server/app/routes/auth.mjs` | see F2 |
| 24 | `server/app/routes/business-builder.mjs` | |

### Strongest cross-directory coupling (file edges)

`src/pages→src/lib` 95 · `server/app/routes→services` 75 · `src→pages` 56 · `pages→components` 55 · `repositories→server/app` (tenant-context etc.) 42 · `server→routes` 35 · `server→repositories` 34 · `business-builder→server/app` 31 · `routes→business-builder` 23 · `repositories→growth` 10 · `routes→commerce` 10.

## 3. Findings

Priority: **P0** unsafe or incorrect today; **P1** structural risk that can cause incidents or blocks safe change; **P2** debt or documentation hazard. None of these were fixed in this task.

| # | Pri | Finding | Evidence | Status |
|---|---|---|---|---|
| F1 | **P1** | **The AI router is the mount point for the core builder.** `routes/ai.mjs` imports `openai` and the Cloudflare agent executor at module top and also does `router.use(canonicalCommerceRouter)`, `router.use(businessBuilderRouter)`, `router.use(siteBuilderRouter)`. So canonical commerce, Business Builder and the whole site-builder control plane (site projects, operator booking, medical admin, media, payments) are wired through an AI file. This contradicts the project rule "Website Builder core stays independent from AI" at the wiring level, and an import/initialisation failure in the AI module would take the core down. | `server/app/routes/ai.mjs:2-8,198-200` **[S]**; `site-builder-runtime.mjs` ← `ai.mjs` **[G]** | Confirmed |
| F2 | **P1** | **The "auth" router is the public API gateway.** `createAuthRouter` is mounted *before* `requireAuth` and contains public site, public booking, storefront (carts, orders, pay), patient, doctor, consultation and medical-document routes (37 imports, 31+ route registrations, 26 `runWithWorkspace` sites). Ownership by name is wrong; a reviewer looking for "authentication" will not look here for payment or medical routes. Tenant entry is per-handler, not structural, so correctness depends on every handler. | `server/index.mjs:350-356` and `server/app/routes/auth.mjs:89-153` **[S]**; fan-out 37 **[G]** | Confirmed structure; per-handler tenancy **[U]** |
| F3 | **P1** | **`server/index.mjs` is a 3,681-line composition root** that builds repositories and services inline and mounts ~30 routers; fan-out 116. Highest blast radius in the backend, hard to review, and contains literal status strings (`productionReady:false`, `otpDelivery:"not-connected"`). The auth/tenant order lives here and is guarded by nothing but source order. | `server/index.mjs` **[S]**, fan-out **[G]** | Confirmed |
| F4 | **P1** | **Tenant isolation relies on mount order plus convention.** 41 of 53 route files import neither `tenant-context.mjs` nor `workspace-authorization.mjs`; they are safe only because they are mounted after `index.mjs:397-399`. `requireWorkspaceId()` fails closed, which is good, but a new router mounted above line 385, or a new public route that forgets `runWithWorkspace`, would not be caught by any structural check. A script `npm run check:db-boundary` exists; whether it covers this ordering was not verified. | `server/index.mjs:385-399`, `app/tenant-context.mjs` **[S]**; import census **[G]** | Mechanism confirmed; coverage of guard **[U]** |
| F5 | **P2** | **Two commerce families.** `server/app/commerce` (store commerce: `ecommerce-service`, Zarinpal, attempts, refunds, ledger) and `server/app/business-builder` (`payment-router`, `commerce-outbox-worker`, `commerce-runtime-bridge`, `http-payment-provider`). `ecommerce-service` is imported by 7 files across both. Whether they duplicate behaviour or are intentionally layered is not established. | file edges **[G]**; intent **[U]** (see `docs/architecture/commerce-*.md`) | Needs owner decision |
| F6 | **P2** | **Legacy and dead-code candidates in the source tree.** 100 code files have no inbound static import (excluding entries, migrations, scripts); clearly legacy: `server/index.backup.mjs` (still imports the raw DB), `server/index.js`, `server/otp-server.cjs`, `server/agent-gateway.js`, `server/cloudflare-ai.js`, `server/services/optimizer.backup.mjs`. Some orphans may be loaded dynamically or via config. | **[G]** orphan census; dynamic loading **[U]** | Candidates only |
| F7 | **P2** | **`src/lib/api.ts` is a global coupling point.** 86 importers, it also monkey-patches `globalThis.fetch` to add `credentials: "include"` for API-bound URLs and holds a canonical store-project cache that can answer some GETs locally. Any change here has frontend-wide effect and the cache can mask server state. | `src/lib/api.ts:1-60` **[S]**; fan-in **[G]** | Confirmed |
| F8 | **P2** | **Raw database handle outside the wrapper.** `server/db/workspace-database.mjs` is the tenant-guarded wrapper (9 importers). Raw `server/db/database.mjs` is imported by the outbox worker, `site-builder-runtime.mjs` (which feeds the whole control plane), `scripts/assign-legacy-owner.mjs`, legacy `index.backup.mjs`. The control plane is still tenant-safe only because its repositories call `requireWorkspaceId()` themselves. | **[G]** | Mechanism confirmed |
| F9 | **P2** | **Static-analysis uncertainty is concentrated in a few edge kinds**: 63 `dynamic_import` edges and 464 `indirect_call` edges (`INFERRED`), e.g. `createAppUserRouter() → .consumeInvite()`. Treat answers that depend on them as hypotheses. | **[G]** | Informational |
| F10 | **P2** | **Documentation nodes pollute central-node lists.** 690 document nodes; e.g. "STOP-LINE DEFECT" (63 edges) and "Agent operating standard" (38) appear in `god_nodes`. They are heading nodes from `docs/` and `.ai/`, not architecture. | `god_nodes` result **[G]** | Informational |

### Security-sensitive boundaries (where changes need extra review)

1. Middleware order in `server/index.mjs` lines 350-453 (public → `requireAuth` → `requireWorkspace` → `runWithWorkspace`).
2. `server/app/routes/auth.mjs` public sections: storefront order/pay, patient/doctor identity, medical documents, consultations, public booking.
3. Booking scope: `server/app/services/booking-scope.mjs` + `routes/booking.mjs` (strict for Medical, compat for others).
4. Medical documents: `services/medical-document-service.mjs`, `medical-document-storage.mjs` (production deliberately refuses), `sensitive-access-audit.mjs`.
5. OTP: `services/auth-service.mjs` (operator OTP, no delivery wired in this commit: `/api/auth/status` reports `otpDelivery:"not-connected"`), `services/patient-otp-delivery.mjs`, `services/messaging.mjs` (**[S]**).
6. Payments and callbacks: `commerce/payment-*`, `business-builder/payment-router.mjs`; callback base URL comes from `req.protocol` and `Host`.
7. Public-site runtime headers: `services/public-site-headers.mjs` (script-src `none`, `form-action none`).
8. Tenant primitive: `server/app/tenant-context.mjs` (114 importers).

## 4. Blast radius cheat sheet (static, importers)

| Change | Directly affects |
|---|---|
| `tenant-context.mjs` | 114 files: essentially every repository and many routes |
| `src/lib/api.ts` | 86 frontend files |
| `src/components/control-center/modules.ts` | 9 files (Control Center page/shell/panels/modules, Booking Studio, Website Studio page, dashboard, projects page) |
| `booking-repository.mjs` | `routes/booking.mjs`, `routes/auth.mjs`, `services/booking-identity.mjs`, `site-builder-control-plane.mjs`, `public-site-server.mjs` |
| `site-project-service.mjs` | 8 files incl. `routes/auth.mjs`, `routes/booking.mjs`, `site-media`, `site-storage`, `learning-enrollments`, control plane |
| `ecommerce-service.mjs` | 7 files incl. `routes/auth.mjs`, `routes/ecommerce.mjs`, `canonical-commerce.mjs`, `public-site-server.mjs`, payment activation |

## 5. Recommended follow-ups (not performed)

1. Decide F1: mount core routers from a neutral module and keep `ai.mjs` AI-only. Add a test that fails if `routes/ai.mjs` is imported by core wiring.
2. Add a boundary test for F4: enumerate mounted routers, assert each authenticated router is mounted after the workspace middleware, and each public route establishes a tenant.
3. Split `routes/auth.mjs` by audience (auth, public-site, storefront, patient/doctor) without behaviour change (F2).
4. Move service construction out of `server/index.mjs` (F3) in small, tested steps.
5. Resolve F5 with the commerce owner and record the decision in `docs/architecture`.
6. Remove or archive F6 legacy files after confirming nothing loads them dynamically.
