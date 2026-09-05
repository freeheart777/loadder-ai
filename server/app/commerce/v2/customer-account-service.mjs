import crypto from "node:crypto";
import {
  createCustomerAccount,
  updateCustomerProfile,
  addCustomerAddress,
  updateCustomerAddress,
  setDefaultCustomerAddress,
  removeCustomerAddress,
} from "./customer-account-engine.mjs";
import { CustomerAccountPersistenceError } from "./customer-account-repository.mjs";

const now = () => new Date().toISOString();
const required = (value, name) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new CustomerAccountPersistenceError(`${name} is required`, "CUSTOMER_INPUT_REQUIRED", 400);
  return normalized;
};

export function createCustomerAccountService({ repository, clock = now, idFactory = () => crypto.randomUUID() } = {}) {
  if (!repository) throw new CustomerAccountPersistenceError("Customer repository is required", "CUSTOMER_REPOSITORY_REQUIRED", 500);

  const resolveContext = ({ workspaceId, siteProjectId, principal }) => {
    const workspace = required(workspaceId, "workspaceId");
    const store = required(siteProjectId, "siteProjectId");
    const authProjectId = required(principal?.projectId, "principal.projectId");
    if (String(principal?.role || "").toLowerCase() !== "customer") {
      throw new CustomerAccountPersistenceError("Customer app-user role is required", "CUSTOMER_APP_USER_ROLE_REQUIRED", 403);
    }
    const binding = repository.resolveStoreBinding({ workspaceId: workspace, siteProjectId: store, authProjectId });
    if (!binding) throw new CustomerAccountPersistenceError("Store is not bound to this authenticated app project", "CUSTOMER_STORE_AUTH_BINDING_REQUIRED", 403);
    return { workspaceId: workspace, siteProjectId: store, authProjectId };
  };

  const current = ({ workspaceId, siteProjectId, principal, createIfMissing = false }) => {
    const ctx = resolveContext({ workspaceId, siteProjectId, principal });
    let account = repository.getByIdentity({ ...ctx, appUserId: principal.id });
    if (!account && createIfMissing) {
      const stamp = clock();
      const domain = createCustomerAccount({
        id: `customer:${idFactory()}`,
        workspaceId: ctx.workspaceId,
        storeId: ctx.siteProjectId,
        authProjectId: ctx.authProjectId,
        principal,
        profile: { displayName: principal.displayName || null, phone: null },
        createdAt: stamp,
      });
      try { account = repository.create(domain); }
      catch (error) {
        if (!String(error?.message || "").includes("UNIQUE constraint failed")) throw error;
        account = repository.getByIdentity({ ...ctx, appUserId: principal.id });
      }
    }
    return { ...ctx, account };
  };

  const owned = (input) => {
    const state = current(input);
    if (!state.account) throw new CustomerAccountPersistenceError("Customer account not found", "CUSTOMER_ACCOUNT_NOT_FOUND", 404);
    if (state.account.identitySubjectId !== input.principal.id || state.account.authProjectId !== input.principal.projectId) {
      throw new CustomerAccountPersistenceError("Customer account identity mismatch", "CUSTOMER_IDENTITY_MISMATCH", 403);
    }
    return state;
  };

  return Object.freeze({
    getOrCreate(input = {}) { return current({ ...input, createIfMissing: true }).account; },
    get(input = {}) { return current(input).account; },
    updateProfile(input = {}) {
      const { account } = owned(input); const stamp = clock();
      const next = updateCustomerProfile(account, input.principal, input.patch || {}, { updatedAt: stamp });
      return repository.saveProfile({ account: next, expectedRevision: Number(input.expectedRevision), updatedAt: stamp });
    },
    addAddress(input = {}) {
      const { account } = owned(input); const stamp = clock();
      const next = addCustomerAddress(account, input.principal, { ...(input.address || {}), id: input.address?.id || `address:${idFactory()}` }, { makeDefaultShipping: !!input.makeDefaultShipping, makeDefaultBilling: !!input.makeDefaultBilling, updatedAt: stamp });
      const address = next.addresses.find((x) => !account.addresses.some((old) => old.id === x.id));
      return repository.addAddress({ account, address, expectedRevision: Number(input.expectedRevision), updatedAt: stamp, makeDefaultShipping: !!input.makeDefaultShipping, makeDefaultBilling: !!input.makeDefaultBilling });
    },
    updateAddress(input = {}) {
      const { account } = owned(input); const stamp = clock();
      const next = updateCustomerAddress(account, input.principal, input.addressId, input.patch || {}, { updatedAt: stamp });
      const address = next.addresses.find((x) => x.id === input.addressId);
      return repository.updateAddress({ account, address, expectedRevision: Number(input.expectedRevision), updatedAt: stamp });
    },
    setDefaultAddress(input = {}) {
      const { account } = owned(input); const stamp = clock();
      setDefaultCustomerAddress(account, input.principal, input.addressId, { shipping: !!input.shipping, billing: !!input.billing, updatedAt: stamp });
      return repository.setDefaults({ account, addressId: input.addressId, shipping: !!input.shipping, billing: !!input.billing, expectedRevision: Number(input.expectedRevision), updatedAt: stamp });
    },
    removeAddress(input = {}) {
      const { account } = owned(input); const stamp = clock();
      removeCustomerAddress(account, input.principal, input.addressId, { updatedAt: stamp });
      return repository.removeAddress({ account, addressId: input.addressId, expectedRevision: Number(input.expectedRevision), updatedAt: stamp });
    },
    bindCart(input = {}) {
      const { account } = owned(input);
      return repository.bindCart({ account, cartId: input.cartId });
    },
    listOrders(input = {}) {
      const { account } = owned(input);
      return repository.listOrders({ workspaceId: account.workspaceId, accountId: account.id, limit: input.limit });
    },
  });
}
