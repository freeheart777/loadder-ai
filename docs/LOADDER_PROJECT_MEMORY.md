# Loadder Project Memory

> Canonical strategic memory for Loadder. This document exists so product intent survives chat sessions, contributors, agents, and implementation cycles.

## 1. Vision
Loadder becomes the Business Growth Operating System for businesses: a context-aware platform that understands a business once, then uses that understanding across brand, website, commerce, content, CRM, marketing, analytics, automation, and AI-assisted execution.

Loadder is not merely a website builder, store builder, CRM, or AI wrapper.

## 2. Mission
Remove the friction between understanding a business and executing its digital growth.

Core loop:
Business Data -> Business Profile -> Brand Book -> Business DNA -> Business Context -> Website/Store -> Content -> CRM -> Marketing -> Analytics -> Learn -> Improve.

## 3. Product Promise
Simple to do, hard to outgrow.

A non-technical merchant should be able to provide business information and quickly receive a professional digital presence, while the underlying architecture remains strong enough for a growing company.

## 4. Product DNA
- Context-first: modules consume shared business context instead of isolated prompts.
- AI-first, not AI-theatre: AI must shorten execution and improve decisions.
- Simple merchant UX: direct manipulation, smart defaults, minimal cognitive load.
- Fast and lightweight: performance is part of the brand promise.
- SEO + GEO ready: content and commerce should work for humans, search engines, and generative answer engines.
- Connected execution: website, commerce, CRM, content, marketing and analytics should exchange useful data.
- Guarded freedom: users can customize without easily destroying professional layout quality.
- TQM: quality is built into every phase, not inspected only at the end.

## 5. Website and Commerce Vision
The Store/Website Studio should feel closer to a simple Figma/Photoshop/Webflow canvas than a traditional settings dashboard.

Principles:
- The real page is in the center.
- Click the element you want to edit.
- Contextual controls appear around the canvas.
- Changes are visible immediately.
- Smart templates prevent blank-page paralysis.
- Layout rules prevent destructive design choices.

Commerce Layout Engine should support reusable blocks such as:
- Full-width Hero
- Hero with text/CTA
- Large Hero + two small banners on the right
- Large Hero + two small banners on the left
- Campaign carousel
- Category strip/grid
- Featured products
- Discount products
- Flash/Shocking offers
- Best sellers
- New arrivals
- Related/recommended products
- Brand wall
- Trust blocks
- FAQ / buying guide / SEO-GEO content

Benchmark products and stores may be studied for patterns, but Loadder must not become a visual clone. The goal is a better merchant creation engine.

## 6. Commerce Architecture Direction
Use serious open-source commerce systems such as Medusa as architectural references where useful, while keeping Loadder-owned implementation and product experience.

Core commerce concerns must include:
- Catalog
- Products and variants
- Collections/categories
- Inventory
- Pricing and compare-at pricing
- Promotions/discounts
- Product detail
- Cart/checkout/orders
- Media
- Merchant editing

## 7. Product Content / SEO / GEO
Each product should support:
1. Customer-facing sales copy
2. SEO title/description and structured search content
3. GEO content for generative/answer engines
4. Hybrid mode combining human, SEO and GEO needs

AI-generated content must use Business Context, Brand Book, product data and audience context rather than generic prompting.

## 8. Business Context Foundation
Loadder should collect useful business data at the beginning and turn it into reusable intelligence.

Canonical layers:
- Business Profile: factual business information
- Brand Book: voice, personality, identity and communication rules
- Business DNA: positioning, audience, offer, differentiation and business logic
- Business Context: active machine-consumable context shared across modules

This context should be available to Website Builder, Commerce, Content, CRM, Marketing, Analytics and future agents.

## 9. Website Types
The builder architecture must ultimately support multiple business models without separate disconnected products:
- Ecommerce/store
- Corporate/company website
- Catalog website
- Medical/doctor/clinic with appointments
- Lawyer/legal services
- Service businesses
- Other vertical templates
- Landing pages for campaigns (after core website/store capability is mature)

Priority rule: ecommerce/store maturity first, other site types next, dedicated landing-page tooling later.

## 10. Marketing and Analytics Direction
Future website/store workflows should make it simple to connect:
- Google Analytics
- Google Ads
- campaign tracking
- conversion events
- landing destinations
- CRM attribution

Advertising is not an isolated dashboard: traffic should land on measurable pages and feed customer/business intelligence.

## 11. AI Agent Vision
AI should evolve from content generation toward context-aware action.

Examples:
- suggest better page hierarchy
- identify weak product copy
- generate SEO/GEO content
- recommend banner/campaign changes
- identify conversion problems
- suggest product placement
- create campaign assets through connected generation services
- explain why an action is recommended
- execute approved actions when permissions allow

Agents should inherit the business and brand context rather than starting from zero every session.

## 12. Performance Promise
Storefront performance is a first-class product requirement.

Direction:
- minimal unnecessary client JavaScript
- SSR/streaming where appropriate
- CDN/edge caching
- responsive images
- WebP/AVIF
- lazy loading below the fold
- preload only critical assets
- lightweight reusable components
- measurable performance budgets

Avoid heavy page-builder architecture that produces slow storefronts.

## 13. TQM — Total Quality Management
TQM is permanent across product development and future operations.

Cycle:
Design -> Build -> Review -> Test -> Release -> Monitor -> Learn -> Improve

Definition of Done includes:
- real implementation, not simulated progress
- validation/testing
- user-facing verification where applicable
- security consideration
- performance consideration
- maintainability
- regression protection for important bugs

No feature is complete merely because a button or UI exists.

See also GitHub Issue #112.

## 14. Execution Rule
Never represent work as happening in the background when no tool/action is actually executing.

For repository work, meaningful completion should be evidenced by concrete artifacts such as code changes, commits, pull requests, tests, CI, previews, or verified runtime output.

## 15. Current Product Priority
Current highest priority: make the ecommerce Store Studio genuinely usable end-to-end.

Immediate quality gates include:
- reliable unified media upload for Hero, Banner, Product and Gallery
- reliable Add Product flow
- real catalog persistence
- promotion/discount blocks
- commerce layout presets/templates
- direct on-canvas editing
- SEO/GEO product editing
- fast storefront rendering

Do not distract the core team with landing-page tooling before the store experience is mature.

## 16. Decision Test
Before adding a feature, ask:
1. Does it simplify the merchant experience?
2. Does it use or improve shared Business Context?
3. Does it produce measurable business value?
4. Does it preserve performance, security and maintainability?
5. Does it strengthen the loop from understanding -> execution -> measurement -> improvement?

If a feature is impressive but does not improve that loop, it is not a priority.

## 17. Maintenance Rule
Update this document only when a strategic decision is sufficiently stable that future contributors should treat it as project memory. Tactical sprint status belongs in the Roadmap, not here.
