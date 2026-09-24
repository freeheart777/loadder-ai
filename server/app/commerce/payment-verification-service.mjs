import { requireWorkspaceId } from "../tenant-context.mjs";
import { PaymentAttemptError } from "./payment-attempt-service.mjs";
import { paymentAdapters } from "./payment-adapters.mjs";

export function gatewayCredentials(config) {
  let options = {};
  try { options = JSON.parse(config.config_json || "{}"); } catch { /* treated as live */ }
  return { merchantId: config.credential_reference, sandbox: options.sandbox === true };
}

// The single verify -> settle path, shared by the gateway callback and merchant reconcile.
// Outcome is decided only by a server-to-server verify with the stored amount; settlement goes
// through paymentAttemptService.settleVerified() and the migration-087 triggers.
//   paid    - order is PAID
//   failed  - gateway definitively said not paid (attempt FAILED/CANCELLED)
//   pending - unknown right now (gateway unreachable, no answer code, or settlement needs a human)
export function createPaymentVerificationService({ db, paymentAttemptService, adapters = paymentAdapters, logger = console } = {}) {
  if (!db || !paymentAttemptService) throw new Error("db and paymentAttemptService are required.");
  return Object.freeze({
    async verifyAndSettle(attemptId) {
      const attempt = paymentAttemptService.get(attemptId);
      if (attempt.status === "SUCCEEDED") return { result: "paid", attempt };
      if (attempt.status === "FAILED" || attempt.status === "CANCELLED") return { result: "failed", attempt };
      if (!attempt.providerAttemptReference) return { result: "pending", attempt, reason: "NOT_REDIRECTED" };
      const adapter = adapters[attempt.provider];
      if (!adapter) throw new PaymentAttemptError("No adapter for this payment provider.", "PAYMENT_PROVIDER_UNSUPPORTED", 422);
      const config = db.prepare("SELECT credential_reference,config_json FROM ecommerce_payment_providers WHERE id=? AND workspace_id=?").get(attempt.providerConfigId, requireWorkspaceId());
      if (!config) throw new PaymentAttemptError("Provider configuration not found.", "PAYMENT_PROVIDER_CONFIG_NOT_FOUND", 409);

      let verification;
      try {
        verification = await adapter.verifyPayment({ ...gatewayCredentials(config), amountMinor: attempt.amountMinor, currency: attempt.currency, authority: attempt.providerAttemptReference });
      } catch (error) {
        logger.error?.(`Payment ${attempt.id}: gateway verify unreachable; left ${attempt.status}.`, error);
        return { result: "pending", attempt, reason: "GATEWAY_UNREACHABLE" };
      }
      if (!verification.verified) {
        if (verification.code == null) return { result: "pending", attempt, reason: "GATEWAY_NO_ANSWER" };
        return { result: "failed", attempt: paymentAttemptService.recordOutcome(attempt.id, "FAILED", `GATEWAY_VERIFY_${verification.code}`) };
      }
      try {
        return { result: "paid", attempt: paymentAttemptService.settleVerified(attempt.id, {
          providerTransactionId: verification.refId, provider: attempt.provider, providerConfigId: attempt.providerConfigId,
          amountMinor: attempt.amountMinor, currency: attempt.currency, verificationCode: `GATEWAY_VERIFIED_${verification.code}`,
        }) };
      } catch (settleError) {
        // Gateway took the money but the order could not be marked PAID: flag for a human, never drop it.
        logger.error?.(`Payment ${attempt.id} verified by gateway (ref ${verification.refId}) but settlement failed:`, settleError);
        return { result: "pending", attempt: paymentAttemptService.recordOutcome(attempt.id, "RECONCILIATION_REQUIRED", settleError?.code || "SETTLEMENT_FAILED"), reason: "RECONCILIATION_REQUIRED" };
      }
    },
  });
}
