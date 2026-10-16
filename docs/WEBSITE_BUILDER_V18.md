# Website Builder V18: product completion and template quality

Evidence: `e2e/websites/website-v18-journeys.spec.ts` (native and production-topology Docker) and the before/after captures made by `e2e/websites/template-gallery-shots.spec.ts`.

## 1. Capability-to-template gap matrix (found in discovery, before any change)

Existing capabilities, all reused, none rebuilt:

| Capability | Where it already lives |
|---|---|
| One V16 document, one canvas renderer for Studio, preview and the public SPA (`/site/:id`) | `StudioCanvas.tsx`, `PublicSiteRuntime.tsx` |
| Booking: services, providers, availability, 7-step public journey (service, doctor, mode, date and slot, details, review, confirmation with `BK-` code), strict site scope for MEDICAL, compat scope for LEGAL/EDUCATION | `booking*` routes, `PublicBookingPage.tsx`, `booking-scope.mjs` |
| Commerce: catalogue, cart, checkout | `ecommerce-service.mjs`, **STORE only** (`NOT_STORE_PROJECT`, 409) |
| Education portal and enrolment | `learning-enrollments`, `EducationPortalPage.tsx` |
| Lead capture (contact form to canonical lead, honeypot, rate limit) | `ContactForm` in `StudioCanvas.tsx` |
| Capability registry and publish manifest | `server/app/site-platform/*` |
| Medical golden starter (NAVA): multi-page, doctor and service detail pages linked to Booking records | `templates/nava-medical-v1.ts` |

Gaps measured on the baseline (screenshots in `/tmp/audit/v18/before/`):

| Template | Gap | Status now |
|---|---|---|
| Clinic (Medical) | Hero and nav actions went to a lead form; the existing Booking journey was unreachable from the home page | FIXED: hero, nav and a booking section lead to `/booking` |
| Hybrid | Looked like Corporate (about, a stub "articles", a form); hero action pointed at `#products-main`, a section that did not exist | FIXED: services, product showcase, workshop story, projects, inquiry CTA, lead form, own palette and photography |
| Education | Home had two text stubs; hero photo unrelated to music; courses never appeared on the home | FIXED: courses with photography, instructors, booking CTA, enquiry form, piano hero |
| All business templates | **Hero button ignored `ctaHref`**: a dead store-style button on Corporate and Hybrid, and forced to `/booking` on Legal whatever its label said | FIXED: the hero button goes where the author pointed it; booking is only the fallback |
| All | Template picker showed a schematic gradient and three section names | FIXED: live preview, see section 3 |
| All | Contact form fields were hard to read on dark themes | FIXED: explicit text and placeholder colours |
| Corporate, Legal | Reasonable baseline | unchanged apart from the shared fixes |
| Store | Own storefront renderer; browsed and checked out by the existing store suites | unchanged |

## 2. Hybrid Business: what is and is not supported

Exact backend facts (verified in code and by a test):

- Commerce (products, cart, checkout, discounts) is available to **STORE projects only**. `POST /api/stores/:id/products` on a HYBRID project answers `409 NOT_STORE_PROJECT`. The capability resolver lists `commerce` for HYBRID, but the service refuses; that inconsistency is reported below, not worked around.
- The HYBRID archetype has no `booking` capability.

So the Hybrid template offers: business presentation, custom-work services, a **display-only product showcase** (no prices, stock, cart or checkout), a workshop story, project case studies, and a lead form for enquiries and orders. Every product action leads to the enquiry form. `website-v18-journeys.spec.ts` asserts that no cart, price or checkout appears and that the product API stays refused.

Decisions needed from the product owner before Hybrid can sell or book:
1. Allow Commerce for HYBRID projects (relax the STORE-only rule in `ecommerce-service.mjs` and its tenant and authorization tests), or keep it STORE-only.
2. Add `booking` to the HYBRID archetype (one line in `website-platform-definition.mjs`, plus a scope decision: compat scope would apply).

## 3. Real template previews

`TemplateLivePreview.tsx` renders the template's own V16 config (the same `createConfigFromTemplate` a created site starts from) through the same canvas, scaled down and inert. There are no screenshots to keep in sync, so the preview cannot drift from the site the customer gets. The previews carry no focusable, clickable or editable element.

## 4. Images

Added CC0 photography (StockSnap via Openverse), recorded in `public/template-images/CREDITS.md`: hybrid (workshop, products, projects, interior hero) and education (piano, guitar, violin). Bundled with the app; nothing is hotlinked at render time. Published pages require `https` image URLs by policy, so on plain-HTTP local environments the server-rendered `/sites/:id` page drops template photos; the customer-facing `/site/:id` renders them.
