import crypto from "node:crypto";
import { requireWorkspaceId } from "../tenant-context.mjs";

export class PaymentAttemptError extends Error {
  constructor(message, code = "PAYMENT_ATTEMPT_ERROR", status = 400) {
    super(message);
    this.name = "PaymentAttemptError";
    this.code = code;
    this.status = status;
  }
}

const required = (value, name, max = 200) => {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > max) throw new PaymentAttemptError(`${name} is required.`, `PAYMENT_${name.toUpperCase()}_REQUIRED`);
  return normalized;
};
const hash = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const map = (row) => row && ({
  id: row.id, workspaceId: row.workspace_id, siteProjectId: row.site_project_id, orderId: row.order_id,
  provider: row.provider, providerConfigId: row.provider_config_id, amountMinor: row.amount_minor,
  currency: row.currency, status: row.status, idempotencyKey: row.idempotency_key,
  providerAttemptReference: row.provider_attempt_reference, providerTransactionId: row.provider_transaction_id,
  verificationCode: row.verification_code, createdAt: row.created_at, updatedAt: row.updated_at,
  verifiedAt: row.verified_at, terminalAt: row.terminal_at,
});

export function defineCommercePaymentProviderAdapter(adapter = {}) {
  for (const operation of ["createPayment", "verifyPayment", "refundPayment", "verifyRefund"]) {
    if (typeof adapter[operation] !== "function") throw new PaymentAttemptError(`Payment adapter is missing ${operation}.`, "PAYMENT_ADAPTER_INCOMPLETE", 500);
  }
  return Object.freeze({
    createPayment: adapter.createPayment,
    verifyPayment: adapter.verifyPayment,
    refundPayment: adapter.refundPayment,
    verifyRefund: adapter.verifyRefund,
  });
}

export function createPaymentAttemptService({ db, clock = () => new Date().toISOString(), beforeOrderSettlement = null } = {}) {
  if (!db) throw new PaymentAttemptError("Database is required.", "PAYMENT_DATABASE_REQUIRED", 500);
  const workspaceId = () => requireWorkspaceId();
  const getRow = (attemptId) => db.prepare("SELECT * FROM ecommerce_payment_attempts WHERE id=? AND workspace_id=?").get(attemptId, workspaceId()) || null;
  const requireAttempt = (attemptId) => {
    const row = getRow(attemptId);
    if (!row) throw new PaymentAttemptError("Payment attempt not found.", "PAYMENT_ATTEMPT_NOT_FOUND", 404);
    return row;
  };

  const settleTransaction = db.transaction((attemptId, verification) => {
    const attempt = requireAttempt(attemptId);
    const providerTransactionId = required(verification.providerTransactionId, "provider_transaction_id", 300);
    const provider = required(verification.provider, "provider", 100).toUpperCase();
    const configId = required(verification.providerConfigId, "provider_config_id", 200);
    const amountMinor = Number(verification.amountMinor);
    const currency = required(verification.currency, "currency", 8).toUpperCase();

    if (attempt.status === "SUCCEEDED") {
      if (attempt.provider_transaction_id === providerTransactionId && attempt.provider === provider
        && attempt.provider_config_id === configId && attempt.amount_minor === amountMinor && attempt.currency === currency) return map(attempt);
      throw new PaymentAttemptError("Verified settlement conflicts with the stored result.", "PAYMENT_SETTLEMENT_CONFLICT", 409);
    }
    if (["FAILED", "CANCELLED"].includes(attempt.status)) throw new PaymentAttemptError("Terminal payment attempt cannot settle.", "PAYMENT_ATTEMPT_TERMINAL", 409);
    if (attempt.provider !== provider || attempt.provider_config_id !== configId) throw new PaymentAttemptError("Provider configuration mismatch.", "PAYMENT_PROVIDER_MISMATCH", 409);
    if (attempt.amount_minor !== amountMinor) throw new PaymentAttemptError("Verified amount mismatch.", "PAYMENT_AMOUNT_MISMATCH", 409);
    if (attempt.currency !== currency) throw new PaymentAttemptError("Verified currency mismatch.", "PAYMENT_CURRENCY_MISMATCH", 409);

    const order = db.prepare("SELECT * FROM ecommerce_orders WHERE id=? AND workspace_id=?").get(attempt.order_id, workspaceId());
    if (!order || order.site_project_id !== attempt.site_project_id) throw new PaymentAttemptError("Attempt/order mismatch.", "PAYMENT_ORDER_MISMATCH", 409);
    if (order.total_minor !== attempt.amount_minor || order.currency !== attempt.currency) throw new PaymentAttemptError("Order money changed after attempt creation.", "PAYMENT_ORDER_MONEY_MISMATCH", 409);
    if (order.payment_status === "PAID") throw new PaymentAttemptError("Order was paid outside this attempt.", "PAYMENT_ORDER_ALREADY_PAID", 409);

    const at = clock();
    try {
      db.prepare(`UPDATE ecommerce_payment_attempts SET status='SUCCEEDED',provider_transaction_id=?,verification_code=?,verified_at=?,terminal_at=?,updated_at=? WHERE id=? AND workspace_id=?`)
        .run(providerTransactionId, String(verification.verificationCode || "VERIFIED_SUCCESS").slice(0, 100), at, at, at, attempt.id, workspaceId());
    } catch (error) {
      if (String(error?.message || "").includes("provider_transaction")) throw new PaymentAttemptError("Provider transaction is already assigned.", "PAYMENT_PROVIDER_TRANSACTION_CONFLICT", 409);
      throw error;
    }
    beforeOrderSettlement?.({ db, attemptId: attempt.id, orderId: order.id });
    db.prepare("UPDATE ecommerce_orders SET payment_status='PAID',payment_provider=?,payment_reference=?,updated_at=? WHERE id=? AND workspace_id=?")
      .run(attempt.provider, providerTransactionId, at, order.id, workspaceId());
    return map(requireAttempt(attempt.id));
  });

  return Object.freeze({
    create({ orderId, provider, providerConfigId, idempotencyKey, ...untrusted } = {}) {
      if (Object.hasOwn(untrusted, "amountMinor") || Object.hasOwn(untrusted, "currency")) {
        throw new PaymentAttemptError("Payment money is server-derived.", "PAYMENT_CLIENT_MONEY_REJECTED", 400);
      }
      const orderIdentity = required(orderId, "order_id");
      const providerIdentity = required(provider, "provider", 100).toUpperCase();
      const configIdentity = required(providerConfigId, "provider_config_id");
      const idem = required(idempotencyKey, "idempotency_key");
      const order = db.prepare("SELECT * FROM ecommerce_orders WHERE id=? AND workspace_id=?").get(orderIdentity, workspaceId());
      if (!order) throw new PaymentAttemptError("Order not found.", "PAYMENT_ORDER_NOT_FOUND", 404);
      if (order.payment_status !== "UNPAID") throw new PaymentAttemptError("Order is not payable.", "PAYMENT_ORDER_NOT_PAYABLE", 409);
      const config = db.prepare("SELECT * FROM ecommerce_payment_providers WHERE id=? AND workspace_id=? AND site_project_id=? AND upper(provider_key)=?")
        .get(configIdentity, workspaceId(), order.site_project_id, providerIdentity);
      if (!config) throw new PaymentAttemptError("Provider configuration not found.", "PAYMENT_PROVIDER_CONFIG_NOT_FOUND", 404);
      const inputHash = hash({ orderId: order.id, provider: providerIdentity, providerConfigId: configIdentity, amountMinor: order.total_minor, currency: order.currency });
      const existing = db.prepare("SELECT * FROM ecommerce_payment_attempts WHERE workspace_id=? AND order_id=? AND idempotency_key=?").get(workspaceId(), order.id, idem);
      if (existing) {
        if (existing.input_hash !== inputHash) throw new PaymentAttemptError("Idempotency key conflicts with another payment input.", "PAYMENT_IDEMPOTENCY_CONFLICT", 409);
        return map(existing);
      }
      const attemptId = `pay_attempt_${crypto.randomUUID()}`, at = clock();
      db.prepare(`INSERT INTO ecommerce_payment_attempts(id,workspace_id,site_project_id,order_id,provider,provider_config_id,amount_minor,currency,status,idempotency_key,input_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(attemptId, workspaceId(), order.site_project_id, order.id, providerIdentity, configIdentity, order.total_minor, order.currency, "CREATED", idem, inputHash, at, at);
      return map(requireAttempt(attemptId));
    },
    get(attemptId) { return map(requireAttempt(attemptId)); },
    settleVerified(attemptId, verification = {}) { return settleTransaction(attemptId, verification); },
  });
}
