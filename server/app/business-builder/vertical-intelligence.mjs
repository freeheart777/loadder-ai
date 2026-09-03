const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const pct = (a,b) => b ? Math.round((a/b)*1000)/10 : 0;

function crm(snapshot){
  const customers=snapshot.customer||[], opportunities=snapshot.opportunity||[], activities=snapshot.activity||[];
  const won=opportunities.filter(x=>x.stage==="won"), open=opportunities.filter(x=>!["won","lost"].includes(x.stage));
  const pipeline=open.reduce((s,x)=>s+number(x.value),0), wonValue=won.reduce((s,x)=>s+number(x.value),0);
  return {kind:"crm",cards:[{id:"customers",label:"مشتریان",value:customers.length},{id:"pipeline",label:"ارزش پایپ‌لاین",value:pipeline,format:"money"},{id:"won",label:"فروش موفق",value:wonValue,format:"money"},{id:"conversion",label:"نرخ برد",value:pct(won.length,opportunities.length),format:"percent"}],alerts:activities.filter(x=>!x.completed&&x.dueAt&&new Date(x.dueAt)<new Date()).slice(0,5).map(x=>({level:"warning",title:"پیگیری عقب‌افتاده",entityId:"activity",recordId:x.id})),segments:Object.entries(opportunities.reduce((a,x)=>({...a,[x.stage||"unknown"]:(a[x.stage||"unknown"]||0)+1}),{})).map(([label,value])=>({label,value}))};
}
function inventory(snapshot){
  const products=snapshot.product||[], stocks=snapshot.stock||[], warehouses=snapshot.warehouse||[];
  const low=stocks.filter(x=>number(x.quantity)<=number(x.reorderPoint));
  return {kind:"inventory",cards:[{id:"products",label:"کالاها",value:products.length},{id:"warehouses",label:"انبارها",value:warehouses.length},{id:"stock",label:"موجودی کل",value:stocks.reduce((s,x)=>s+number(x.quantity),0)},{id:"low",label:"نیازمند سفارش",value:low.length}],alerts:low.slice(0,8).map(x=>({level:"critical",title:"موجودی به نقطه سفارش رسیده",entityId:"stock",recordId:x.id})),segments:[]};
}
function booking(snapshot){
  const bookings=snapshot.booking||[], services=snapshot.service||[]; const now=Date.now(), week=now+7*86400000;
  const upcoming=bookings.filter(x=>{const t=Date.parse(x.startsAt);return t>=now&&t<=week&&!['cancelled','completed'].includes(x.status)});
  const cancelled=bookings.filter(x=>x.status==="cancelled");
  return {kind:"booking",cards:[{id:"bookings",label:"کل رزروها",value:bookings.length},{id:"upcoming",label:"۷ روز آینده",value:upcoming.length},{id:"services",label:"خدمات",value:services.length},{id:"cancel",label:"نرخ لغو",value:pct(cancelled.length,bookings.length),format:"percent"}],alerts:upcoming.slice(0,5).map(x=>({level:"info",title:"رزرو پیش‌رو",entityId:"booking",recordId:x.id})),segments:Object.entries(bookings.reduce((a,x)=>({...a,[x.status||"unknown"]:(a[x.status||"unknown"]||0)+1}),{})).map(([label,value])=>({label,value}))};
}
export function buildVerticalIntelligence({definition,snapshot}){
  const ids=new Set(definition.entities.map(x=>x.id));
  if(ids.has("opportunity"))return crm(snapshot);
  if(ids.has("stock"))return inventory(snapshot);
  if(ids.has("booking"))return booking(snapshot);
  return {kind:"generic",cards:definition.entities.slice(0,4).map(e=>({id:e.id,label:e.name,value:(snapshot[e.id]||[]).length})),alerts:[],segments:[]};
}
