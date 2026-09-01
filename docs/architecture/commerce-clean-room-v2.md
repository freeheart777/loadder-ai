# Loadder Commerce Core V2 — Clean-room protocol

## Objective
Build a Loadder-owned commerce implementation from Loadder requirements and independently written specifications. External commerce projects may be studied as references, but their source code must not be copied, translated line-for-line, mechanically transformed, or used as implementation scaffolding.

## Separation of concerns

### Research track
May inspect public documentation, product behavior, public APIs, standards, and permissively licensed source where legally appropriate. Its output is limited to neutral specifications:
- capability name and business purpose
- inputs, outputs and validation rules
- state transitions
- invariants and edge cases
- interoperability expectations
- security and performance requirements

Research notes must not contain copied implementation bodies or distinctive source-code structures.

### Implementation track
Implements only from Loadder specifications and tests. Implementation code, naming, module boundaries, schemas, algorithms and APIs are chosen for Loadder's architecture.

## Non-negotiable rules
1. No copy/paste from Medusa, Vendure, Saleor, Shopify SDKs or other commerce engines into V2 implementation files.
2. No mechanical rewrite, transpilation, variable renaming or AI paraphrasing of third-party source code.
3. Enterprise/source-available code is excluded from implementation research unless separately approved by legal review.
4. Every V2 module starts with a Loadder specification and Loadder-authored contract tests.
5. Runtime dependencies on third-party commerce cloud control planes are prohibited.
6. All persistent business data uses Loadder-owned schemas or a provider-neutral migration representation.
7. The existing provider boundary remains the compatibility layer until V2 reaches parity.

## Delivery sequence
1. Catalog + variants
2. Inventory reservations
3. Pricing
4. Promotions
5. Cart
6. Checkout
7. Orders
8. Fulfillment
9. Returns/refunds
10. Customer accounts
11. Agent Commerce API

Each module must pass behavior tests, tenant isolation tests, failure tests and data export/import tests before replacing native V1 behavior.

## Provenance record
For every research source we record project/document name, URL or repository, version/tag/commit where applicable, license, date reviewed and which neutral requirements were learned. We do not mark third-party source as Loadder-owned.

## Ownership statement
The V2 implementation, specifications, schemas, tests, adapters, deployment manifests and Loadder-specific business logic authored by the Loadder project are Loadder-owned. Third-party copyrights and licenses remain with their respective owners.