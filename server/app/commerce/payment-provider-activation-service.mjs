import { requireWorkspaceId } from "../tenant-context.mjs";
import { EcommerceError } from "../services/ecommerce-service.mjs";
import { paymentAdapters } from "./payment-adapters.mjs";

// The only path to status CONNECTED: a real gateway request with the stored credentials.
// Sandbox rows probe sandbox.zarinpal.com; live rows send a minimal real request
// (never paid, expires at the gateway). No money moves either way.
// ponytail: probe amount/currency are ZarinPal-shaped; move them onto the adapter when a second gateway lands.
const PROBE = { amountMinor: 100000, currency: "IRR" }; // 1,000 Rial, ZarinPal's minimum

export function createPaymentProviderActivationService({ db, adapters = paymentAdapters, clock = () => new Date().toISOString() } = {}) {
  if (!db) throw new Error("Database is required.");
  const setStatus = (row, status) => db.prepare(
    // Only if credentials did not change while the probe was in flight.
    "UPDATE ecommerce_payment_providers SET status=?,updated_at=? WHERE id=? AND workspace_id=? AND credential_reference IS ? AND config_json=?",
  ).run(status, clock(), row.id, row.workspace_id, row.credential_reference, row.config_json).changes;

  return Object.freeze({
    async activate(siteProjectId, providerKey, { origin } = {}) {
      const workspaceId = requireWorkspaceId();
      const key = String(providerKey || "").trim().toUpperCase();
      const row = db.prepare(`SELECT p.* FROM ecommerce_payment_providers p JOIN site_projects s ON s.id=p.site_project_id AND s.workspace_id=p.workspace_id
        WHERE p.workspace_id=? AND p.site_project_id=? AND p.provider_key=?`).get(workspaceId, siteProjectId, key);
      if (!row) throw new EcommerceError("Payment provider not found.", "PAYMENT_PROVIDER_NOT_FOUND", 404);
      const adapter = adapters[key];
      if (!adapter) throw new EcommerceError("This payment provider cannot be activated.", "PAYMENT_PROVIDER_UNSUPPORTED", 422);
      if (!row.credential_reference) throw new EcommerceError("Merchant ID is required before activation.", "PAYMENT_PROVIDER_CREDENTIAL_REQUIRED", 422);
      let options = {};
      try { options = JSON.parse(row.config_json || "{}"); } catch { /* treated as live */ }

      try {
        await adapter.createPayment({
          merchantId: row.credential_reference, sandbox: options.sandbox === true, ...PROBE,
          callbackUrl: `${origin}/api/auth/storefront/payments/activation-check/callback`,
          description: "Loadder payment activation check",
        });
      } catch (error) {
        setStatus(row, "ERROR");
        throw new EcommerceError(`Gateway rejected the activation check (${error?.code || "GATEWAY_ERROR"}).`, "PAYMENT_PROVIDER_ACTIVATION_FAILED", 422);
      }
      if (!setStatus(row, "CONNECTED")) throw new EcommerceError("Provider settings changed during activation; activate again.", "PAYMENT_PROVIDER_CHANGED", 409);
      return { providerKey: key, status: "CONNECTED", sandbox: options.sandbox === true };
    },
  });
}
