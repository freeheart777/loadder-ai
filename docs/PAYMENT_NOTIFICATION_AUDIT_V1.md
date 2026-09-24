# Loadder Commerce — Payment & Order Notification Audit V1

Date: 2026-09-24
Scope: `src/components/store-studio-v16/` (checkout/cart UI: `StudioCanvas.tsx`'s `CartCanvas`/`CheckoutForm`/`SuccessCanvas`, `PublicStorefrontRuntime.tsx`, `src/lib/publicCart.ts`), `server/app/commerce/` (incl. `v2/`), `server/app/routes/ecommerce.mjs`, `server/app/routes/auth.mjs`, and the payment/notification services those files call (`ecommerce-service.mjs`, `payment-attempt-service.mjs`, `commerce-provider-contract.mjs`, `loadder-commerce-provider.mjs`; a notification-service search led to `server/services/messaging.mjs`, outside the `app/` tree but the only real candidate found).

Goal: determine what's required for a Loadder Commerce store to accept a real customer payment and for the merchant to be notified a real order arrived.

---

## 1. Current checkout flow

The public checkout flow (`auth.mjs`, mounted under `/api/auth/storefront/*`) is a straight, rate-limited, capability-secured sequence, no session/login required:

1. `POST /storefront/:siteProjectId/carts` → creates a cart, returns `{cart, cartCapability}`. The capability is an opaque token the client must send back as `X-Loadder-Cart-Capability` on every later cart call — this is how an anonymous shopper's cart stays private without an account.
2. `POST /storefront/carts/:cartId/items`, `PUT .../items/:variantId` → add/update line items; server re-validates the variant belongs to the same site and is `ACTIVE`.
3. `POST /storefront/carts/:cartId/coupon`, `POST /storefront/carts/:cartId/shipping` → both rate-limited (`checkoutLimiter`, 20/min), both re-validate against the DB (coupon/shipping method must belong to this site and be active).
4. `GET /storefront/:siteProjectId/checkout-options` → returns real shipping methods from `ecommerce_shipping_methods`, and a **hardcoded single payment method**: `[{key:"manual", title:"پرداخت آزمایشی / هماهنگی با فروشگاه", enabled:true}]`.
5. `POST /storefront/carts/:cartId/checkout` (rate-limited, 20/min) → server-side trims/validates name+phone+shipping address, calls `ecommerceService.checkout()` with `paymentProvider` **hardcoded to `"manual"`** (not read from the request body, not read from any merchant configuration), creates a real `ecommerce_orders` row with `payment_status:"UNPAID"`, and returns `{order, receiptCapability}`.

On the frontend, `CheckoutForm` (`StudioCanvas.tsx`) collects name/phone/email/address only — **there is no payment-method selector in the UI at all**, consistent with the backend only ever offering `"manual"`. On success it calls `onRuntimePage("success")`, which renders `SuccessCanvas`: a static "سفارش شما با موفقیت ثبت شد." message with a "بازگشت به فروشگاه" button — **no order number, no receipt link, nothing that lets the customer refer back to this specific order.**

**Money-safety is genuinely solid** in this path: shipping/coupon/variant validity is re-checked server-side on every mutation, the checkout route trims and length-caps every input, and `ecommerce_orders` rows store server-computed totals only — the client cannot inject a price.

## 2. Current payment capability

**Real capability:** exactly one — "manual" (i.e., no online payment; the merchant is expected to arrange payment out-of-band, e.g. cash on delivery or a bank transfer they confirm themselves). The order is created `UNPAID` and nothing in the audited scope ever transitions it.

**What exists but is disconnected:**
- **`payment-attempt-service.mjs`** (`server/app/commerce/`) is a complete, well-designed, money-safe payment-attempt framework: `create()` rejects client-supplied `amountMinor`/`currency` ("Payment money is server-derived"), is idempotency-key protected, looks up a real `ecommerce_payment_providers` config row, and `settleTransaction()` cross-checks provider/amount/currency between the attempt and the order before marking it `PAID`. `defineCommercePaymentProviderAdapter()` defines exactly the four methods (`createPayment`, `verifyPayment`, `refundPayment`, `verifyRefund`) a real gateway integration would need to implement. **Nothing in `server/app/routes/` ever imports this file** — confirmed by `grep -rl "payment-attempt-service" server/app/routes` returning nothing; it's exercised only by `server/test/commerce-payment-foundation.test.mjs` and two financial-ledger tests.
- **`PUT /stores/:siteProjectId/payment-providers/:providerKey`** (`ecommerce.mjs:56` → `ecommerceService.configurePaymentProvider()`) lets a merchant store a provider key/config/credential-reference row in `ecommerce_payment_providers`. But this call does **no validation** that the `providerKey` corresponds to any real, supported gateway, and — more importantly — **nothing reads this table at checkout time.** A merchant could "configure Zarinpal" here and it would have zero effect on what happens when a customer checks out.
- **`ecommerceService.checkout()`** itself will happily store whatever string is passed as `input.paymentProvider` into the order row — the *data model* supports a real provider name, but the one caller that reaches it (`auth.mjs`'s public route) never passes anything but `"manual"`.
- **`commerce/v2/`'s engines** (cart/checkout/pricing/promotion/etc.) are a separate, test-only subsystem (previously documented in `docs/COMMERCIAL_READINESS_AUDIT_V1.md`) and do not change this picture — none of them call a payment gateway either.

**Conclusion:** the hard, correctness-critical part of taking a real payment (idempotency, server-derived money, provider/amount/currency cross-checks) is already built and tested. What's missing is entirely wiring: one real gateway adapter implementing the four-method contract, a checkout-route change to actually call it, and connecting the admin `configurePaymentProvider` UI-equivalent to something that validates and is actually read at checkout.

## 3. Missing payment pieces

1. **No concrete gateway adapter.** Zero implementations of `defineCommercePaymentProviderAdapter()` exist for any real provider (Zarinpal is the obvious first candidate given the Persian-language product; also true for Stripe/any card processor).
2. **Checkout route never branches on a configured provider.** `auth.mjs`'s public checkout hardcodes `"manual"`; it would need to look up the site's configured provider, and — if one exists and is `ACTIVE` — create a payment attempt and redirect/return a payment URL instead of immediately marking the order created-but-unpaid-forever.
3. **No provider-key validation.** `configurePaymentProvider()` accepts any string as `providerKey` with no allow-list, no credential format check, no test-charge/sandbox verification before going live.
4. **No frontend payment step at all.** `CheckoutForm` has no payment-method selection, no redirect-to-gateway handling, no return-from-gateway callback page. This is pure UI work once a backend provider exists — but currently there is nothing to build it against.
5. **No webhook/callback endpoint for asynchronous payment confirmation** — real gateways typically confirm payment via a server-to-server callback, not just the customer's redirect back; no such route exists in the audited scope.

## 4. Order notification capability

**Capability found, unused for orders.** `server/services/messaging.mjs` (495 lines, outside the `server/app/` tree but the only real match for "notification service" found by targeted search) exports `sendMessage({channel, recipient, message, subject, metadata})` supporting two real channels:
- **SMS** via Kavenegar (an Iranian SMS gateway) — real provider integration, gated by `SMS_PROVIDER`/`KAVENEGAR_API_KEY` env vars, with a `"simulator"` fallback (the default) when unconfigured.
- **Email** via Resend — same pattern, gated by `EMAIL_PROVIDER`/`RESEND_API_KEY`/`RESEND_FROM_EMAIL`, `"simulator"` default.
- `getMessagingStatus()` reports whether each channel is actually configured or just simulating.

**This is not a stub** — it's a real, provider-backed utility. But `grep -rl "services/messaging.mjs" server/app` returns **nothing**: it is not imported by `ecommerce-service.mjs`, `site-lead-service.mjs`, `auth.mjs`, or `ecommerce.mjs`. Neither a new order (`checkout()`) nor a new lead (`site-lead-service.mjs`'s `submit()`, confirmed in the prior Commercial Readiness Audit) nor an order-status change (`setOrderStatus()`) triggers any call to it. A merchant today has **zero automated way to learn a sale happened** — they would need to actively poll `GET /stores/:siteProjectId/orders`.

**What's required:** one function call — `sendMessage({channel:"sms"|"email", ...})` — from `ecommerce-service.mjs`'s `checkout()` (to the merchant) and, ideally, a second one to the customer (order confirmation) once contact info is available. This is very likely the single lowest-effort, highest-impact fix in this entire audit: the hard infrastructure (real SMS/email provider integration) already exists and works; it is simply never called from the commerce path.

## 5. Customer receipt capability

**Backend: real and secure.** `POST /storefront/carts/:cartId/checkout` returns `{order, receiptCapability}` — an opaque, capability-hash-gated token (`ORDER_CAPABILITY_HEADER`, matched via `matchesPublicCapability()` in `public-commerce-capability.mjs`). `GET /storefront/orders/:orderId` (`auth.mjs:57`), when called with that exact capability header, returns the full order (status, payment status, fulfillment status, items, totals). This is a genuinely well-designed anonymous-receipt pattern — no login needed, no way to guess another customer's order.

**Frontend: the capability is discarded.** `PublicStorefrontRuntime.tsx`'s checkout adapter does `const { order } = await checkoutPublicCart(...)` — **`receiptCapability` is destructured out of the response and never used again**: not stored in `localStorage` (unlike the cart capability, which *is* persisted via `src/lib/publicCart.ts`'s pattern), not turned into a "view your receipt" link, nothing. `SuccessCanvas` shows a generic thank-you message with no order number. **A real customer who completes checkout today has no way to ever look up their order again through the product** — the one credential that would let them do so is thrown away the instant it arrives.

**What's required:** persist `receiptCapability` (and the order id) the same way `publicCart.ts` already persists the cart capability, and surface a "پیگیری سفارش" (track order) link/page on `SuccessCanvas` that uses it against the already-working `GET /storefront/orders/:orderId`. This is also low-effort — the backend endpoint is done and tested; it's a frontend wiring gap identical in shape to the create-website/template-selection gap closed in the previous task.

## 6. P0/P1/P2 roadmap

### P0 — cannot sell real payment-collecting commerce without these
1. Wire `sendMessage()` (existing, real, `server/services/messaging.mjs`) into `ecommerceService.checkout()` so the merchant gets an SMS/email the moment an order is created. Smallest, highest-leverage fix in this audit.
2. Persist and surface `receiptCapability` on the frontend so a customer can look up their own order after checkout (mirror the existing `publicCart.ts` cart-capability pattern).
3. Pick one real payment gateway, implement it against the already-built `defineCommercePaymentProviderAdapter` contract, and change the public checkout route to actually use a site's configured provider instead of hardcoding `"manual"`.

### P1 — important before scaling
1. Validate `providerKey`/credentials in `configurePaymentProvider()` against a real allow-list before treating a provider as usable — currently any string is accepted silently.
2. Add a payment webhook/callback route for asynchronous gateway confirmation (most real gateways don't confirm payment purely via the customer's browser redirect).
3. Add a customer order-confirmation notification (not just the merchant-facing one in P0-1) once the gateway/receipt work lands.
4. Decide the fate of `commerce/v2`'s unused engines (already flagged in the Commercial Readiness Audit) — they don't block payment/notification work, but carrying them unreconciled adds ongoing confusion about which checkout path is "real."

### P2 — future improvements
1. Add a merchant-facing "test payment" / sandbox-mode toggle per provider before going live, now that a real gateway adapter will exist.
2. Add order-status-change notifications (e.g., "your order shipped") once fulfillment status is actively used by a merchant workflow.
3. Add delivery-failure handling/retries for the messaging service itself (currently out of scope to assess — `messaging.mjs`'s own retry/failure behavior wasn't part of this audit's file list).
