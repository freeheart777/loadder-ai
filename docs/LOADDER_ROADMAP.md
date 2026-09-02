# Loadder Roadmap

> Execution roadmap. Strategic intent belongs in `LOADDER_PROJECT_MEMORY.md`; this file tracks the order in which the product should become real.

## North Star
A business provides its data once. Loadder understands the business, builds its brand/business context, launches a professional digital presence, connects commerce/CRM/marketing, measures outcomes, and continuously improves execution.

## Phase 0 — Foundation [IN PROGRESS]
- Workspace/auth/ownership boundaries
- Business Profile
- Brand Book
- Business DNA
- Business Context
- persistent data model
- security gates
- CI/testing discipline
- TQM operating principle

Exit condition: shared context and tenancy are dependable enough for all higher modules.

## Phase 1 — Ecommerce Store Studio [CURRENT PRIORITY]
Goal: a non-technical merchant can create and edit a real store without developer help.

### 1.1 Media Pipeline — BLOCKER
- one canonical upload pipeline
- Hero upload
- Banner upload
- Product image upload
- Product gallery upload
- Media Library
- local development storage fallback
- production object storage
- visible diagnostic errors
- no Base64 product images stored as JSON

### 1.2 Product Flow — BLOCKER
- choose existing catalog product
- create product inside Studio
- price / compare-at price
- inventory
- category / brand
- image/gallery
- product copy
- SEO
- GEO
- immediate placement on Canvas
- persistence after refresh

### 1.3 Commerce Blocks
- featured products
- discounted products
- flash/shocking offer
- best sellers
- new arrivals
- related/recommended products
- category blocks
- brand wall
- trust blocks

### 1.4 Hero and Banner Layouts
- full width
- image only
- image + copy + CTA
- large + two small right
- large + two small left
- equal grids
- carousel
- responsive variants

### 1.5 Commerce Layout Engine
- smart presets
- vertical-specific store templates
- guarded drag/drop
- responsive constraints
- section duplication/reorder
- contextual toolbar
- on-canvas editing

### 1.6 Storefront Performance
- image optimization
- responsive assets
- lazy loading
- SSR/streaming assessment
- caching strategy
- JS budget
- Core Web Vitals baseline

Exit condition: merchant can build, populate, customize, save, refresh and operate a credible store end-to-end.

## Phase 2 — Website Studio Expansion
- corporate/company
- catalog
- service business
- medical/clinic/doctor + appointment patterns
- lawyer/legal
- reusable vertical template packs
- shared Brand/Business Context ingestion

Exit condition: website types are configurations of one platform, not separate builders.

## Phase 3 — Content Intelligence
- customer copy
- SEO content
- GEO / generative search content
- hybrid content mode
- FAQ / buying guides
- connected image generation
- connected video generation
- brand-aware content generation

## Phase 4 — CRM / Customer 360
- leads/customers
- lifecycle
- interactions
- orders and commerce history
- attribution
- segmentation
- automation triggers
- merchant-friendly customer view

## Phase 5 — Marketing and Growth
- Google Analytics connection
- Google Ads connection
- campaign measurement
- conversion events
- audiences
- attribution
- campaign recommendations
- controlled AI-assisted optimization

Dedicated landing-page tooling belongs here or late Phase 2/3 only after the core store/site engine is mature.

## Phase 6 — AI Growth Agents
- context-aware recommendations
- page optimization agent
- commerce merchandising agent
- content agent
- CRM follow-up agent
- campaign agent
- human approval/governance
- action audit trail

## Phase 7 — Continuous Intelligence
- cross-module analytics
- business event stream
- recommendation learning loop
- experiment framework
- forecasting
- anomaly detection
- outcome-based improvement

## Future Ecosystem
- Template Marketplace
- Block Marketplace
- AI Agent Marketplace
- Plugin Ecosystem

## Permanent Cross-Cutting Gates
Every phase must satisfy:
- TQM
- security
- tenancy isolation
- performance
- maintainability
- observability
- accessibility
- responsive UX
- SEO/GEO implications
- real validation

## Current Next Actions
1. Unify Store Studio + Product media upload onto one real storage pipeline.
2. Add explicit upload diagnostics and regression coverage.
3. Verify Add Product end-to-end after refresh.
4. Complete Hero/Banner layout presets.
5. Complete promotion blocks and Commerce Layout templates.

## Roadmap Rule
Do not mark an item DONE because UI exists. DONE means the end-to-end user outcome is implemented, persisted, tested and observable.
