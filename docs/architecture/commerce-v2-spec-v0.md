# Loadder Commerce Core V2 — Specification v0

This document defines behavior, not implementation.

## Domain primitives
- `Money`: integer minor units plus ISO/provider-neutral currency code.
- `Product`: sellable concept with slug, status, content, classification and metadata.
- `Variant`: purchasable SKU with options, price override, inventory policy and lifecycle state.
- `InventoryUnit`: on-hand, reserved and committed quantities per variant/location.
- `Cart`: mutable collection of priced lines before order creation.
- `Order`: immutable commercial snapshot created from a validated cart.
- `Promotion`: rule set that can alter cart price when eligibility conditions are satisfied.

## Required invariants
- monetary values are integers; floating point is forbidden in persisted money calculations.
- tenant/workspace ownership is mandatory on every write and every lookup.
- a cart cannot contain variants from another store.
- an inactive product or variant cannot enter a new cart.
- inventory cannot oversell when policy is `DENY`.
- order line prices are snapshots and never change when catalog prices later change.
- promotion calculations are deterministic for identical inputs.
- domain functions do not mutate their inputs.

## Catalog / Variant v0
### Product
A product owns `workspaceId`, `storeId`, lifecycle status, slug, classification and metadata. IDs and ownership fields are immutable across updates.

### Variant
A variant owns a globally scoped SKU within its storage boundary, product ownership, option values, optional price override, lifecycle state and inventory policy.

### Sellability
A variant is sellable only when:
- its product is `ACTIVE`;
- the variant itself is active;
- product, variant, workspace and store ownership agree.

Cross-workspace, cross-store or cross-product relationships are rejected before pricing/cart operations.

## Inventory Reservation v0
Inventory is modeled per `(workspace, store, variant, location)`.

`available = onHand - reserved - committed`

### Operations
- `reserve`: moves available capacity into `reserved` without reducing `onHand`.
- `release`: decreases `reserved`.
- `commit`: moves units from `reserved` to `committed`.
- `adjustOnHand`: changes physical stock while preventing `onHand` from dropping below allocated stock.

### Rules
- quantity inputs are integers.
- reservation/release/commit operations are deterministic and return new state rather than mutate input state.
- `DENY` rejects reservations larger than available stock.
- `ALLOW` permits backorder-style negative availability but never changes the original state.
- release/commit cannot underflow an existing reservation.
- initial inventory state may not have `reserved + committed > onHand`.
- snapshots have stable ordering so persistence/event hashing is reproducible.

## Promotion v0
### Supported reward types
- percentage discount
- fixed cart discount
- fixed line discount

### Eligibility conditions
- minimum subtotal
- product/category/brand inclusion
- product/category/brand exclusion
- minimum line quantity
- start/end time
- usage limit

### Evaluation output
`evaluatePromotion(cart, promotion, context)` returns a provider-neutral result:
- `eligible`
- `discountMinor`
- `lineDiscounts[]`
- `reasonCodes[]`
- `promotionId`

### Rules
- final discount cannot exceed eligible merchandise value.
- percentage is clamped to 0..100.
- inactive/expired/exhausted promotions return zero discount with a reason code.
- exclusions win over inclusions.
- no mutation of cart input is allowed during evaluation.

## V2 compatibility goal
The V2 core must eventually satisfy the existing Loadder Commerce Provider Contract for product, variant, inventory, cart, coupon/shipping, checkout and order operations. New capabilities may extend the contract only through explicit versioning.

## Future agent-facing contract
V2 domain operations must remain suitable for safe tool exposure such as `discover_products`, `check_inventory`, `create_cart`, `apply_promotion`, `checkout`, `get_order`, `track_order` and `return_item`, with authorization enforced outside the domain functions.
