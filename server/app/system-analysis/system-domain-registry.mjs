const entries=[
 {id:"ACQUISITION",version:1,label:"جذب",supportedMetrics:["website_visits"],supportedFlows:["COMMERCE_FLOW_V1","LEAD_FLOW_V1"],evidenceSources:["KPI","ATTRIBUTION","PERFORMANCE_OBSERVATION"]},
 {id:"CONTENT",version:1,label:"محتوا",supportedMetrics:["content_engagement"],supportedFlows:[],evidenceSources:["KPI","FEATURE_VALUE","PERFORMANCE_OBSERVATION"]},
 {id:"LANDING",version:1,label:"لندینگ",supportedMetrics:["landing_conversion"],supportedFlows:["LEAD_FLOW_V1"],evidenceSources:["KPI","PERFORMANCE_OBSERVATION"]},
 {id:"WEBSITE",version:1,label:"وب‌سایت",supportedMetrics:["website_visits","product_views"],supportedFlows:["COMMERCE_FLOW_V1"],evidenceSources:["KPI","ATTRIBUTION","PERFORMANCE_OBSERVATION"]},
 {id:"LEAD",version:1,label:"سرنخ",supportedMetrics:["leads","qualified_leads"],supportedFlows:["LEAD_FLOW_V1"],evidenceSources:["KPI","SIGNAL"]},
 {id:"SALES",version:1,label:"فروش",supportedMetrics:["customers","completed_orders"],supportedFlows:["COMMERCE_FLOW_V1","LEAD_FLOW_V1"],evidenceSources:["KPI","PERFORMANCE_OBSERVATION"]},
 {id:"CHECKOUT",version:1,label:"تسویه",supportedMetrics:["add_to_cart","checkout_started"],supportedFlows:["COMMERCE_FLOW_V1"],evidenceSources:["KPI","SIGNAL"]},
 {id:"PAYMENT",version:1,label:"پرداخت",supportedMetrics:["successful_payments"],supportedFlows:["COMMERCE_FLOW_V1"],evidenceSources:["KPI","SIGNAL"]},
 {id:"FULFILLMENT",version:1,label:"ارسال",supportedMetrics:["completed_orders"],supportedFlows:["COMMERCE_FLOW_V1"],evidenceSources:["KPI","SIGNAL"]},
 {id:"RETENTION",version:1,label:"نگهداشت",supportedMetrics:["repeat_purchase_rate"],supportedFlows:[],evidenceSources:["KPI"]},
 {id:"CUSTOMER_VALUE",version:1,label:"ارزش مشتری",supportedMetrics:["customer_value"],supportedFlows:[],evidenceSources:["KPI"]},
 {id:"MARKETING_ECONOMICS",version:1,label:"اقتصاد بازاریابی",supportedMetrics:["cac","roas"],supportedFlows:[],evidenceSources:["KPI","ATTRIBUTION"]}
];
export const systemDomainRegistry=Object.freeze(entries.map(x=>Object.freeze({...x,supportedMetrics:Object.freeze(x.supportedMetrics),supportedFlows:Object.freeze(x.supportedFlows),evidenceSources:Object.freeze(x.evidenceSources)})));
export const getSystemDomain=id=>systemDomainRegistry.find(x=>x.id===id)||null;
