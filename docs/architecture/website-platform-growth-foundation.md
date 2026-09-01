# Loadder Website Platform — Growth Foundation

Status: foundation contract
Source of truth: GitHub Issue #98 + root `AGENTS.md`

## Goal

Website Builder is a shared execution platform for Brand/Business DNA, not a collection of isolated vertical page builders.

Core journey:

`Business Intake → Brand Book / Business Proposal → Brand/Business DNA → Website Generation → Visual Studio → Draft Preview → Versioned Publish`

Direct Website Builder intake writes into the same shared Brand/Business context rather than creating a website-only identity silo.

## Shared website model

A site has:

- archetype: store, corporate, catalog, doctor, lawyer, custom;
- capabilities: commerce, catalog, booking, lead, team, content, location, forms, analytics, ads, landing;
- Brand/Business context with provenance;
- pages;
- analytics/ads integrations;
- conversion goals.

Verticals are capability compositions. They must not fork the entire Builder/Renderer/Studio.

## Landing pages

Landing is a page kind/capability, not a new website archetype.

Flow:

`Campaign brief → existing Brand DNA + offer + audience → Landing Draft → shared Visual Studio → Preview → Publish → campaign traffic → conversion event`

Landing requirements:

- standalone slug/URL;
- campaign-specific offer/headline/CTA;
- optional minimal navigation;
- campaign attribution preservation;
- conversion goal mapping;
- compatible with lead, booking or commerce actions;
- variant key reserved for later A/B testing;
- reusable Brand DNA and shared renderer.

## Analytics

Initial provider: Google Analytics.

Rules:

- provider configuration belongs to project/published configuration;
- Draft Preview must not pollute production tracking by default;
- emit business events through a provider-neutral event vocabulary before provider-specific mapping;
- public IDs may enter the client bundle only where provider design requires them;
- secrets stay server-side;
- published configuration is versioned with the site.

Initial event vocabulary:

- page_view
- lead_submit
- booking_start
- booking_complete
- view_item
- add_to_cart
- begin_checkout
- purchase
- cta_click

## Ads

Initial provider: Google Ads.

Loadder already contains Ads Center / Google Ads campaign entry UI. Future work should connect existing Ads capabilities to Website Platform instead of creating a parallel ads product.

Website Platform owns the campaign destination and conversion contract:

- landing URL;
- UTM/campaign metadata;
- conversion goals;
- provider conversion IDs/labels;
- attribution persistence;
- later audience/remarketing integrations under privacy/consent controls.

## Existing Loadder surfaces to reuse

- `AnalyticsPage.tsx` already presents analytics/growth concepts.
- `AdsCenterPage.tsx` / `AdsCenterWithGoogleEntryPage.tsx` already represent campaign operations.
- `LOADDER_MASTER_ARCHITECTURE.md` already identifies Business DNA, Brand Book and Website Builder as authoritative foundations.

These must converge on shared contracts instead of being rebuilt independently.

## First implementation contract

`src/lib/website-platform.ts` defines the first provider-neutral frontend domain types for:

- website archetypes/capabilities;
- Brand context provenance;
- page kinds including `landing`;
- campaign attribution;
- conversion goals;
- analytics providers/configuration;
- ads providers/configuration;
- provider-neutral analytics events.

This is intentionally a domain foundation only. It does not yet inject tracking scripts or mutate production publish/runtime behavior.

## Next implementation steps

1. Map the existing Site Project persistence shape to `WebsitePlatformDefinition` without breaking legacy projects.
2. Add migration/normalization helpers and tests.
3. Add landing page creation/editing to the shared Website Studio page model.
4. Persist campaign metadata and conversion goals in Draft state.
5. Add Preview-safe analytics event bus.
6. Wire Google Analytics configuration UI to project settings.
7. Connect existing Google Ads Center campaign destination selection to published landing pages.
8. Add versioned Publish support before production tracking injection.
9. Add A/B variants only after landing/publish/analytics contracts are stable.

## Safety boundaries

- Do not inject Google scripts from Studio before Publish architecture is ready.
- Do not store OAuth/client secrets in frontend website definitions.
- Do not send Preview traffic to production analytics by default.
- Do not make Google availability a dependency for rendering a Loadder website.
- Do not implement landing pages as a separate renderer/editor.
