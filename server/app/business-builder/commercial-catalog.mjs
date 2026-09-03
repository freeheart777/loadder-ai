export const LOADDER_APP_CATALOG=Object.freeze([
  {id:"crm-sales",category:"Sales & CRM",title:"CRM و مدیریت فروش",examples:["Lead Management","Pipeline","Quotation","Follow-up","Commission"],readiness:"alpha"},
  {id:"inventory",category:"Operations",title:"انبار و موجودی",examples:["Warehouse","Stock","Reorder","Purchase Requests"],readiness:"alpha"},
  {id:"booking",category:"Bookings",title:"رزرو و نوبت‌دهی",examples:["Clinic Scheduling","Salon","Consultation","Classes"],readiness:"alpha"},
  {id:"internal-tools",category:"Internal Tools",title:"ابزارهای داخلی سازمان",examples:["Approvals","Purchase Request","Asset Tracking","Admin Panels"],readiness:"supported"},
  {id:"customer-portal",category:"Portals",title:"پرتال مشتری",examples:["Orders","Invoices","Documents","Support"],readiness:"supported"},
  {id:"project-management",category:"Projects",title:"مدیریت پروژه و عملیات",examples:["Tasks","Milestones","Contractors","Progress"],readiness:"supported"},
  {id:"hr",category:"HR",title:"منابع انسانی",examples:["Recruitment","Onboarding","Leave","Performance"],readiness:"planned"},
  {id:"marketplace",category:"Marketplace",title:"مارکت‌پلیس",examples:["Buyer/Seller","RFQ","Services","Listings"],readiness:"planned"},
  {id:"light-erp",category:"ERP",title:"ERP سبک",examples:["Sales","Inventory","Purchasing","Invoices","Operations"],readiness:"planned"},
  {id:"logistics",category:"Vertical",title:"لجستیک",examples:["Shipments","Fleet","Drivers","Tracking","Documents"],readiness:"planned"},
  {id:"real-estate",category:"Vertical",title:"املاک",examples:["Properties","Leads","Agents","Visits","Contracts"],readiness:"planned"},
  {id:"agency",category:"Vertical",title:"آژانس و مارکتینگ",examples:["Clients","Campaigns","Content Approval","Reporting"],readiness:"planned"},
  {id:"support",category:"Support",title:"پشتیبانی مشتری",examples:["Tickets","SLA","Knowledge","Customer Timeline"],readiness:"planned"},
  {id:"membership",category:"Digital Products",title:"عضویت و اشتراک",examples:["Membership","Plans","Content Access","Community"],readiness:"planned"},
]);

export const LOADDER_PLATFORM_TARGETS=Object.freeze([
  {id:"web",label:"Web App",status:"supported",notes:"Primary commercial target."},
  {id:"pwa",label:"PWA",status:"supported",notes:"Installable web experience; current App Definition already targets PWA."},
  {id:"ios-native",label:"iOS Native",status:"planned",notes:"Requires a Loadder-owned React Native/Expo renderer plus signing, build and App Store delivery pipeline."},
  {id:"android-native",label:"Android Native",status:"planned",notes:"Shares the future native renderer architecture with iOS."},
]);

export function getCommercialBuilderCatalog(){return {catalog:LOADDER_APP_CATALOG,platforms:LOADDER_PLATFORM_TARGETS};}
