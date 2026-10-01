# ADR-005 — Medical / NAVA vertical: Phase 0 decisions

Status: ACCEPTED (human-approved decisions, validated against HEAD `c5425231a0f14840281ab28d194d6aca76289845`). No implementation has started.

Scope: five decisions that bound the Medical vertical. Medical is a presentation-and-policy layer on the canonical MEDICAL/V16 platform. It must not introduce a second auth system, a second Booking, a second renderer or a second media system.

## Decisions

### D1 — Patient identity: app-user + mobile OTP

- Patients are `business_builder_app_users` (role `customer`) with the existing hashed sessions (`X-Loadder-App-Token`). No passwords in Medical v1. Email optional.
- Mobile is the primary sign-in identifier. It lives in a new **identifier table**, not as a column on the app-user, so later identifiers (verified email, passkey) are additional rows and never replace the patient identity.
- Validated constraints in current source:
  - `business_builder_app_users.email` is `NOT NULL` and `UNIQUE(workspace, project, email)`; app users are created only by an operator (invite or session) and there is no self-signup or verification.
  - Operator `createAuthService` OTP creates operator `users` and workspaces. It must NOT be reused for patients. Only its HMAC-hash pattern and the `messaging.mjs` delivery adapter are reused.
  - App-user identity is scoped to a `business_builder_projects` row, and public routes require `status='ready'`. A Medical site therefore needs a **site identity binding** to an auth project (system-provisioned, no app version). The existing `business_builder_commerce_bindings` is STORE-only (trigger) and must not be reused.
  - `getMessagingStatus().sms.configured` is `true` for `SMS_PROVIDER=simulator` even in production, and `/api/auth/status` hard-codes `otpDelivery:"not-connected"`. Production does **not** fail closed today.
- Accepted debt: for mobile-only patients the legacy `email` column is filled with a reserved placeholder (`patient-<id>@patients.invalid`, RFC 2606). The identifier table is authoritative; email flows must skip `.invalid`. A later table rebuild can make `email` nullable.
- Production fail-closed: in `NODE_ENV=production`, a simulator or unconfigured SMS provider makes patient OTP request return 503 `OTP_DELIVERY_NOT_CONFIGURED` and `/status` report not-configured. Development may use the simulator.

### D2 — Medical documents: dedicated private primitive (Phase 5)

- Not `site_media_assets`, not the public media routes, not `visibility:"workspace"` metadata. Own table, own bucket or prefix, own authorization.
- Immutable workspace + site ownership, patient/app-user owner, appointment association where applicable, optional provider association only when justified. No public URL, no storage key in any response. Authenticated streamed (or short-lived signed) access with `no-store` and `nosniff`.
- Append-only access audit for every read and mutation. Strict allowlist (PDF, JPEG, PNG, WebP; **SVG prohibited**), magic-byte validation, bounded size, retention/deletion state.
- A malware-scanning contract is required before production activation. No scanner exists in the repo; scanning is not faked. Production activation is gated on a configured scanner (`scan_state` must be `clean` before a document is readable in production).

### D3 — Booking becomes site-scoped (backward compatible)

- Nullable `site_project_id` on the canonical Booking tables; no Booking V2, no destructive change, no backfill. Historical NULL rows stay valid.
- Rows: `booking_services`, `booking_providers`, `booking_appointments` get the column. `booking_availability` and `booking_provider_services` inherit scope from their provider/service and are checked by trigger (no column).
- Scope modes (explicit, testable):
  - **strict** (site type `MEDICAL`): sees only rows with `site_project_id = site.id`; never NULL rows.
  - **legacy-compatible** (all other site types, incl. Education): sees `site_project_id = site.id` OR NULL; never another site's non-NULL rows.
- Cross-site reads and writes are rejected in the repository and by triggers (provider/service/availability/appointment must share one scope; scope is immutable once set).
- Operator APIs take an explicit `siteProjectId`. Omitted scope keeps today's behavior (the NULL/legacy view); supplying a site scopes reads and stamps writes.
- The current `bookingEnabled` in `routes/booking.mjs` is workspace-wide ("any site has booking"); site-scoped requests must check that site's capability.

### D4 — Public-site security: audit PR #246, port selectively, never merge

PR #246 is 89 commits behind HEAD and conflicts in `auth.mjs`, `site-project-repository.mjs`, `public-sites.mjs`, `corporate-site-html.mjs`, `StudioCanvas.tsx`. Audit result:

| Part | Verdict |
|---|---|
| `public-link-policy.mjs` + client `linkPolicy.ts` (allow-list, reject-not-rewrite) | PORT |
| `link()` use for hero/nav/CTA in the renderer; `AuthorLink` in `StudioCanvas` | PORT, preserving the Education hero CTA `…/booking` and detail-route links |
| `public-site-headers.mjs` (single CSP for the three public surfaces; `script-src 'none'`, `object-src 'none'`, `form-action 'none'`) | PORT **with `media-src 'self' https:` added** (the PR omits it and would block Education/Medical video) |
| Lead honeypot + bounded duplicate suppression (`site-lead-service`, canvas honeypot field) | PORT (consider PHI before logging payloads) |
| canonical/noindex, sitemap/robots (`public-site-discovery`, `getActiveDomainForProject`) | DEFER (SEO, not security) |

Proof required: existing public-site/corporate baseline tests and all Education tests (detail routes, performance video, CSP) green, plus new tests for link rejection, header parity across the three surfaces, and video still playable under the new CSP.

### D5 — PR #52: reference only

Not merged. It is a client-only prototype (all `useState` seed data, hard-coded demo content, base64 images, no persistence). NAVA is built on the MEDICAL archetype (booking, lead, location, content), the existing `medical-practice-v1` V16 template, and the shared renderer.

## Existing modules and tables each decision extends

| Decision | Extends |
|---|---|
| D1 | `LoadderAppUserAuth` (`business-builder/app-user-auth.mjs`), `business_builder_app_users/sessions/invites` (057/059), `server/services/messaging.mjs`, `auth-service.mjs` (hash pattern only), `createPublicEducationRouter` pattern, `booking-identity.mjs` |
| D2 | `site-media-storage-adapter.mjs` (validation helpers only), the Education private-file pattern; new tables |
| D3 | `booking-repository.mjs`, `routes/booking.mjs`, public booking routes in `routes/auth.mjs`, `control-center-repository.mjs` (raw table counts), `BookingStudioPage.tsx`, `PublicBookingPage.tsx`, triggers from 092/095/098 |
| D4 | `corporate-site-html.mjs`, `public-sites.mjs`, `site-public-runtime.mjs`, `routes/auth.mjs`, `PublicSiteRuntime.tsx`, `StudioCanvas.tsx`, `site-lead-service.mjs` |
| D5 | `business-launch-v1.ts` (`medical-practice-v1`), `website-platform-definition.mjs` (MEDICAL → doctor) |

## Migration numbering (from HEAD; latest is 098; 088 stays reserved)

Numbers are advisory and follow execution order.

| # | Name | Phase |
|---|---|---|
| 099 | `booking_site_scope` (nullable `site_project_id`, indexes, scope-consistency and immutability triggers) | 1 |
| 100 | `sensitive_access_events` (append-only: actor kind/id, action, resource, site; UPDATE/DELETE blocked by triggers) | 1 |
| 101 | `booking_provider_service_modalities` (per-doctor allowed modes, nullable) | 2 |
| 102 | `app_user_identifiers` + `app_user_otp_challenges` + `site_identity_bindings` (may split in two) | 3 |
| 103 | `booking_provider_identity` (provider ↔ employee app-user) | 4 |
| 104 | `medical_documents` (+ scan state, retention state) | 5 |
| 105 | consultation join-link / thread primitive | 7 |

## Security invariants (tests must enforce)

1. Tenant: every Medical read/write is workspace-scoped; another workspace gets 404/401 on every route.
2. Site scope: a strict site never sees NULL or other-site Booking rows; a legacy site never sees another site's non-NULL rows; scope cannot be changed after creation.
3. Appointment ownership: a patient sees only appointments whose immutable `app_user_id` is theirs; anonymous appointments are never auto-claimed or claimed by name/contact.
4. Authorization matrix (patient / doctor / operator / admin): a doctor sees only appointments of their own provider; an operator needs an explicit role for patient files; a plain workspace member sees none.
5. Identity: OTP stored hashed, attempt-limited, expiring, single-use; anti-enumeration responses; per-mobile and per-IP limits; a disabled app user's sessions are revoked and unusable; the token never appears in URLs or logs.
6. Delivery: production with simulator/unconfigured provider returns not-configured and never exposes the code.
7. Files: no public URL and no storage key in any response; `Cache-Control: no-store`, `nosniff`, attachment disposition by default; SVG and mismatched magic bytes rejected; size bounded; unscanned files unreadable in production.
8. Audit: every document read/mutation and every appointment status change writes an append-only `sensitive_access_events` row; rows cannot be updated or deleted.
9. Booking contract: no cancel/reschedule offered to patients until status routes and policy exist.
10. Public site: rejected links render as text; CSP identical on all public surfaces; Education video still plays.

## Compatibility plan

- **Education and legacy Booking:** columns are nullable; existing rows keep NULL; Education sites run in legacy-compatible mode and keep today's operator API shape (no `siteProjectId` ⇒ legacy view). The identity link (098), portal appointments and Control Center keep working unchanged; their tests plus the Education Playwright suite are the regression gate for every migration.
- **Order of risk:** migration 099 lands with repository enforcement and its own tests before any Medical service is created.
- **Public routes:** unchanged paths. New site-scoped behavior is derived from the site already known on the public route.
- **Control Center summary** (`control-center-repository.mjs`) counts raw tables per workspace; it becomes site-aware without changing the legacy total.

## Platform primitives vs Medical-specific

- **Platform (reusable):** site-scoped Booking, `sensitive_access_events`, app-user identifiers + OTP, site identity binding, private document store, link policy and public headers, provider↔app-user link, patient/doctor portal routers, the generalized detail-page registry.
- **Medical-specific:** the NAVA template and copy, doctor/service presentation cards, patient document categories and consent text, clinical wording, Medical Control Center tab layout, consultation presentation.

## Execution order (Phases 1–7)

1. **Foundations:** (a) port the PR #246 security/link-policy subset with the regression proof above; (b) migration 099 + 100, site-scoped Booking repository/routes, appointment status routes with audit. Gate: Booking, identity-link, Education unit + browser suites.
2. **Public NAVA site:** generalize the detail-page registry per vertical, NAVA template on `medical-practice-v1`, services/doctors linked by id, per-doctor modes (101), site-scoped public booking with the care-mode step.
3. **Patient identity and portal:** site identity binding + auth-project provisioning, identifiers + OTP (102), production fail-closed delivery, ownership-gated patient portal (upcoming, history, no cancel).
4. **Doctor identity and portal:** provider↔app-user link (103), own-appointments read, availability edit.
5. **Medical documents:** private store and routes (104), appointment association, audit; production gated on a scanner.
6. **Medical Control Center:** tabs from real data only (patients, doctors, services, schedules, appointments, content, files, settings); no fake metrics; payments and messages stay deferred.
7. **Consultations:** operator/doctor-entered join link first; async text thread as a new primitive; video/audio provider only after an explicit provider decision.

## Needs human or provider input (not architecture)

- SMS provider choice and credentials for production OTP (existing adapter supports Kavenegar: API key, sender line, approved OTP template).
- Private object-storage bucket and credentials for medical files; the malware scanner choice, deployment and credentials.
- Legal inputs: retention period, deletion policy, consent and privacy wording.
- Later: a video/audio provider, and an optional email provider (Resend) if email verification is wanted.
