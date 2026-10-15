# Website Builder: capability matrix (browser-verified)

Evidence is the customer journey in `e2e/websites/website-builder-acceptance.spec.ts` (run natively, on the production-topology Docker images with `docker/prod-e2e.sh builder`, and against the local Docker stack at `http://app.localhost`). A capability is marked WORKING only if that journey, or a named suite, exercised it in a browser.

Status: WORKING / FIXED (was broken, fixed here, covered) / INCOMPLETE / NOT IMPLEMENTED / NOT VERIFIED. Priority applies to anything not WORKING.

## A. Creation and templates
| Capability | Status | Evidence |
|---|---|---|
| New-website picker: Store, Clinic, Law, Education, Corporate, Hybrid, Nava Medical | WORKING | `website-template-creation.spec.ts`, acceptance step 1 |
| Create from a template, named after it, seeded with real sections and photos | WORKING | acceptance 1-3 |
| Business flow preselected the Store template | FIXED | default is now the first template of the route's kind |
| Create blank site and blank store | WORKING | `website-blank-and-preview.spec.ts`: skeleton site edits, saves, reloads, publishes; blank store is persisted as STORE |
| Store created from the picker template was unusable publicly | FIXED | template carried `ECOMMERCE`; public storefront answered 'Store not found' (P0). Stores are now persisted as STORE |

## B. Visual Studio
| Capability | Status | Evidence |
|---|---|---|
| Select and edit text through the Inspector, live on canvas | WORKING | acceptance 4 |
| Replace an image directly on the canvas (upload to the site media library) | WORKING | acceptance 4 |
| Brand colour and typography (Design tab) | WORKING | acceptance 5 |
| Header brand name | WORKING | acceptance 6 |
| Add / move / duplicate / delete sections | WORKING | acceptance "section operations" |
| Header/footer/nav from active sections and pages | WORKING | acceptance (menu shows new page) |
| Save, reload, state persisted; dirty indicator | WORKING | acceptance 8-9 |
| Leave with unsaved changes asks first | FIXED | `beforeunload` guard; was absent |
| Undo / redo (buttons, Ctrl/Cmd+Z, Shift+Z) | FIXED | was NOT IMPLEMENTED; acceptance "undo and redo" |
| Preview (desktop, mobile) | WORKING | acceptance 11 |
| Private preview link and its access control | WORKING | release flow (6 templates) and blank spec: token required, wrong/malformed/other-project token refused, noindex, draft edits reach the link but not the public site, other workspace gets 404 |
| Explicit save | WORKING | failed save keeps work unsaved and guarded, retry succeeds, stale tab refused with 409 |
| Autosave | NOT IMPLEMENTED | by design; needs a product decision |

## C. Pages
| Capability | Status | Evidence |
|---|---|---|
| Add, title, slug, show in menu, reorder, delete (Home protected) | WORKING | acceptance 7 and "section operations" |
| Multi-page public navigation by link and by direct URL | WORKING | acceptance 14, `corporate-multi-page.spec.ts` |
| Studio reopens on the last page worked on, not Home | INCOMPLETE | P2, surprising after reload |

## D. Lifecycle
| Step | Status | Evidence |
|---|---|---|
| create, edit, save, reload, preview, publish, public view | WORKING | acceptance 1-14 |
| Edit after publish does not change the live site until republished | WORKING | acceptance 15-16 |
| Republish | WORKING | acceptance 15-16 |
| Rollback from the Studio (corporate/business sites) | FIXED | versions dialog; was API only |
| Rollback UI for Store sites | FIXED | same dialog; `store-studio-v16.spec.ts` rolls back through the UI and checks the public storefront |
| Uploaded images visible on the public site | FIXED | was 401 for every visitor (P0): new public route serves site imagery only |

## E. Responsive
| Capability | Status | Evidence |
|---|---|---|
| Edit on tablet and phone | FIXED | settings were an invisible half-screen block with no toggle (P0 for those devices); now a bottom sheet |
| Public site on mobile without overflow | WORKING | acceptance 14 |
| Studio header on tablet/phone | FIXED | wraps; overlap asserted at 820 and 390 px |

## F. Business integrations (existing suites, production topology)
| Integration | Status | Evidence |
|---|---|---|
| Store to Commerce (catalogue, cart, checkout) | WORKING | `prod-e2e store` 1, `commerce` 4 |
| Medical to site-scoped appointments and documents | WORKING | `prod-e2e medical` 17, `medical-docs-check` |
| Education to portal and enrolment | WORKING | `prod-e2e education` 12 |
| Corporate contact and lead capture, multi-page | WORKING | `prod-e2e corporate` 5 |
| Legal to Booking Studio | WORKING | `website-legal-booking.spec.ts`: Studio link, provider/service/schedule, published site's booking page lists them, other workspace 404 |
| Control Center link from the Studio | NOT VERIFIED | button present; Medical/Education centres covered by their suites |

## G. Security and tenancy
| Capability | Status | Evidence |
|---|---|---|
| Another workspace gets 404 on read, patch, publish, versions, delete | WORKING | acceptance 18 |
| 472-route anonymous/cross-tenant boundary | WORKING | `boundary-public-and-tenant.test.mjs` |
| Public media route cannot serve documents, audio, video, private or unknown keys | WORKING | `public-site-media.test.mjs` |
| Ask Loadder cannot change prices | WORKING | `store-studio-v16-ask-loadder.spec.ts` |
| Ask Loadder on a never-saved section says "section not found" | INCOMPLETE | P2: it works on the persisted document; the panel does not save first |

## Not covered by this audit
Real payment gateway, real SMS provider, x86-64 hardware, load, custom domains, a real public certificate.
