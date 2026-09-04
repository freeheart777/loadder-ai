import test from "node:test";
import assert from "node:assert/strict";

import {
  createCustomerAccount,
  updateCustomerProfile,
  addCustomerAddress,
  updateCustomerAddress,
  setDefaultCustomerAddress,
  removeCustomerAddress,
  createCustomerOrderLink,
} from "../app/commerce/v2/customer-account-engine.mjs";

const principal = Object.freeze({
  id: "app-user-1",
  projectId: "project-1",
  role: "customer",
  status: "active",
  email: "buyer@example.com",
});

const baseAccount = () =>
  createCustomerAccount({
    id: "customer-1",
    workspaceId: "w1",
    storeId: "s1",
    principal,
    profile: { displayName: "Buyer", phone: "09120000000" },
    createdAt: "2026-09-05T10:00:00.000Z",
  });

const address = {
  id: "addr-1",
  label: "Home",
  name: "Buyer",
  phone: "09120000000",
  city: "Tehran",
  address1: "Street 1",
  country: "IR",
};

const order = Object.freeze({
  id: "order-customer-1",
  workspaceId: "w1",
  storeId: "s1",
  createdAt: "2026-09-05T11:00:00.000Z",
  shippingAddress: Object.freeze({ ...address, id: undefined, address1: "Original order address" }),
});

test("customer account binds commerce profile to resolved active customer app-user identity", () => {
  const account = baseAccount();
  assert.equal(account.identitySource, "APP_USER");
  assert.equal(account.identitySubjectId, principal.id);
  assert.equal(account.authProjectId, principal.projectId);
  assert.equal(account.profile.displayName, "Buyer");
  assert.ok(Object.isFrozen(account));
  assert.ok(Object.isFrozen(account.profile));
  assert.deepEqual(account.addresses, []);

  assert.throws(
    () =>
      createCustomerAccount({
        id: "customer-employee",
        workspaceId: "w1",
        storeId: "s1",
        principal: { ...principal, id: "employee-1", role: "employee" },
      }),
    /CUSTOMER_APP_USER_ROLE_REQUIRED/
  );

  assert.throws(
    () =>
      createCustomerAccount({
        id: "customer-disabled",
        workspaceId: "w1",
        storeId: "s1",
        principal: { ...principal, id: "disabled-1", status: "disabled" },
      }),
    /CUSTOMER_APP_USER_INACTIVE/
  );
});

test("one app-user identity cannot silently create duplicate customer accounts in the same store", () => {
  const existing = baseAccount();
  assert.throws(
    () =>
      createCustomerAccount({
        id: "customer-2",
        workspaceId: "w1",
        storeId: "s1",
        principal,
        existingAccounts: [existing],
      }),
    /CUSTOMER_IDENTITY_ALREADY_BOUND/
  );

  assert.throws(
    () =>
      createCustomerAccount({
        id: "customer-1",
        workspaceId: "w1",
        storeId: "s1",
        principal: { ...principal, id: "app-user-2" },
        existingAccounts: [existing],
      }),
    /CUSTOMER_DUPLICATE_ACCOUNT_ID/
  );
});

test("profile mutation preserves immutable identity binding and rejects another principal", () => {
  const account = baseAccount();
  const before = structuredClone(account);
  const updated = updateCustomerProfile(
    account,
    principal,
    { displayName: "Buyer Updated", phone: "09350000000" },
    { updatedAt: "2026-09-05T10:10:00.000Z" }
  );

  assert.deepEqual(account, before);
  assert.equal(updated.profile.displayName, "Buyer Updated");
  assert.equal(updated.identitySubjectId, account.identitySubjectId);
  assert.equal(updated.authProjectId, account.authProjectId);

  assert.throws(
    () =>
      updateCustomerProfile(
        account,
        { ...principal, id: "app-user-other" },
        { displayName: "Hijack" }
      ),
    /CUSTOMER_IDENTITY_MISMATCH/
  );
});

test("address book is mutable convenience data while defaults remain explicit", () => {
  const account = baseAccount();
  const withAddress = addCustomerAddress(account, principal, address, {
    makeDefaultShipping: true,
    updatedAt: "2026-09-05T10:10:00.000Z",
  });
  assert.equal(withAddress.addresses.length, 1);
  assert.equal(withAddress.defaultShippingAddressId, "addr-1");
  assert.equal(withAddress.defaultBillingAddressId, null);

  const second = addCustomerAddress(
    withAddress,
    principal,
    { ...address, id: "addr-2", label: "Work", address1: "Office Street" },
    { updatedAt: "2026-09-05T10:20:00.000Z" }
  );
  const defaults = setDefaultCustomerAddress(second, principal, "addr-2", {
    shipping: true,
    billing: true,
    updatedAt: "2026-09-05T10:30:00.000Z",
  });
  assert.equal(defaults.defaultShippingAddressId, "addr-2");
  assert.equal(defaults.defaultBillingAddressId, "addr-2");

  const edited = updateCustomerAddress(
    defaults,
    principal,
    "addr-2",
    { address1: "Office Street Updated" },
    { updatedAt: "2026-09-05T10:40:00.000Z" }
  );
  assert.equal(edited.addresses.find((item) => item.id === "addr-2").address1, "Office Street Updated");

  const removed = removeCustomerAddress(edited, principal, "addr-2", {
    updatedAt: "2026-09-05T10:50:00.000Z",
  });
  assert.equal(removed.addresses.length, 1);
  assert.equal(removed.defaultShippingAddressId, null);
  assert.equal(removed.defaultBillingAddressId, null);
});

test("address updates never rewrite historical order address snapshots", () => {
  const account = addCustomerAddress(baseAccount(), principal, address, {
    makeDefaultShipping: true,
    updatedAt: "2026-09-05T10:10:00.000Z",
  });
  const orderBefore = structuredClone(order);
  const edited = updateCustomerAddress(
    account,
    principal,
    "addr-1",
    { address1: "New saved address" },
    { updatedAt: "2026-09-05T10:20:00.000Z" }
  );

  assert.equal(edited.addresses[0].address1, "New saved address");
  assert.deepEqual(order, orderBefore);
  assert.equal(order.shippingAddress.address1, "Original order address");
});

test("customer order ownership link is immutable, checkout-only and tenant/store bound", () => {
  const account = baseAccount();
  const link = createCustomerOrderLink({
    id: "customer-order-link-1",
    account,
    principal,
    order,
    linkedAt: "2026-09-05T11:00:01.000Z",
  });

  assert.equal(link.orderId, order.id);
  assert.equal(link.customerAccountId, account.id);
  assert.equal(link.identitySubjectId, principal.id);
  assert.equal(link.source, "CHECKOUT");
  assert.ok(Object.isFrozen(link));

  assert.throws(
    () =>
      createCustomerOrderLink({
        id: "guest-claim",
        account,
        principal,
        order,
        source: "POST_HOC_CLAIM",
      }),
    /CUSTOMER_ORDER_LINK_SOURCE_FORBIDDEN/
  );

  assert.throws(
    () =>
      createCustomerOrderLink({
        id: "wrong-store",
        account,
        principal,
        order: { ...order, storeId: "s2" },
      }),
    /CUSTOMER_ORDER_STORE_MISMATCH/
  );
});

test("an order cannot be linked twice when complete relevant link history is supplied", () => {
  const account = baseAccount();
  const first = createCustomerOrderLink({
    id: "link-first",
    account,
    principal,
    order,
    linkedAt: "2026-09-05T11:00:01.000Z",
  });

  assert.throws(
    () =>
      createCustomerOrderLink({
        id: "link-second",
        account,
        principal,
        order,
        existingLinks: [first],
        linkedAt: "2026-09-05T11:00:02.000Z",
      }),
    /CUSTOMER_ORDER_ALREADY_LINKED/
  );
});

test("customer and order-link timestamps cannot move backwards", () => {
  const account = baseAccount();
  assert.throws(
    () =>
      updateCustomerProfile(account, principal, { displayName: "Old" }, {
        updatedAt: "2026-09-05T09:59:59.000Z",
      }),
    /CUSTOMER_TIMESTAMP_REGRESSION/
  );

  assert.throws(
    () =>
      createCustomerOrderLink({
        id: "early-link",
        account,
        principal,
        order,
        linkedAt: "2026-09-05T10:59:59.000Z",
      }),
    /CUSTOMER_ORDER_LINK_TIMESTAMP_REGRESSION/
  );
});

test("malformed persisted account history fails closed instead of creating a second identity binding", () => {
  const malformed = {
    ...structuredClone(baseAccount()),
    addresses: [{ ...address, id: "dup" }, { ...address, id: "dup" }],
  };

  assert.throws(
    () =>
      createCustomerAccount({
        id: "customer-new",
        workspaceId: "w1",
        storeId: "s1",
        principal: { ...principal, id: "app-user-new" },
        existingAccounts: [malformed],
      }),
    /CUSTOMER_DUPLICATE_ADDRESS_ID/
  );
});
