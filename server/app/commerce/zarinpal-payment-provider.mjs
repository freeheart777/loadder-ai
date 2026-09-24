import { PaymentAttemptError, defineCommercePaymentProviderAdapter } from "./payment-attempt-service.mjs";

// ZarinPal v4 REST gateway. Redirect model: request -> StartPay -> callback -> verify.
// Merchant ID comes from ecommerce_payment_providers.credential_reference;
// config_json.sandbox=true targets sandbox.zarinpal.com.
const gatewayHost = (sandbox) => (sandbox ? "https://sandbox.zarinpal.com" : "https://payment.zarinpal.com");

// Loadder stores money as display amount x 100 (see formatMoney in store-studio-v16/config.ts);
// ZarinPal takes whole Toman (IRT) or Rial (IRR). Anything else is refused, never guessed.
export function zarinpalAmount(amountMinor, currency) {
  if (currency !== "IRT" && currency !== "IRR") throw new PaymentAttemptError(`ZarinPal does not support ${currency}.`, "ZARINPAL_UNSUPPORTED_CURRENCY", 422);
  if (!Number.isInteger(amountMinor) || amountMinor <= 0 || amountMinor % 100 !== 0) throw new PaymentAttemptError("Amount is not payable through ZarinPal.", "ZARINPAL_INVALID_AMOUNT", 422);
  return amountMinor / 100;
}

async function call(sandbox, operation, body) {
  // Looked up at call time so tests can stub globalThis.fetch.
  const response = await globalThis.fetch(`${gatewayHost(sandbox)}/pg/v4/payment/${operation}.json`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const payload = await response.json().catch(() => ({}));
  return payload?.data && !Array.isArray(payload.data) ? payload.data : {};
}

const unsupported = () => { throw new PaymentAttemptError("ZarinPal refunds are not supported yet.", "ZARINPAL_REFUND_UNSUPPORTED", 501); };

export const zarinpalPaymentProvider = defineCommercePaymentProviderAdapter({
  async createPayment({ merchantId, sandbox = false, amountMinor, currency, callbackUrl, description }) {
    const data = await call(sandbox, "request", {
      merchant_id: merchantId, amount: zarinpalAmount(amountMinor, currency), currency,
      callback_url: callbackUrl, description,
    });
    if (data.code !== 100 || !data.authority) throw new PaymentAttemptError("ZarinPal rejected the payment request.", "ZARINPAL_REQUEST_REJECTED", 502);
    return { authority: String(data.authority), redirectUrl: `${gatewayHost(sandbox)}/pg/StartPay/${data.authority}` };
  },
  async verifyPayment({ merchantId, sandbox = false, amountMinor, currency, authority }) {
    const data = await call(sandbox, "verify", { merchant_id: merchantId, amount: zarinpalAmount(amountMinor, currency), authority });
    // 100 = verified now, 101 = already verified (callback replay). Both carry ref_id.
    const verified = (data.code === 100 || data.code === 101) && data.ref_id != null;
    return { verified, refId: verified ? String(data.ref_id) : null, code: data.code ?? null };
  },
  refundPayment: unsupported,
  verifyRefund: unsupported,
});
