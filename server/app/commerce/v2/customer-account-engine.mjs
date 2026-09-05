const text = (value, max = 500) => {
  const normalized = String(value ?? "").trim();
  if (normalized.length > max) throw new RangeError("TEXT_TOO_LONG");
  return normalized;
};

const clone = (value) => structuredClone(value);
const deepFreeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
};

const timestamp = (value, code = "CUSTOMER_INVALID_TIMESTAMP") => {
  const normalized = text(value, 80) || new Date().toISOString();
  if (!Number.isFinite(Date.parse(normalized))) throw new Error(code);
  return normalized;
};

const assertNotBefore = (candidate, baseline, code = "CUSTOMER_TIMESTAMP_REGRESSION") => {
  if (!baseline) return;
  const base = timestamp(baseline);
  if (Date.parse(candidate) < Date.parse(base)) throw new Error(code);
};

function normalizePrincipal(principal) {
  if (!principal || typeof principal !== "object") {
    throw new TypeError("CUSTOMER_APP_USER_PRINCIPAL_REQUIRED");
  }
  const id = text(principal.id, 200);
  const projectId = text(principal.projectId, 200);
  const role = text(principal.role, 40).toLowerCase();
  const status = text(principal.status ?? "active", 40).toLowerCase();
  if (!id) throw new TypeError("CUSTOMER_APP_USER_ID_REQUIRED");
  if (!projectId) throw new TypeError("CUSTOMER_AUTH_PROJECT_REQUIRED");
  if (role !== "customer") throw new Error("CUSTOMER_APP_USER_ROLE_REQUIRED");
  if (status !== "active") throw new Error("CUSTOMER_APP_USER_INACTIVE");
  return { id, projectId, role, status };
}

function assertAccount(account) {
  if (!account || typeof account !== "object") throw new TypeError("CUSTOMER_ACCOUNT_REQUIRED");
  if (!text(account.id, 200)) throw new TypeError("CUSTOMER_ACCOUNT_ID_REQUIRED");
  if (!text(account.workspaceId, 200)) throw new TypeError("CUSTOMER_WORKSPACE_REQUIRED");
  if (!text(account.storeId, 200)) throw new TypeError("CUSTOMER_STORE_REQUIRED");
  if (account.identitySource !== "APP_USER") throw new Error("CUSTOMER_IDENTITY_SOURCE_INVALID");
  if (!text(account.identitySubjectId, 200)) throw new Error("CUSTOMER_IDENTITY_SUBJECT_REQUIRED");
  if (!text(account.authProjectId, 200)) throw new Error("CUSTOMER_AUTH_PROJECT_REQUIRED");
  if (!Array.isArray(account.addresses)) throw new Error("CUSTOMER_ADDRESSES_REQUIRED");
  const ids = new Set();
  for (const raw of account.addresses) {
    const address = normalizeAddress(raw);
    if (ids.has(address.id)) throw new Error("CUSTOMER_DUPLICATE_ADDRESS_ID");
    ids.add(address.id);
  }
  if (account.defaultShippingAddressId && !ids.has(account.defaultShippingAddressId)) {
    throw new Error("CUSTOMER_DEFAULT_ADDRESS_MISSING");
  }
  if (account.defaultBillingAddressId && !ids.has(account.defaultBillingAddressId)) {
    throw new Error("CUSTOMER_DEFAULT_ADDRESS_MISSING");
  }
}

function assertPrincipalOwnsAccount(account, principal) {
  assertAccount(account);
  const resolved = normalizePrincipal(principal);
  if (account.identitySubjectId !== resolved.id) throw new Error("CUSTOMER_IDENTITY_MISMATCH");
  if (account.authProjectId !== resolved.projectId) throw new Error("CUSTOMER_AUTH_PROJECT_MISMATCH");
  return resolved;
}

function normalizeProfile(raw = {}) {
  return {
    displayName: text(raw.displayName, 200) || null,
    phone: text(raw.phone, 80) || null,
  };
}

function normalizeAddress(raw = {}) {
  const id = text(raw.id, 200);
  if (!id) throw new Error("CUSTOMER_ADDRESS_ID_REQUIRED");
  const address = {
    id,
    label: text(raw.label, 120) || null,
    name: text(raw.name, 200),
    phone: text(raw.phone, 80),
    email: text(raw.email, 320) || null,
    country: text(raw.country, 120) || null,
    province: text(raw.province, 160) || null,
    city: text(raw.city, 160),
    address1: text(raw.address1, 1000),
    address2: text(raw.address2, 1000) || null,
    postalCode: text(raw.postalCode, 80) || null,
  };
  if (!address.name || !address.phone || !address.city || !address.address1) {
    throw new Error("CUSTOMER_ADDRESS_INCOMPLETE");
  }
  return address;
}

function validateAccountHistory(workspaceId, storeId, existingAccounts = []) {
  if (!Array.isArray(existingAccounts)) throw new TypeError("CUSTOMER_ACCOUNTS_ARRAY_REQUIRED");
  const ids = new Set();
  const subjects = new Set();
  for (const account of existingAccounts) {
    assertAccount(account);
    if (account.workspaceId !== workspaceId) throw new Error("CUSTOMER_WORKSPACE_MISMATCH");
    if (account.storeId !== storeId) throw new Error("CUSTOMER_STORE_MISMATCH");
    if (ids.has(account.id)) throw new Error("CUSTOMER_DUPLICATE_ACCOUNT_ID");
    ids.add(account.id);
    const key = `${account.authProjectId}:${account.identitySubjectId}`;
    if (subjects.has(key)) throw new Error("CUSTOMER_DUPLICATE_IDENTITY_BINDING");
    subjects.add(key);
  }
  return { ids, subjects };
}

export function createCustomerAccount({
  id,
  workspaceId,
  storeId,
  authProjectId,
  principal,
  existingAccounts = [],
  profile = {},
  createdAt,
  metadata = {},
} = {}) {
  const accountId = text(id, 200);
  const workspace = text(workspaceId, 200);
  const store = text(storeId, 200);
  const authProject = text(authProjectId, 200);
  if (!accountId) throw new TypeError("CUSTOMER_ACCOUNT_ID_REQUIRED");
  if (!workspace) throw new TypeError("CUSTOMER_WORKSPACE_REQUIRED");
  if (!store) throw new TypeError("CUSTOMER_STORE_REQUIRED");
  if (!authProject) throw new TypeError("CUSTOMER_STORE_AUTH_PROJECT_REQUIRED");
  const resolved = normalizePrincipal(principal);
  if (resolved.projectId !== authProject) throw new Error("CUSTOMER_STORE_AUTH_PROJECT_MISMATCH");
  const history = validateAccountHistory(workspace, store, existingAccounts);
  if (history.ids.has(accountId)) throw new Error("CUSTOMER_DUPLICATE_ACCOUNT_ID");
  if (history.subjects.has(`${resolved.projectId}:${resolved.id}`)) {
    throw new Error("CUSTOMER_IDENTITY_ALREADY_BOUND");
  }
  const now = timestamp(createdAt);
  return deepFreeze({
    id: accountId,
    workspaceId: workspace,
    storeId: store,
    identitySource: "APP_USER",
    identitySubjectId: resolved.id,
    authProjectId: authProject,
    profile: normalizeProfile(profile),
    addresses: [],
    defaultShippingAddressId: null,
    defaultBillingAddressId: null,
    metadata: clone(metadata || {}),
    createdAt: now,
    updatedAt: now,
  });
}

export function updateCustomerProfile(account, principal, patch = {}, { updatedAt } = {}) {
  assertPrincipalOwnsAccount(account, principal);
  const at = timestamp(updatedAt);
  assertNotBefore(at, account.createdAt);
  assertNotBefore(at, account.updatedAt);
  const nextProfile = normalizeProfile({ ...clone(account.profile || {}), ...(patch || {}) });
  return deepFreeze({ ...clone(account), profile: nextProfile, updatedAt: at });
}

export function addCustomerAddress(
  account,
  principal,
  rawAddress,
  { makeDefaultShipping = false, makeDefaultBilling = false, updatedAt } = {}
) {
  assertPrincipalOwnsAccount(account, principal);
  const address = normalizeAddress(rawAddress);
  if (account.addresses.some((item) => item.id === address.id)) {
    throw new Error("CUSTOMER_DUPLICATE_ADDRESS_ID");
  }
  const at = timestamp(updatedAt);
  assertNotBefore(at, account.createdAt);
  assertNotBefore(at, account.updatedAt);
  return deepFreeze({
    ...clone(account),
    addresses: [...account.addresses.map(clone), address],
    defaultShippingAddressId: makeDefaultShipping ? address.id : account.defaultShippingAddressId,
    defaultBillingAddressId: makeDefaultBilling ? address.id : account.defaultBillingAddressId,
    updatedAt: at,
  });
}

export function updateCustomerAddress(account, principal, addressId, patch = {}, { updatedAt } = {}) {
  assertPrincipalOwnsAccount(account, principal);
  const id = text(addressId, 200);
  const current = account.addresses.find((item) => item.id === id);
  if (!current) throw new Error("CUSTOMER_ADDRESS_NOT_FOUND");
  const updated = normalizeAddress({ ...clone(current), ...(patch || {}), id });
  const at = timestamp(updatedAt);
  assertNotBefore(at, account.createdAt);
  assertNotBefore(at, account.updatedAt);
  return deepFreeze({
    ...clone(account),
    addresses: account.addresses.map((item) => (item.id === id ? updated : clone(item))),
    updatedAt: at,
  });
}

export function setDefaultCustomerAddress(
  account,
  principal,
  addressId,
  { shipping = false, billing = false, updatedAt } = {}
) {
  assertPrincipalOwnsAccount(account, principal);
  const id = text(addressId, 200);
  if (!account.addresses.some((item) => item.id === id)) throw new Error("CUSTOMER_ADDRESS_NOT_FOUND");
  if (!shipping && !billing) throw new Error("CUSTOMER_DEFAULT_ADDRESS_PURPOSE_REQUIRED");
  const at = timestamp(updatedAt);
  assertNotBefore(at, account.createdAt);
  assertNotBefore(at, account.updatedAt);
  return deepFreeze({
    ...clone(account),
    defaultShippingAddressId: shipping ? id : account.defaultShippingAddressId,
    defaultBillingAddressId: billing ? id : account.defaultBillingAddressId,
    updatedAt: at,
  });
}

export function removeCustomerAddress(account, principal, addressId, { updatedAt } = {}) {
  assertPrincipalOwnsAccount(account, principal);
  const id = text(addressId, 200);
  if (!account.addresses.some((item) => item.id === id)) throw new Error("CUSTOMER_ADDRESS_NOT_FOUND");
  const at = timestamp(updatedAt);
  assertNotBefore(at, account.createdAt);
  assertNotBefore(at, account.updatedAt);
  return deepFreeze({
    ...clone(account),
    addresses: account.addresses.filter((item) => item.id !== id).map(clone),
    defaultShippingAddressId:
      account.defaultShippingAddressId === id ? null : account.defaultShippingAddressId,
    defaultBillingAddressId:
      account.defaultBillingAddressId === id ? null : account.defaultBillingAddressId,
    updatedAt: at,
  });
}

function assertOrder(order) {
  if (!order || typeof order !== "object") throw new TypeError("CUSTOMER_ORDER_REQUIRED");
  if (!text(order.id, 200)) throw new TypeError("CUSTOMER_ORDER_ID_REQUIRED");
  if (!text(order.workspaceId, 200)) throw new TypeError("CUSTOMER_ORDER_WORKSPACE_REQUIRED");
  if (!text(order.storeId, 200)) throw new TypeError("CUSTOMER_ORDER_STORE_REQUIRED");
}

function validateOrderLinks(workspaceId, storeId, existingLinks = []) {
  if (!Array.isArray(existingLinks)) throw new TypeError("CUSTOMER_ORDER_LINKS_ARRAY_REQUIRED");
  const ids = new Set();
  const orders = new Set();
  for (const link of existingLinks) {
    if (!link || typeof link !== "object") throw new Error("CUSTOMER_ORDER_LINK_INVALID");
    if (link.workspaceId !== workspaceId) throw new Error("CUSTOMER_ORDER_LINK_WORKSPACE_MISMATCH");
    if (link.storeId !== storeId) throw new Error("CUSTOMER_ORDER_LINK_STORE_MISMATCH");
    const linkId = text(link.id, 200);
    const orderId = text(link.orderId, 200);
    const customerAccountId = text(link.customerAccountId, 200);
    const identitySubjectId = text(link.identitySubjectId, 200);
    if (!linkId || !orderId || !customerAccountId || !identitySubjectId) {
      throw new Error("CUSTOMER_ORDER_LINK_INVALID");
    }
    if (link.source !== "CHECKOUT") throw new Error("CUSTOMER_ORDER_LINK_SOURCE_INVALID");
    if (ids.has(linkId)) throw new Error("CUSTOMER_DUPLICATE_ORDER_LINK_ID");
    if (orders.has(orderId)) throw new Error("CUSTOMER_ORDER_ALREADY_LINKED");
    ids.add(linkId);
    orders.add(orderId);
  }
  return { ids, orders };
}

export function createCustomerOrderLink({
  id,
  account,
  principal,
  order,
  existingLinks = [],
  source = "CHECKOUT",
  linkedAt,
  metadata = {},
} = {}) {
  assertPrincipalOwnsAccount(account, principal);
  assertOrder(order);
  if (order.workspaceId !== account.workspaceId) throw new Error("CUSTOMER_ORDER_WORKSPACE_MISMATCH");
  if (order.storeId !== account.storeId) throw new Error("CUSTOMER_ORDER_STORE_MISMATCH");
  const linkId = text(id, 200);
  if (!linkId) throw new TypeError("CUSTOMER_ORDER_LINK_ID_REQUIRED");
  if (text(source, 40).toUpperCase() !== "CHECKOUT") {
    throw new Error("CUSTOMER_ORDER_LINK_SOURCE_FORBIDDEN");
  }
  const history = validateOrderLinks(account.workspaceId, account.storeId, existingLinks);
  if (history.ids.has(linkId)) throw new Error("CUSTOMER_DUPLICATE_ORDER_LINK_ID");
  if (history.orders.has(order.id)) throw new Error("CUSTOMER_ORDER_ALREADY_LINKED");
  const at = timestamp(linkedAt, "CUSTOMER_ORDER_LINK_INVALID_TIMESTAMP");
  assertNotBefore(at, order.createdAt, "CUSTOMER_ORDER_LINK_TIMESTAMP_REGRESSION");
  return deepFreeze({
    id: linkId,
    workspaceId: account.workspaceId,
    storeId: account.storeId,
    orderId: order.id,
    customerAccountId: account.id,
    identitySource: account.identitySource,
    identitySubjectId: account.identitySubjectId,
    authProjectId: account.authProjectId,
    source: "CHECKOUT",
    linkedAt: at,
    metadata: clone(metadata || {}),
  });
}
