export class CustomerAccountPersistenceError extends Error {
  constructor(message, code = "CUSTOMER_PERSISTENCE_ERROR", status = 400) {
    super(message);
    this.name = "CustomerAccountPersistenceError";
    this.code = code;
    this.status = status;
  }
}

const required = (value, name) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new CustomerAccountPersistenceError(`${name} is required`, "CUSTOMER_INPUT_REQUIRED", 400);
  return normalized;
};
const json = (value, fallback = {}) => {
  try { return JSON.parse(value || JSON.stringify(fallback)); } catch { return fallback; }
};
const parseAddress = (row) => ({
  id: row.id,
  label: row.label,
  name: row.name,
  phone: row.phone,
  email: row.email,
  country: row.country,
  province: row.province,
  city: row.city,
  address1: row.address1,
  address2: row.address2,
  postalCode: row.postalCode,
});

export function createCustomerAccountRepository(db) {
  if (!db) throw new CustomerAccountPersistenceError("Database is required", "CUSTOMER_DATABASE_REQUIRED", 500);

  const getAddresses = (workspaceId, accountId) => db.prepare(`
    SELECT id,label,name,phone,email,country,province,city,address1,address2,postal_code AS postalCode,
           is_default_shipping AS isDefaultShipping,is_default_billing AS isDefaultBilling
    FROM ecommerce_customer_addresses WHERE workspace_id=? AND customer_account_id=? ORDER BY created_at ASC,id ASC
  `).all(workspaceId, accountId);

  const hydrate = (row) => {
    if (!row) return null;
    const addressRows = getAddresses(row.workspaceId, row.id);
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      storeId: row.siteProjectId,
      identitySource: "APP_USER",
      identitySubjectId: row.appUserId,
      authProjectId: row.authProjectId,
      profile: { displayName: row.displayName, phone: row.phone },
      addresses: addressRows.map(parseAddress),
      defaultShippingAddressId: addressRows.find((x) => x.isDefaultShipping)?.id || null,
      defaultBillingAddressId: addressRows.find((x) => x.isDefaultBilling)?.id || null,
      metadata: json(row.metadataJson),
      revision: row.revision,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  };

  const selectAccount = (where, args) => {
    const row = db.prepare(`
      SELECT id,workspace_id AS workspaceId,site_project_id AS siteProjectId,auth_project_id AS authProjectId,
             app_user_id AS appUserId,display_name AS displayName,phone,metadata_json AS metadataJson,
             revision,created_at AS createdAt,updated_at AS updatedAt
      FROM ecommerce_customer_accounts WHERE ${where}
    `).get(...args);
    return hydrate(row);
  };

  const bump = (workspaceId, accountId, expectedRevision, updatedAt, profile = null) => {
    const result = profile
      ? db.prepare(`UPDATE ecommerce_customer_accounts SET display_name=?,phone=?,revision=revision+1,updated_at=? WHERE workspace_id=? AND id=? AND revision=?`).run(profile.displayName, profile.phone, updatedAt, workspaceId, accountId, expectedRevision)
      : db.prepare(`UPDATE ecommerce_customer_accounts SET revision=revision+1,updated_at=? WHERE workspace_id=? AND id=? AND revision=?`).run(updatedAt, workspaceId, accountId, expectedRevision);
    if (result.changes !== 1) throw new CustomerAccountPersistenceError("Customer account changed concurrently", "CUSTOMER_REVISION_CONFLICT", 409);
  };

  return Object.freeze({
    resolveStoreBinding({ workspaceId, siteProjectId, authProjectId }) {
      const row = db.prepare(`SELECT business_builder_project_id AS authProjectId FROM business_builder_commerce_bindings WHERE workspace_id=? AND site_project_id=? AND business_builder_project_id=? AND status='active'`).get(required(workspaceId,"workspaceId"), required(siteProjectId,"siteProjectId"), required(authProjectId,"authProjectId"));
      return row || null;
    },
    getByIdentity({ workspaceId, siteProjectId, authProjectId, appUserId }) {
      return selectAccount("workspace_id=? AND site_project_id=? AND auth_project_id=? AND app_user_id=?", [required(workspaceId,"workspaceId"),required(siteProjectId,"siteProjectId"),required(authProjectId,"authProjectId"),required(appUserId,"appUserId")]);
    },
    getById({ workspaceId, accountId }) {
      return selectAccount("workspace_id=? AND id=?", [required(workspaceId,"workspaceId"),required(accountId,"accountId")]);
    },
    create(account) {
      db.prepare(`INSERT INTO ecommerce_customer_accounts(id,workspace_id,site_project_id,auth_project_id,app_user_id,display_name,phone,metadata_json,revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,1,?,?)`).run(account.id,account.workspaceId,account.storeId,account.authProjectId,account.identitySubjectId,account.profile?.displayName||null,account.profile?.phone||null,JSON.stringify(account.metadata||{}),account.createdAt,account.updatedAt);
      return this.getById({ workspaceId: account.workspaceId, accountId: account.id });
    },
    saveProfile({ account, expectedRevision, updatedAt }) {
      bump(account.workspaceId, account.id, expectedRevision, updatedAt, account.profile);
      return this.getById({ workspaceId: account.workspaceId, accountId: account.id });
    },
    addAddress({ account, address, expectedRevision, updatedAt, makeDefaultShipping=false, makeDefaultBilling=false }) {
      const tx = db.transaction(() => {
        if (makeDefaultShipping) db.prepare(`UPDATE ecommerce_customer_addresses SET is_default_shipping=0 WHERE workspace_id=? AND customer_account_id=?`).run(account.workspaceId,account.id);
        if (makeDefaultBilling) db.prepare(`UPDATE ecommerce_customer_addresses SET is_default_billing=0 WHERE workspace_id=? AND customer_account_id=?`).run(account.workspaceId,account.id);
        db.prepare(`INSERT INTO ecommerce_customer_addresses(id,workspace_id,customer_account_id,label,name,phone,email,country,province,city,address1,address2,postal_code,is_default_shipping,is_default_billing,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(address.id,account.workspaceId,account.id,address.label,address.name,address.phone,address.email,address.country,address.province,address.city,address.address1,address.address2,address.postalCode,makeDefaultShipping?1:0,makeDefaultBilling?1:0,updatedAt,updatedAt);
        bump(account.workspaceId, account.id, expectedRevision, updatedAt);
      });
      tx();
      return this.getById({ workspaceId: account.workspaceId, accountId: account.id });
    },
    updateAddress({ account, address, expectedRevision, updatedAt }) {
      const tx = db.transaction(() => {
        const result=db.prepare(`UPDATE ecommerce_customer_addresses SET label=?,name=?,phone=?,email=?,country=?,province=?,city=?,address1=?,address2=?,postal_code=?,updated_at=? WHERE workspace_id=? AND customer_account_id=? AND id=?`).run(address.label,address.name,address.phone,address.email,address.country,address.province,address.city,address.address1,address.address2,address.postalCode,updatedAt,account.workspaceId,account.id,address.id);
        if(result.changes!==1) throw new CustomerAccountPersistenceError("Address not found","CUSTOMER_ADDRESS_NOT_FOUND",404);
        bump(account.workspaceId, account.id, expectedRevision, updatedAt);
      }); tx();
      return this.getById({ workspaceId: account.workspaceId, accountId: account.id });
    },
    setDefaults({ account, addressId, shipping, billing, expectedRevision, updatedAt }) {
      const tx=db.transaction(()=>{
        const exists=db.prepare(`SELECT 1 FROM ecommerce_customer_addresses WHERE workspace_id=? AND customer_account_id=? AND id=?`).get(account.workspaceId,account.id,addressId);
        if(!exists) throw new CustomerAccountPersistenceError("Address not found","CUSTOMER_ADDRESS_NOT_FOUND",404);
        if(shipping){db.prepare(`UPDATE ecommerce_customer_addresses SET is_default_shipping=0 WHERE workspace_id=? AND customer_account_id=?`).run(account.workspaceId,account.id);db.prepare(`UPDATE ecommerce_customer_addresses SET is_default_shipping=1 WHERE id=?`).run(addressId);}
        if(billing){db.prepare(`UPDATE ecommerce_customer_addresses SET is_default_billing=0 WHERE workspace_id=? AND customer_account_id=?`).run(account.workspaceId,account.id);db.prepare(`UPDATE ecommerce_customer_addresses SET is_default_billing=1 WHERE id=?`).run(addressId);}
        bump(account.workspaceId,account.id,expectedRevision,updatedAt);
      });tx();return this.getById({workspaceId:account.workspaceId,accountId:account.id});
    },
    removeAddress({ account, addressId, expectedRevision, updatedAt }) {
      const tx=db.transaction(()=>{const result=db.prepare(`DELETE FROM ecommerce_customer_addresses WHERE workspace_id=? AND customer_account_id=? AND id=?`).run(account.workspaceId,account.id,addressId);if(result.changes!==1)throw new CustomerAccountPersistenceError("Address not found","CUSTOMER_ADDRESS_NOT_FOUND",404);bump(account.workspaceId,account.id,expectedRevision,updatedAt);});tx();return this.getById({workspaceId:account.workspaceId,accountId:account.id});
    },
    linkOrder(link) {
      db.prepare(`INSERT INTO ecommerce_customer_order_links(id,workspace_id,site_project_id,order_id,customer_account_id,app_user_id,auth_project_id,source,linked_at,metadata_json) VALUES(?,?,?,?,?,?,?,?,?,?)`).run(link.id,link.workspaceId,link.storeId,link.orderId,link.customerAccountId,link.identitySubjectId,link.authProjectId,link.source,link.linkedAt,JSON.stringify(link.metadata||{}));
      return link;
    },
    listOrders({ workspaceId, accountId, limit=100 }) {
      return db.prepare(`SELECT o.id,o.status,o.payment_status AS paymentStatus,o.fulfillment_status AS fulfillmentStatus,o.currency,o.total_minor AS totalMinor,o.shipping_address_json AS shippingAddressJson,o.created_at AS createdAt,l.linked_at AS linkedAt FROM ecommerce_customer_order_links l JOIN ecommerce_orders o ON o.id=l.order_id AND o.workspace_id=l.workspace_id WHERE l.workspace_id=? AND l.customer_account_id=? ORDER BY o.created_at DESC,o.id DESC LIMIT ?`).all(required(workspaceId,"workspaceId"),required(accountId,"accountId"),Math.max(1,Math.min(Number(limit)||100,200))).map(row=>({...row,shippingAddress:json(row.shippingAddressJson),shippingAddressJson:undefined}));
    },
  });
}
