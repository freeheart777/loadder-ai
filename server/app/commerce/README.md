# Loadder Ecommerce Core v1

Commerce is scoped to an authenticated Workspace and a `STORE` site project.

Core flow:

`Product -> Variant/SKU -> Inventory -> Cart -> Coupon/Shipping -> Checkout -> Order`

Amounts are stored as integer minor units and every cart/order carries an explicit currency. Payment credentials are referenced, never stored directly in commerce records. Checkout is transactional and decrements inventory only when inventory policy is `DENY`.

This core is provider-neutral: payment and shipping providers are configuration adapters so Iran-specific and international providers can coexist without changing the commerce domain model.
