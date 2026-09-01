# Commerce Vendor Independence

## Decision
Loadder may adopt open-source commerce engines (for example Medusa) only behind a Loadder-owned provider boundary. No storefront, CRM, Ads, Business Brain, Studio, or public API may depend directly on a vendor SDK or vendor-specific data model.

## Non-negotiable rules

1. **Self-host first** — production must run without a vendor cloud account.
2. **Pinned source** — every adopted engine is pinned to an exact release/commit and mirrored or vendored into infrastructure we control.
3. **No remote kill switch** — storefront checkout, catalog reads, orders, inventory, and admin operations must not require calls to the upstream vendor's control plane.
4. **Loadder-owned contracts** — application code calls the Loadder Commerce Provider contract, never Medusa/Vendure/Saleor directly.
5. **Canonical Loadder IDs** — external provider IDs are mapping data, not primary identities exposed across the platform.
6. **Exportability** — products, variants, inventory, carts where meaningful, customers, orders, promotions, shipping configuration, and media mappings must be exportable in a documented Loadder format.
7. **Migration path** — every external provider must have an exit plan back to Loadder Native or to another provider.
8. **No proprietary runtime dependency by default** — paid/enterprise modules require an explicit architecture and legal review.
9. **Offline recovery assets** — source snapshot, lockfiles, container build recipe, schema/migration files, checksums, and license notices are retained by Loadder.
10. **Security review** — dependency audit, startup/network inspection, telemetry review, secret scan, and outbound-domain allowlist are required before production adoption.

## Target architecture

```text
Website Studio / Storefront / CRM / Agents / Ads
                    |
          Loadder Commerce Contract
                    |
          Commerce Provider Factory
             /               \
    Loadder Native        Medusa Adapter
             \               /
        Loadder Canonical Events
                    |
      Business Brain / Analytics
```

## Provider contract: phase 1

The first stable boundary covers:

- products: list/get/create/update
- variants: create/update
- inventory: adjust
- carts: create/get/add item/set quantity
- coupons: apply
- shipping: select
- checkout: create order
- orders: get

Future capabilities must be added to the Loadder contract before any vendor-specific implementation is allowed into product code.

## Medusa spike rules

The Medusa spike is an isolated adapter experiment. It must not replace the current ecommerce service until contract tests prove equivalent behavior for Product -> Cart -> Checkout -> Order and rollback to `loadder-native` is demonstrated.

The spike must record:

- exact upstream repository and commit/tag
- license files and notices
- required services (database, Redis, object storage, etc.)
- every outbound network dependency
- every environment variable
- schema/data mapping to Loadder canonical models
- import/export scripts
- startup from a clean machine using only Loadder-controlled artifacts

## Acceptance test for independence

A provider is not production-ready until this drill passes:

1. Disable access to upstream GitHub/vendor cloud.
2. Start the complete commerce stack from Loadder-controlled source/images.
3. Create a product and variant.
4. Adjust inventory.
5. Complete storefront Product -> Cart -> Checkout -> Order.
6. Restart all services and verify catalog/order persistence.
7. Export the store dataset.
8. Switch provider in a staging environment without changing Storefront/Studio business code.

If any essential operation fails because the upstream organization is unavailable, the provider fails the independence requirement.

## What remains Loadder-owned

These are strategic product IP and are never delegated to a commerce engine: Visual Studio, Brand Book context, AI store generation, Intent Engine, Business Brain, CRM intelligence, marketing automation, Ads orchestration, GEO/AI visibility, agent permissions, and Loadder public/agent contracts.
