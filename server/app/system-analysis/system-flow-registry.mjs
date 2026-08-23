const flows=[
 {flowId:"COMMERCE_FLOW_V1",version:1,objectiveTypes:["completed_orders","successful_payments","checkout_completion","revenue"],supportedDomains:["ACQUISITION","WEBSITE","CHECKOUT","PAYMENT","FULFILLMENT","SALES"],stages:[
  {id:"VISIT",domain:"ACQUISITION",metricKey:"website_visits"},{id:"PRODUCT_VIEW",domain:"WEBSITE",metricKey:"product_views"},{id:"ADD_TO_CART",domain:"CHECKOUT",metricKey:"add_to_cart"},{id:"CHECKOUT",domain:"CHECKOUT",metricKey:"checkout_started"},{id:"PAYMENT",domain:"PAYMENT",metricKey:"successful_payments"},{id:"ORDER",domain:"SALES",metricKey:"completed_orders"}]},
 {flowId:"LEAD_FLOW_V1",version:1,objectiveTypes:["qualified_leads","customers","lead_conversion_rate"],supportedDomains:["ACQUISITION","LANDING","LEAD","SALES"],stages:[
  {id:"VISITOR",domain:"ACQUISITION",metricKey:"website_visits"},{id:"LEAD",domain:"LEAD",metricKey:"leads"},{id:"QUALIFIED_LEAD",domain:"LEAD",metricKey:"qualified_leads"},{id:"CUSTOMER",domain:"SALES",metricKey:"customers"}]}
];
export const systemFlowRegistry=Object.freeze(flows.map(f=>Object.freeze({...f,objectiveTypes:Object.freeze(f.objectiveTypes),supportedDomains:Object.freeze(f.supportedDomains),stages:Object.freeze(f.stages.map(Object.freeze))})));
export const getSystemFlow=id=>systemFlowRegistry.find(x=>x.flowId===id)||null;
