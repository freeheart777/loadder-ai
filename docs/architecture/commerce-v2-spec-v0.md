# Loadder Commerce Core V2 — Specification v0

This document defines behavior, not implementation.

## Domain primitives
- `Money`: integer minor units plus ISO/provider-neutral currency code.
- `Product`: sellable concept with slug, status, content, classification and metadata.
- `Variant`: purchasable SKU with options, price override, inventory policy and lifecycle state.
- `InventoryUnit`: available, reserved and committed quantities per variant/location.
- `Cart`: mutable collection of priced lines before order creation.
- `Order`: immutable commercial snapshot created from a validated cart.
- `Promotion`: rule set that can alter cart price when eligibility conditions are satisfied.

## Required invariants
- monetary values are integers; floating point is forbidden in persisted money calculations.
- tenant/workspace ownership is mandatory on every write and every lookup.
- a cart cannot contain variants from another store.
- an inactive product or variant cannot enter a new cart.
- inventory cannot become negative when policy is `DENY`.
- order line prices are snapshots and never change when catalog prices later change.
- promotion calculations are deterministic for identical inputs.

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