import { requireWorkspaceId } from "../tenant-context.mjs";
import { PaymentAttemptError } from "./payment-attempt-service.mjs";
import { paymentAdapters } from "./payment-adapters.mjs";
import { gatewayCredentials } from "./payment-verification-service.mjs";

// Attempts that may still turn into money: never start a second charge while one exists.
const OPEN = new Set(["REDIRECT_READY", "PENDING_VERIFICATION", "RECONCILIATION_REQUIRED"]);
// A link issued this recently may be on the customer's screen right now; the gateway reports it
// "unpaid" until they finish, so it must not be verified-and-failed or superseded yet.
// ponytail: fixed 15 min (roughly a ZarinPal session); make it per-adapter if a gateway differs.
const IN_FLIGHT_MS = 15 * 60 * 1000;
const IN_FLIGHT = new Set(["CREATED", "REDIRECT_READY", "PENDING_VERIFICATION"]);

// Hands an UNPAID order to the site's CONNECTED gateway. Used by checkout (first attempt)
// and by customer retry. Settlement is never done here -- only verifyAndSettle() does that.
export function createPaymentInitiationService({ db, paymentAttemptService, paymentVerificationService, adapters = paymentAdapters, logger = console, now = () => Date.now() } = {}) {
  if (!db || !paymentAttemptService || !paymentVerificationService) throw new Error("db, paymentAttemptService and paymentVerificationService are required.");
  const requireOrder = (orderId) => {
    const order = db.prepare("SELECT id,site_project_id,payment_status FROM ecommerce_orders WHERE id=? AND workspace_id=?").get(String(orderId || ""), requireWorkspaceId());
    if (!order) throw new PaymentAttemptError("Order not found.", "PAYMENT_ORDER_NOT_FOUND", 404);
    return order;
  };

  // null = no usable gateway (manual order). Throws if the gateway refuses; the attempt is then FAILED.
  async function start(orderId, { idempotencyKey, callbackBase }) {
    const order = requireOrder(orderId);
    const config = db.prepare("SELECT id,provider_key,credential_reference,config_json FROM ecommerce_payment_providers WHERE workspace_id=? AND site_project_id=? AND status='CONNECTED' ORDER BY created_at LIMIT 1")
      .get(requireWorkspaceId(), order.site_project_id);
    const adapter = config && adapters[String(config.provider_key).toUpperCase()];
    if (!adapter) return null;
    const attempt = paymentAttemptService.create({ orderId: order.id, provider: config.provider_key, providerConfigId: config.id, idempotencyKey });
    if (attempt.status !== "CREATED") throw new PaymentAttemptError("A payment for this order is already in progress.", "PAYMENT_IN_PROGRESS", 409);
    let initiated;
    try {
      initiated = await adapter.createPayment({
        ...gatewayCredentials(config), amountMinor: attempt.amountMinor, currency: attempt.currency, description: `سفارش ${order.id}`,
        callbackUrl: `${callbackBase}/storefront/payments/${attempt.id}/callback`,
      });
    } catch (error) {
      try { paymentAttemptService.recordOutcome(attempt.id, "FAILED", error?.code || "GATEWAY_REQUEST_FAILED"); } catch (e) { logger.error?.("Payment attempt failure not recorded:", e); }
      throw error;
    }
    paymentAttemptService.markRedirectReady(attempt.id, initiated.authority);
    return { provider: attempt.provider, redirectUrl: initiated.redirectUrl };
  }

  return Object.freeze({
    start,
    async retry(orderId, { callbackBase }) {
      const order = requireOrder(orderId);
      if (order.payment_status === "PAID") return { result: "paid" };
      if (order.payment_status !== "UNPAID") throw new PaymentAttemptError("Order is not payable.", "PAYMENT_ORDER_NOT_PAYABLE", 409);
      const inProgress = () => new PaymentAttemptError("A previous payment is still in progress. Try again in a few minutes.", "PAYMENT_IN_PROGRESS", 409);
      // Double-charge guard 1: a recent link may be mid-payment -- do not touch it. (No await between
      // this check and start()'s create(), so a concurrent retry sees the new CREATED attempt here.)
      const cutoff = new Date(now() - IN_FLIGHT_MS).toISOString();
      if (paymentAttemptService.listForOrder(order.id).some((a) => IN_FLIGHT.has(a.status) && a.updatedAt > cutoff)) throw inProgress();
      // Double-charge guard 2: the customer may already have paid an older attempt.
      for (const attempt of paymentAttemptService.listForOrder(order.id).filter((a) => OPEN.has(a.status))) {
        if ((await paymentVerificationService.verifyAndSettle(attempt.id)).result === "paid") return { result: "paid" };
      }
      // Double-charge guard 3: anything still open has an unknown outcome -- refuse a second charge.
      const attempts = paymentAttemptService.listForOrder(order.id);
      if (attempts.some((a) => OPEN.has(a.status))) throw inProgress();
      // A stale CREATED never got a gateway link, so it cannot be paid; close it so it does not linger.
      for (const stale of attempts.filter((a) => a.status === "CREATED")) paymentAttemptService.recordOutcome(stale.id, "CANCELLED", "SUPERSEDED_BY_RETRY");
      const payment = await start(order.id, { idempotencyKey: `retry:${order.id}:${attempts.length}`, callbackBase });
      if (!payment) throw new PaymentAttemptError("Online payment is not available for this store.", "PAYMENT_PROVIDER_UNAVAILABLE", 422);
      return { result: "redirect", redirectUrl: payment.redirectUrl };
    },
  });
}
