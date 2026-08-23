import crypto from "node:crypto";
import { landingHash } from "../landing/landing-contracts.mjs";
import { PaymentProviderError } from "../payments/payment-providers.mjs";
import { paymentProviderRegistry } from "../payments/payment-provider-registry.mjs";

export class PaymentOrderError extends Error { constructor(code, status = 400) { super(code); this.code = code; this.status = status; } }
const fail = (code, status = 400) => { throw new PaymentOrderError(code, status); };
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const strict = (value, keys) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).every((key) => keys.includes(key));
const exact = (value, keys) => strict(value, keys) && Object.keys(value).length === keys.length;
const bounded = (value, max) => typeof value === "string" && value.length > 0 && value.length <= max;
const validIso = (value) => { if (!bounded(value, 64)) return false; const date = new Date(value); return !Number.isNaN(date.getTime()) && date.toISOString() === value; };
const validReference = (value) => bounded(value, 200) && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value);
const validAuthorization = (value) => {
  if (!exact(value, ["providerAttemptReference", "redirectUrl", "expiresAt"]) || !validReference(value.providerAttemptReference) || !bounded(value.redirectUrl, 2000) || value.expiresAt !== null && !validIso(value.expiresAt)) return false;
  try { const url = new URL(value.redirectUrl); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
};
const validVerification = (value) => {
  if (!exact(value, ["status", "providerTransactionReference", "verifiedAmount", "currency", "verifiedAt", "boundedProviderCode"]) || !["VERIFIED", "PENDING", "FAILED"].includes(value.status) || !bounded(value.boundedProviderCode, 80)) return false;
  if (value.status !== "VERIFIED") return value.providerTransactionReference === null && value.verifiedAmount === null && value.currency === null && value.verifiedAt === null;
  return validReference(value.providerTransactionReference) && Number.isSafeInteger(value.verifiedAmount) && value.verifiedAmount >= 0 && /^[A-Z]{3}$/.test(value.currency) && validIso(value.verifiedAt);
};

export function createPaymentOrderService({ repository, provider, callbackBaseUrl, registry = paymentProviderRegistry, now = () => new Date() }) {
  const timestamp = () => now().toISOString();
  const binding = () => registry.get(provider.provider);
  const idempotencyKey = (value) => { if (typeof value !== "string" || !value.trim() || value.length > 200) fail("PAYMENT_IDEMPOTENCY_CONFLICT", 409); return value.trim(); };
  const capability = (token, reference) => { if (typeof token !== "string" || token.length < 32 || typeof reference !== "string") fail("PAYMENT_ATTEMPT_NOT_FOUND", 404); return repository.pending(reference, hash(token)) || fail("PAYMENT_ATTEMPT_NOT_FOUND", 404); };
  const safe = (attempt) => Object.freeze({ paymentAttemptId: attempt.publicId, status: attempt.status, redirectUrl: attempt.status === "REDIRECT_READY" ? attempt.redirectUrl : undefined, createdAt: attempt.createdAt, updatedAt: attempt.updatedAt, failureCode: attempt.failureCode });

  const service = {
    readiness() { const registered = binding(); return { paymentConfigured: Boolean(registered && provider.configured), paymentEnabled: Boolean(registered && provider.configured && provider.enabled), provider: registered && provider.configured ? provider.provider : null }; },
    initiate(token, input, rawKey) {
      if (!strict(input, ["orderReference"]) || typeof input.orderReference !== "string") fail("PAYMENT_ATTEMPT_INVALID");
      const pending = capability(token, input.orderReference);
      if (pending.status !== "AWAITING_PAYMENT" || repository.verified(pending.id) || repository.orderByPending(pending.id)) fail("PAYMENT_ORDER_ALREADY_PAID", 409);
      if (!repository.eligible(pending.id)) fail("PAYMENT_ATTEMPT_INVALID", 409);
      const key = idempotencyKey(rawKey), normalized = { pendingOrderId: pending.id, provider: provider.provider, providerVersion: provider.version }, requestHash = landingHash(normalized), prior = repository.attemptByKey(pending.workspaceId, pending.id, key);
      if (prior) { if (prior.requestHash !== requestHash) fail("PAYMENT_IDEMPOTENCY_CONFLICT", 409); return { attempt: safe(prior), reusedResult: true }; }
      if (repository.activeAttempts(pending.id) >= 1) fail("PAYMENT_ATTEMPT_INVALID", 409);
      if (!binding() || !provider.configured || !provider.enabled) fail("PAYMENT_NOT_CONFIGURED", 503);
      const created = repository.createAttempt({ workspaceId: pending.workspaceId, pendingOrderId: pending.id, provider: provider.provider, providerVersion: provider.version, amount: pending.grandTotal, currency: pending.currency, key, requestHash, now: timestamp() });
      if (!created.created) { if (created.value.requestHash !== requestHash) fail("PAYMENT_IDEMPOTENCY_CONFLICT", 409); return { attempt: safe(created.value), reusedResult: true }; }
      repository.authorizationPending({ id: created.value.id, now: timestamp() });
      try {
        const callbackUrl = new URL("/api/public/commerce/payments/return", callbackBaseUrl); callbackUrl.searchParams.set("attempt", created.value.publicId);
        if (callbackUrl.protocol !== "https:") throw new PaymentProviderError("PAYMENT_AUTHORIZATION_FAILED");
        const result = provider.createPayment({ attemptPublicId: created.value.publicId, pendingOrderReference: pending.publicReference, amount: pending.grandTotal, currency: pending.currency, callbackUrl: callbackUrl.toString() });
        if (!validAuthorization(result)) throw new PaymentProviderError("PAYMENT_AUTHORIZATION_FAILED");
        const value = repository.authorizationReady({ id: created.value.id, publicId: created.value.publicId, reference: result.providerAttemptReference, redirectUrl: result.redirectUrl, expiresAt: result.expiresAt, now: timestamp() });
        return { attempt: { ...safe(value), redirectUrl: result.redirectUrl } };
      } catch (error) {
        const code = error instanceof PaymentProviderError ? error.code : "PAYMENT_PROVIDER_UNAVAILABLE";
        repository.authorizationFailed({ id: created.value.id, publicId: created.value.publicId, code, now: timestamp() }); fail(code, 503);
      }
    },
    returnSignal(input) {
      if (!strict(input, ["attempt", "status"]) || typeof input.attempt !== "string" || input.attempt.length > 100 || input.status !== undefined && typeof input.status !== "string") fail("PAYMENT_REFERENCE_INVALID", 404);
      const attempt = repository.attempt(input.attempt); if (!attempt) fail("PAYMENT_REFERENCE_INVALID", 404);
      repository.returned({ publicId: attempt.publicId, now: timestamp() }); return service.verify(attempt.publicId);
    },
    verify(publicId) {
      const attempt = repository.attempt(publicId); if (!attempt) fail("PAYMENT_ATTEMPT_NOT_FOUND", 404);
      if (attempt.status === "VERIFIED") return { attempt: safe(attempt), order: repository.orderByPending(attempt.pendingOrderId), reusedResult: true };
      if (!["REDIRECT_READY", "RETURNED", "VERIFYING"].includes(attempt.status)) fail("PAYMENT_ATTEMPT_INVALID", 409);
      const claimed = repository.claim({ publicId: attempt.publicId, now: timestamp() }); if (claimed.status !== "VERIFYING") fail("PAYMENT_VERIFICATION_PENDING", 409);
      let result;
      try { result = provider.verifyPayment({ providerAttemptReference: claimed.providerAttemptReference, expectedAmount: claimed.requestedAmount, currency: claimed.currency }); if (!validVerification(result)) throw new PaymentProviderError("PAYMENT_VERIFICATION_FAILED"); }
      catch (error) { const code = error instanceof PaymentProviderError ? error.code : "PAYMENT_PROVIDER_UNAVAILABLE"; repository.inconclusive({ id: claimed.id, publicId: claimed.publicId, status: "RETURNED", code, now: timestamp() }); fail(code, 503); }
      if (result.status === "PENDING") { repository.inconclusive({ id: claimed.id, publicId: claimed.publicId, status: "RETURNED", code: "PAYMENT_VERIFICATION_PENDING", now: timestamp() }); fail("PAYMENT_VERIFICATION_PENDING", 409); }
      if (result.status !== "VERIFIED") return { attempt: safe(repository.inconclusive({ id: claimed.id, publicId: claimed.publicId, status: "FAILED", code: "PAYMENT_VERIFICATION_FAILED", now: timestamp() })) };
      if (result.verifiedAmount !== claimed.requestedAmount) { repository.inconclusive({ id: claimed.id, publicId: claimed.publicId, status: "FAILED", code: "PAYMENT_AMOUNT_MISMATCH", now: timestamp() }); fail("PAYMENT_AMOUNT_MISMATCH", 409); }
      if (result.currency !== claimed.currency) { repository.inconclusive({ id: claimed.id, publicId: claimed.publicId, status: "FAILED", code: "PAYMENT_CURRENCY_MISMATCH", now: timestamp() }); fail("PAYMENT_CURRENCY_MISMATCH", 409); }
      const evidence = { provider: claimed.provider, transactionReference: result.providerTransactionReference, amount: result.verifiedAmount, currency: result.currency, verifiedAt: result.verifiedAt, code: result.boundedProviderCode };
      const finalized = repository.finalize({ workspaceId: claimed.workspaceId, attemptId: claimed.id, pendingOrderId: claimed.pendingOrderId, provider: claimed.provider, transactionReference: result.providerTransactionReference, amount: result.verifiedAmount, currency: result.currency, verifiedAt: result.verifiedAt, fingerprint: landingHash(evidence), providerCode: result.boundedProviderCode, now: timestamp() });
      return { attempt: safe(repository.attempt(publicId)), order: finalized.order, reusedResult: !finalized.created };
    },
    status(token, publicId) { const attempt = repository.attempt(publicId); if (!attempt || typeof token !== "string" || !repository.ownsAttempt(publicId, hash(token))) fail("PAYMENT_ATTEMPT_NOT_FOUND", 404); return { attempt: safe(attempt), order: repository.orderByPending(attempt.pendingOrderId) }; },
    retry(token, publicId) { if (typeof token !== "string" || !repository.ownsAttempt(publicId, hash(token))) fail("PAYMENT_ATTEMPT_NOT_FOUND", 404); return service.verify(publicId); },
    order(token, reference) { const pending = capability(token, reference), order = repository.orderByPending(pending.id); if (!order) fail("ORDER_NOT_FOUND", 404); return { order, items: repository.orderItems(order.id), paymentStatus: "VERIFIED" }; },
  };
  return Object.freeze(service);
}
