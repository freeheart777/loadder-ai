import express from "express";
import { LoadderAppUserAuth } from "./app-user-auth.mjs";
import { createBusinessBuilderRateLimiter } from "./business-builder-rate-limit.mjs";
import { requireWorkspaceId } from "../tenant-context.mjs";
import { createCustomerAccountRepository, CustomerAccountPersistenceError } from "../commerce/v2/customer-account-repository.mjs";
import { createCustomerAccountService } from "../commerce/v2/customer-account-service.mjs";

export function createCustomerSelfServiceRouter({ db, projects }) {
  const router = express.Router();
  const auth = new LoadderAppUserAuth(db);
  const service = createCustomerAccountService({ repository: createCustomerAccountRepository(db) });
  const write = createBusinessBuilderRateLimiter("write");

  const fail = (res, status, code, message) => res.status(status).json({ success: false, code, message });
  const handle = (res, error) => {
    if (error instanceof CustomerAccountPersistenceError) {
      return fail(res, error.status || 400, error.code, error.message);
    }
    const message = String(error?.message || "Customer self-service operation failed.");
    const status = /MISMATCH|FORBIDDEN|ROLE_REQUIRED|INACTIVE/.test(message) ? 403 : 400;
    return fail(res, status, error?.code || "CUSTOMER_SELF_SERVICE_INVALID", message);
  };
  const principal = (req) => {
    if (!projects.getProject(req.params.id)) return { error: [404, "PROJECT_NOT_FOUND", "Project not found."] };
    const token = String(req.get("X-Loadder-App-Token") || "").trim();
    if (!token) return { error: [401, "APP_CUSTOMER_AUTH_REQUIRED", "Customer app session is required."] };
    const value = auth.resolve(token, req.params.id);
    if (!value) return { error: [401, "APP_CUSTOMER_SESSION_INVALID", "Customer app session is invalid or expired."] };
    if (String(value.role || "").toLowerCase() !== "customer") {
      return { error: [403, "APP_CUSTOMER_ROLE_REQUIRED", "Customer role is required."] };
    }
    return { value };
  };
  const context = (req, principalValue) => ({
    workspaceId: requireWorkspaceId(),
    siteProjectId: req.params.siteProjectId,
    principal: principalValue,
  });
  const expectedRevision = (req) => {
    const raw = req.get("If-Match") || req.body?.expectedRevision;
    const normalized = String(raw ?? "").replace(/^W\//, "").replace(/^"|"$/g, "");
    const revision = Number(normalized);
    return Number.isInteger(revision) && revision > 0 ? revision : null;
  };
  const withCustomer = (req, res, fn, { requireRevision = false } = {}) => {
    try {
      const resolved = principal(req);
      if (resolved.error) return fail(res, ...resolved.error);
      const revision = requireRevision ? expectedRevision(req) : null;
      if (requireRevision && !revision) {
        return fail(res, 428, "CUSTOMER_REVISION_REQUIRED", "If-Match with the current customer revision is required.");
      }
      return fn(resolved.value, revision);
    } catch (error) {
      return handle(res, error);
    }
  };

  const base = "/business-builder/projects/:id/commerce/stores/:siteProjectId/me";

  router.get(base, (req, res) => withCustomer(req, res, (p) => {
    const account = service.get(context(req, p));
    return account ? res.json({ success: true, account }) : fail(res, 404, "CUSTOMER_ACCOUNT_NOT_FOUND", "Customer account not found.");
  }));

  router.post(base, write, (req, res) => withCustomer(req, res, (p) => {
    const account = service.getOrCreate(context(req, p));
    return res.status(201).json({ success: true, account });
  }));

  router.patch(base, write, (req, res) => withCustomer(req, res, (p, revision) => {
    const account = service.updateProfile({ ...context(req, p), expectedRevision: revision, patch: req.body?.profile || req.body || {} });
    return res.json({ success: true, account });
  }, { requireRevision: true }));

  router.post(`${base}/addresses`, write, (req, res) => withCustomer(req, res, (p, revision) => {
    const account = service.addAddress({
      ...context(req, p),
      expectedRevision: revision,
      address: req.body?.address || req.body || {},
      makeDefaultShipping: !!req.body?.makeDefaultShipping,
      makeDefaultBilling: !!req.body?.makeDefaultBilling,
    });
    return res.status(201).json({ success: true, account });
  }, { requireRevision: true }));

  router.patch(`${base}/addresses/:addressId`, write, (req, res) => withCustomer(req, res, (p, revision) => {
    const account = service.updateAddress({ ...context(req, p), expectedRevision: revision, addressId: req.params.addressId, patch: req.body?.address || req.body || {} });
    return res.json({ success: true, account });
  }, { requireRevision: true }));

  router.put(`${base}/addresses/:addressId/defaults`, write, (req, res) => withCustomer(req, res, (p, revision) => {
    const account = service.setDefaultAddress({ ...context(req, p), expectedRevision: revision, addressId: req.params.addressId, shipping: !!req.body?.shipping, billing: !!req.body?.billing });
    return res.json({ success: true, account });
  }, { requireRevision: true }));

  router.delete(`${base}/addresses/:addressId`, write, (req, res) => withCustomer(req, res, (p, revision) => {
    const account = service.removeAddress({ ...context(req, p), expectedRevision: revision, addressId: req.params.addressId });
    return res.json({ success: true, account });
  }, { requireRevision: true }));

  router.put(`${base}/carts/:cartId/binding`, write, (req, res) => withCustomer(req, res, (p) => {
    const account = service.getOrCreate(context(req, p));
    const binding = service.bindCart({ ...context(req, p), cartId: req.params.cartId });
    return res.json({ success: true, accountId: account.id, binding });
  }));

  router.get(`${base}/orders`, (req, res) => withCustomer(req, res, (p) => {
    const orders = service.listOrders({ ...context(req, p), limit: req.query.limit });
    return res.json({ success: true, orders });
  }));

  return router;
}
