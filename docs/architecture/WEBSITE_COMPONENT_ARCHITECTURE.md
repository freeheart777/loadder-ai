# Loadder Website Component Architecture

## Status

Proposed. Companion to ADR-004 (Website Platform Architecture).

Source: `docs/design-references/ecommerce-pattern-analysis.md` (kitchenware and consumer-electronics homepage references).

## Principle

Both reference stores are built from **the same components**. They differ only in section order, variants, content and theme.

```
Website = Core Engine + Enabled Capabilities + Selected Sections + Theme
```

No templates. A non-technical user builds either store with the same builder.

## 1. Component Registry

Three levels. Only **sections** are draggable.

| Level | Role | User sees it as |
|---|---|---|
| Site chrome | One per site, rendered on every page | Header / Footer settings |
| Sections | Page building blocks, reorderable | Draggable palette |
| Elements | Building pieces used inside sections | Not directly (configured through section settings) |

### Site chrome (Core)

| Component | Notes |
|---|---|
| `core.utilityBar` | Announcements, phone, language |
| `core.header` | Logo, search, account slot, cart slot (visible only with `commerce`), navigation from pages |
| `core.categoryNav` | Categories from `commerce` when enabled, otherwise from pages |
| `core.footer` | Link columns, contact, social, newsletter slot |

### Sections

★ = interactive (client island, loaded only on pages that use it).

| Group | Section | Variants |
|---|---|---|
| Core | `core.hero` | full-bleed, split, video |
| | `core.bannerGroup` | 1-up, 2-up, 1 large + 2 small (multi-banner campaign area) |
| | `core.categoryGrid` | circles, tiles, icons |
| | `core.featureList` | icon + text, numbered |
| | `core.trust` | badges, warranty blocks, partner logos |
| | `core.richText`, `core.faq`, `core.contact`, `core.gallery` | — |
| Story (core) | `story.brandStory` | image + text, full-bleed narrative |
| | `story.values` | value grid ("why us") |
| | `story.lifestyleCollection` | lifestyle image linked to a product set |
| | `story.logoWall` | partner / brand logos |
| Commerce | `commerce.productShelf` | grid, carousel; source: category, collection, best sellers, newest |
| | `commerce.categoryShelf` | category title + its products |
| | `commerce.productDetail`, `commerce.cart`★, `commerce.checkout`★ | — |
| Campaigns | `campaigns.flashSale`★ | countdown + product shelf |
| | `campaigns.promoBanner` | scheduled banner linked to a campaign |
| Blog | `blog.preview`, `blog.articleList` | — |
| Forms | `forms.newsletter`★, `forms.leadCapture`★, `forms.warrantyRegistration`★ | — |

### Elements (never in the palette)

ProductCard, PriceDisplay (sale/discount), Countdown, Badge, Button, Media, Rating.

ProductCard and PriceDisplay are owned by `commerce`, so every section that shows products renders them the same way.

## 2. Capability Mapping

| Reference name | ADR-004 capability | Provides |
|---|---|---|
| (always on) | **core** | Site chrome, hero, banners, category grid, features, trust, rich text, FAQ, contact, gallery |
| (always on) | **story** sections, part of core | Brand story, values, lifestyle, logo wall. Sections only, with no data or services. |
| commerce | **commerce** (requires `payments`) | Products, inventory, cart, checkout, ProductCard / PriceDisplay |
| campaigns | **campaigns** (requires `commerce`) | Flash sales, scheduled promos, discount pricing |
| content | **blog** (legacy name `content`) | Articles, blog preview. SEO pages are ordinary core pages. |
| forms | **forms** | Newsletter, lead capture, warranty registration; submissions feed `crm` |

### Examples

| Site | Capabilities | Distinguishing sections |
|---|---|---|
| Kitchen store | core, commerce, payments, blog, forms | Category circles, brand-story banners, warranty `core.trust`, newsletter |
| Electronics store | core, commerce, payments, blog, campaigns | Multi-banner hero, flash deals, trust badges, lifestyle collections |
| Music academy | core, courses, booking, people, commerce, payments | Same core/story sections + course and instructor sections |

Neither store needs code specific to it.

## 3. Section Schema

### Definition (registry)

| Field | Meaning |
|---|---|
| `type` | `"<capability>.<name>"`; legacy plain types are aliases (ADR-004 §4) |
| `capability` | Owner; the section is hidden when the capability is disabled |
| `label`, `icon`, `category` | Palette display (Persian-first) |
| `variants[]` | Layout options; responsive by construction |
| `fields[]` | Typed, editor-generated: text, richText, media, link, colorToken, select, list&lt;item&gt;, dataSource |
| `dataSource?` | `{ kind: products \| categories \| posts \| campaign, query schema }` |
| `defaults` | Per variant |
| `constraints` | `maxPerPage`, `allowedPages` (e.g. checkout only on the checkout page) |
| `interactive` | `true` ⇒ requires a client island |
| `seo?` | Contributes structured data (product list, FAQ) |

### Instance (site document)

| Field | Meaning |
|---|---|
| `id`, `type`, `variant`, `enabled` | Identity and layout |
| `props` | Values for the definition's fields |
| `data` | Query, e.g. `{ source: "category", id, limit: 8, sort: "best" }` |
| `style` | Theme-token references only (e.g. `background: "surface-2"`), no raw CSS |
| `visibility` | `{ devices, schedule }`; `schedule` is used by campaigns |

### Rules

- **Content and data are separate.** A shelf stores a query, not copies of products, so it is always current.
- **Styling comes from theme tokens only.** Existing per-section colors and spacing stay as legacy overrides for backward compatibility.
- **Schedules belong to the instance.** A flash sale or promo banner disappears automatically when its campaign window ends.
- **The schema drives editing.** It generates the inspector form, validates every patch-engine patch, and limits what AI edits can do.

## 4. Builder UX Model

Extends ADR-004 §7 (floating panel, live preview, sections instead of pixels).

1. **Start from a goal.** The user picks an experience preset (e.g. "Online store"). The preset enables capabilities and places a starter section list. The two references are two starter layouts of the same store preset.
2. **Palette grouped by intent, not capability:** Top of page · Products · Promotions · Your story · Trust · Stay in touch. Only sections from enabled capabilities appear; sections from disabled capabilities show as "Enable Promotions to use Flash Sale".
3. **Drag between sections.** A hover toolbar on each canvas section: move up/down, duplicate, hide, delete, switch variant.
4. **Variant first, fields second.** Picking a thumbnail layout is the primary action. Text and media are edited in place on the canvas where possible, otherwise in the inspector.
5. **Data pickers, not configuration forms:** "Show products from [Category ▾] [Best sellers ▾] [8 ▾]" with a live preview.
6. **Global theme panel:** colors, font pair, radius, spacing; applies to the whole site.
7. **Device toggle:** desktop / tablet / mobile preview only. No per-breakpoint editing.
8. **Optional AI assist:** e.g. "Add a Nowruz flash sale above the products", which appears as a proposed patch the user previews before accepting.

## 5. Implementation Priorities

Aligned to the ADR-004 implementation order.

| Priority | Work | ADR-004 phase |
|---|---|---|
| P0 | Section schema contract, registry, legacy aliases | 4 |
| P0 | Site chrome separated from page sections | 4–5 |
| P1 | Core sections: hero, bannerGroup, categoryGrid, featureList, trust, richText, faq | 4 |
| P1 | Commerce: productShelf (grid/carousel) with data query, ProductCard/PriceDisplay, categoryShelf | 4 |
| P1 | Theme tokens, with legacy per-section styles as overrides | 5 |
| P2 | Story sections: brandStory, values, lifestyleCollection, logoWall | 7 |
| P2 | Editor: intent-grouped palette, variant picker, data picker | 7 |
| P2 | Forms: newsletter, leadCapture | 8 |
| P3 | `campaigns` capability: flashSale, promoBanner, schedules. Needs a pricing/discount source; evaluate `commerce/v2/pricing-engine.mjs` first | 8 |
| P3 | Blog preview / article list | 8 |
| P3 | Warranty registration (forms + product link) | 8 |

**Acceptance checkpoint:** both reference homepages can be rebuilt with P0–P2 sections, except the flash sale block, which needs P3 `campaigns`.
