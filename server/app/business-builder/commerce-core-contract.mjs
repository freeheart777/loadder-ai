export const LOADDER_COMMERCE_CORE=Object.freeze({
  contract:"loadder.commerce-core.v1",
  ownership:{
    catalog:"commerce.product",
    customers:"commerce.customer",
    orders:"commerce.order",
    orderItems:"commerce.orderItem",
    payments:"commerce.payment",
    fulfillment:"commerce.fulfillment",
    inventory:"inventory.stock",
    accounting:"accounting",
  },
  channels:Object.freeze({
    websiteBuilder:{mode:"storefront",writes:["customer","order","orderItem"],reads:["product","payment","fulfillment"]},
    appBuilder:{mode:"operations",writes:["product","order","payment","fulfillment"],reads:["customer","orderItem"]},
  }),
  events:Object.freeze([
    {id:"commerce.order.placed",source:"order",consumers:["inventory","crm","payments","analytics"]},
    {id:"commerce.payment.confirmed",source:"payment",consumers:["orders","accounting","analytics"]},
    {id:"commerce.order.fulfilled",source:"fulfillment",consumers:["orders","crm","analytics"]},
    {id:"commerce.refund.completed",source:"payment",consumers:["orders","accounting","analytics"]},
  ]),
  rules:Object.freeze([
    "website-and-app-share-one-commerce-domain",
    "website-builder-must-not-create-a-shadow-order-database",
    "inventory-adjustment-is-event-driven-and-idempotent",
    "accounting-posting-occurs-only-after-authoritative-payment-state",
    "channel-clients-never-own-payment-secrets",
  ]),
});

export function validateCommerceBinding({websiteDomain=null,appDomain=null}={}){
  const blockers=[];
  if(websiteDomain!==LOADDER_COMMERCE_CORE.contract)blockers.push("website-commerce-core-binding-required");
  if(appDomain!==LOADDER_COMMERCE_CORE.contract)blockers.push("app-commerce-core-binding-required");
  return Object.freeze({ready:blockers.length===0,contract:LOADDER_COMMERCE_CORE.contract,blockers});
}
