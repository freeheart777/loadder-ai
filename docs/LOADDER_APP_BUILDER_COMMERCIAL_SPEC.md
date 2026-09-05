# Loadder App Builder — Commercial Product Specification

## Product promise

A business user describes what they need in plain language. Loadder generates a working business application, opens it in a visual studio, and lets the user make safe edits without touching code.

Primary UX:

`Describe -> Generate -> Preview -> Visual Edit -> Test -> Publish`

## Commercial studio layout

- Left rail: projects, templates, app catalog.
- Main canvas: live application preview.
- Right rail: visual editor controls (theme, density, radius, page/navigation labels; later blocks, field visibility, layout and component settings).
- Top bar: Undo/version history, preview device, live app, publish readiness.
- AI edit box: natural-language edits such as “move customers above opportunities”, “make the dashboard compact”, or “hide phone from the table”. AI edits must compile to validated editor patches, not arbitrary client-side code mutation.

Every visual change creates a new immutable version and remains restorable/exportable.

## App categories to expose commercially

### Ready / foundation available
- Sales CRM and lead management
- Inventory and warehouse management
- Booking and scheduling
- Internal admin tools
- Approval / request systems
- Customer portals
- Simple project and operations trackers

### Near-term vertical packs
- Logistics / shipment / fleet operations
- Real estate CRM and property workflows
- Agency / marketing operations
- Retail / distribution
- Non-clinical clinic operations and scheduling
- Construction/project operations
- Recruitment / HR workflows
- Procurement
- Customer support / ticketing
- Lightweight ERP

### Later / advanced
- B2B marketplaces
- Membership/subscription apps
- Multi-vendor portals
- Field-service apps
- Franchise / branch operations
- Custom SaaS products

## Scope boundaries

Good fits: CRUD-heavy business apps, dashboards, portals, workflows, approvals, booking, inventory, CRM, operations, reporting, agent-assisted internal tools.

Not initial targets: games, CAD/3D authoring, professional video editing, safety-critical medical systems, core banking ledgers, ultra-low-latency trading systems, or apps requiring unrestricted native device capabilities before the native runtime is complete.

## Platform targets

### Web App — SUPPORTED
Primary commercial target.

### PWA — SUPPORTED
The Loadder App Definition already targets `web` and `pwa`. This is the first mobile-installable commercial path.

### iOS Native — PLANNED
Do not market native iOS generation as available until the native renderer and build pipeline pass production gates.

Architecture:

`Loadder App Definition -> Loadder Native Renderer -> React Native/Expo Project -> iOS Build Adapter -> Signing -> TestFlight/App Store`

Ownership rule: native app definitions remain Loadder-owned. Expo/EAS may be one build adapter, but must not be the only architecture path. A local/self-hosted build path must be supported before enterprise claims of provider independence.

Native iOS exit gates:
- React Native/Expo renderer for core Loadder UI components
- navigation/forms/tables/references/workflows parity
- native secure storage and auth adapter
- push notification adapter
- camera/file/location capability permission model
- Apple signing credential isolation
- reproducible iOS build
- TestFlight smoke test
- App Store submission workflow
- rollback/version strategy
- local/self-hosted build option documented

### Android Native — PLANNED
Share the same Native Renderer abstraction; Android build/signing adapter remains separate.

## Commercial quality bar

A generated app is not considered sellable until:
- required CRUD works end to end
- workspace isolation passes
- version restore works
- export/import works
- runtime errors are surfaced safely
- AI/provider outage does not destroy app operation
- no external side effect bypasses approval/idempotency/audit
- CI gates pass
- mobile/responsive layout passes acceptance tests

## Product simplicity rule

Advanced architecture must remain invisible to the normal user. The default commercial experience should feel like:

1. Tell Loadder what you want.
2. Choose a suggested app/template if desired.
3. Wait for the generated preview.
4. Edit visually or ask AI to change it.
5. Add data and test workflows.
6. Publish when readiness gates are green.

No user should need to understand schemas, providers, containers, migrations, or source files for the normal path.
