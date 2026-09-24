import {useEffect,useMemo,useState} from "react";
import {ArrowRight,Cube,ImageSquare,MagnifyingGlass,Package,Plus,ShoppingCartSimple,Star,UploadSimple,X} from "@phosphor-icons/react";
import {Link} from "react-router-dom";
import {apiFetch} from "../lib/api";
import {uploadSiteMedia} from "../lib/siteMediaUpload";

type Project={id:string;name:string;siteType:string};
type Variant={id:string;sku:string;title:string;priceMinor:number|null;inventoryQuantity:number;options:Record<string,string>;imageUrl?:string|null};
type Product={id:string;name:string;slug:string;description?:string;status:string;currency:string;basePriceMinor:number;compareAtPriceMinor?:number|null;category?:string|null;brand?:string|null;featured?:boolean;metadata?:Record<string,unknown>;variants:Variant[]};
type OrderItem={id:string;productId:string;variantId:string;productName:string;sku:string;quantity:number;unitPriceMinor:number;lineTotalMinor:number};
type ShippingAddress={fullName?:string;phone?:string;province?:string;city?:string;address?:string;postalCode?:string;notes?:string};
type Order={id:string;email?:string|null;currency:string;status:string;paymentStatus:string;fulfillmentStatus:string;paymentProvider?:string|null;shippingMethod?:string|null;shippingAddress?:ShippingAddress|null;subtotalMinor:number;discountMinor:number;shippingMinor:number;totalMinor:number;items:OrderItem[];createdAt:string};
type PaymentProviderConfig={providerKey:string;status:string};
type FormErrors={name?:string;price?:string;inventory?:string;submit?:string};

const empty={name:"",sku:"",price:"",compareAt:"",inventory:"0",category:"",brand:"",currency:"IRT",description:"",slug:"",seoTitle:"",seoDescription:"",featured:false,variantTitle:"پیش‌فرض"};
const emptyVariant={productId:"",title:"",sku:"",price:"",inventory:"0",color:"",size:"",imageUrl:""};

// Orders may not move directly into REFUNDED -- the API itself refuses that,
// since payment/refund state has its own canonical authority (the refund
// service, not a plain status patch). Kept out of the picker for the same reason.
const ORDER_STATUS_LABELS:Record<string,string>={PENDING:"در انتظار",CONFIRMED:"تایید شده",FULFILLING:"در حال آماده‌سازی",SHIPPED:"ارسال شده",COMPLETED:"تکمیل شده",CANCELLED:"لغو شده",REFUNDED:"بازگشت وجه"};
const ORDER_STATUS_OPTIONS=["PENDING","CONFIRMED","FULFILLING","SHIPPED","COMPLETED","CANCELLED"];
const FULFILLMENT_STATUS_LABELS:Record<string,string>={UNFULFILLED:"ارسال نشده",PARTIAL:"بخشی ارسال شده",FULFILLED:"ارسال کامل",RETURNED:"مرجوعی"};
const FULFILLMENT_STATUS_OPTIONS=["UNFULFILLED","PARTIAL","FULFILLED","RETURNED"];
const PAYMENT_STATUS_LABELS:Record<string,string>={UNPAID:"پرداخت‌نشده",AUTHORIZED:"مجاز شده",PAID:"پرداخت‌شده",PARTIALLY_REFUNDED:"بازگشت جزئی",REFUNDED:"بازگشت کامل",FAILED:"ناموفق"};

async function read(r:Response){const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||"خطا در ارتباط با فروشگاه");return d}
function fmt(n:number,c:string){const v=(n||0)/100;return `${new Intl.NumberFormat("fa-IR").format(v)} ${c==="IRT"?"تومان":c}`}
function autoSku(){return `LDR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`}

export default function StoreCommerceManagerPage(){
 const[project,setProject]=useState<Project|null>(null),[products,setProducts]=useState<Product[]>([]),[orders,setOrders]=useState<Order[]>([]),[form,setForm]=useState(empty),[variantForm,setVariantForm]=useState(emptyVariant),[primary,setPrimary]=useState<File|null>(null),[gallery,setGallery]=useState<File[]>([]),[variantImage,setVariantImage]=useState<File|null>(null),[query,setQuery]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false),[advanced,setAdvanced]=useState(false),[errors,setErrors]=useState<FormErrors>({});
 const[view,setView]=useState<"products"|"orders"|"payments">("products");
 const[selectedOrderId,setSelectedOrderId]=useState<string|null>(null);
 const[orderBusy,setOrderBusy]=useState(false);
 const[orderMessage,setOrderMessage]=useState("");
 const[providerKeyInput,setProviderKeyInput]=useState("");
 const[credentialReferenceInput,setCredentialReferenceInput]=useState("");
 const[paymentBusy,setPaymentBusy]=useState(false);
 const[paymentMessage,setPaymentMessage]=useState("");
 const[lastConfiguredProvider,setLastConfiguredProvider]=useState<PaymentProviderConfig|null>(null);
 useEffect(()=>{void boot()},[]);
 async function boot(){try{const d=await read(await apiFetch("/api/site-projects"));const s=(d.projects||[]).find((x:Project)=>String(x.siteType).toUpperCase()==="STORE");if(!s)throw new Error("ابتدا یک فروشگاه بساز");setProject(s);await refresh(s.id)}catch(e){setMessage(e instanceof Error?e.message:"خطا")}}
 async function refresh(id=project?.id){if(!id)return;const[p,o]=await Promise.all([read(await apiFetch(`/api/stores/${id}/products`)),read(await apiFetch(`/api/stores/${id}/orders`))]);setProducts(p.products||[]);setOrders(o.orders||[])}
 async function uploadAsset(f:File,placement:string,productId?:string){if(!project)throw new Error("پروژه پیدا نشد");setMessage(`در حال آپلود ${f.name}…`);const assetType=placement.includes("gallery")?"gallery":"product";const media=await uploadSiteMedia({siteProjectId:project.id,file:f,assetType,metadata:{placement,altText:form.name||"تصویر محصول",...(productId?{productId}:{})}});return media.url}

 async function createProduct(){
  if(busy)return;
  const nextErrors:FormErrors={};
  if(!project)nextErrors.submit="پروژه فروشگاهی پیدا نشد. صفحه را رفرش کن.";
  if(!form.name.trim())nextErrors.name="نام محصول را وارد کن.";
  const price=form.price.trim()===""?0:Number(form.price);
  const compare=form.compareAt?Number(form.compareAt):null;
  const inventory=form.inventory.trim()===""?0:Number(form.inventory);
  if(!Number.isFinite(price)||price<0)nextErrors.price="قیمت معتبر نیست.";
  if(!Number.isInteger(inventory)||inventory<0)nextErrors.inventory="موجودی باید عدد صحیح صفر یا بیشتر باشد.";
  if(compare!==null&&(!Number.isFinite(compare)||compare<0))nextErrors.price="قیمت خط‌خورده معتبر نیست.";
  setErrors(nextErrors);
  if(Object.keys(nextErrors).length){setMessage("اطلاعات فرم را بررسی کن.");return}
  if(!project)return;
  const sku=form.sku.trim()||autoSku();
  setBusy(true);setMessage("در حال ثبت محصول…");
  try{
   let imageUrl:string|null=null;
   if(primary)imageUrl=await uploadAsset(primary,"primary-draft");
   const galleryUrls:string[]=[];
   for(const f of gallery)galleryUrls.push(await uploadAsset(f,"gallery-draft"));
   const d=await read(await apiFetch(`/api/stores/${project.id}/products`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:form.name.trim(),sku,slug:form.slug||undefined,description:form.description,basePriceMinor:Math.round(price*100),compareAtPriceMinor:compare===null?null:Math.round(compare*100),inventoryQuantity:inventory,category:form.category||null,brand:form.brand||null,currency:form.currency,status:"ACTIVE",featured:form.featured,seoTitle:form.seoTitle||null,seoDescription:form.seoDescription||null,imageUrl,variantTitle:form.variantTitle||"پیش‌فرض"})}));
   let created=d.product||d.data?.product||null;
   if(!created){const fresh=await read(await apiFetch(`/api/stores/${project.id}/products`));created=(fresh.products||[]).find((p:Product)=>p.variants?.some(v=>v.sku===sku))||null}
   if(!created)throw new Error("محصول ایجاد شد اما پاسخ آن دریافت نشد؛ لطفاً لیست محصولات را بررسی کن.");
   if(galleryUrls.length||imageUrl){await read(await apiFetch(`/api/commerce/products/${created.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({metadata:{...(created.metadata||{}),gallery:[imageUrl,...galleryUrls].filter(Boolean)}})}))}
   setForm({...empty,currency:form.currency});setPrimary(null);setGallery([]);setErrors({});
   await refresh();
   setMessage(`محصول «${created.name||form.name}» با موفقیت ثبت شد${form.sku.trim()?"":` · SKU خودکار: ${sku}`}`)
  }catch(e){const text=e instanceof Error?e.message:"خطا در ثبت محصول";setErrors({submit:text});setMessage(text)}finally{setBusy(false)}
 }

 async function addVariant(){const p=products.find(x=>x.id===variantForm.productId);if(!p||!variantForm.sku.trim()||!variantForm.title.trim())return setMessage("محصول، عنوان تنوع و SKU الزامی است");setBusy(true);try{let imageUrl=variantForm.imageUrl||null;if(variantImage)imageUrl=await uploadAsset(variantImage,"variant",p.id);await read(await apiFetch(`/api/commerce/products/${p.id}/variants`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:variantForm.title,sku:variantForm.sku,priceMinor:variantForm.price?Math.round(Number(variantForm.price)*100):null,inventoryQuantity:Number(variantForm.inventory),imageUrl,options:{...(variantForm.color?{color:variantForm.color}:{}),...(variantForm.size?{size:variantForm.size}:{})}})}));setVariantForm(emptyVariant);setVariantImage(null);await refresh();setMessage("تنوع جدید اضافه شد")}catch(e){setMessage(e instanceof Error?e.message:"خطا")}finally{setBusy(false)}}

 // Order management (Gate 2 P0-2) -- connects the already-existing, already-tested
 // order endpoints; no new backend routes.
 async function updateOrderStatus(orderId:string,patch:{status?:string;fulfillmentStatus?:string}){
  setOrderBusy(true);setOrderMessage("");
  try{
   const d=await read(await apiFetch(`/api/commerce/orders/${orderId}/status`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(patch)}));
   const updated=d.order as Order;
   setOrders(current=>current.map(o=>o.id===updated.id?updated:o));
   setOrderMessage("وضعیت سفارش به‌روزرسانی شد.");
  }catch(e){setOrderMessage(e instanceof Error?e.message:"خطا در به‌روزرسانی وضعیت سفارش")}
  finally{setOrderBusy(false)}
 }

 // Payment settings (Gate 2 P1) -- connects the existing, already-live
 // configurePaymentProvider endpoint. There is no GET endpoint to read back a
 // previously configured provider (none exists in the audited API surface, and
 // adding one is out of this task's scope), so only the just-saved result can be
 // shown; a page reload will not show prior configuration.
 async function configureProvider(){
  if(!project)return;
  const key=providerKeyInput.trim();
  if(!key){setPaymentMessage("کلید درگاه پرداخت را وارد کن.");return}
  setPaymentBusy(true);setPaymentMessage("");
  try{
   const d=await read(await apiFetch(`/api/stores/${project.id}/payment-providers/${encodeURIComponent(key)}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({credentialReference:credentialReferenceInput.trim()||null})}));
   const provider=d.provider as PaymentProviderConfig;
   setLastConfiguredProvider(provider);
   setPaymentMessage(`درگاه «${provider.providerKey}» ذخیره شد؛ وضعیت: ${provider.status}.`);
  }catch(e){setPaymentMessage(e instanceof Error?e.message:"خطا در ذخیره تنظیمات پرداخت")}
  finally{setPaymentBusy(false)}
 }

 const stock=useMemo(()=>products.reduce((n,p)=>n+(p.variants||[]).reduce((x,v)=>x+v.inventoryQuantity,0),0),[products]);
 const filtered=useMemo(()=>{const q=query.trim().toLowerCase();return !q?products:products.filter(p=>`${p.name} ${p.brand||""} ${p.category||""} ${(p.variants||[]).map(v=>v.sku).join(" ")}`.toLowerCase().includes(q))},[products,query]);

 return <main dir="rtl" className="min-h-screen bg-[#090d17] p-4 text-white md:p-8"><div className="mx-auto max-w-7xl"><header className="mb-7 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><Link to="/dashboard/websites/admin" className="rounded-xl border border-white/10 p-2 text-white/60"><ArrowRight/></Link><div><h1 className="text-2xl font-black">محصولات فروشگاه</h1><p className="text-sm text-white/40">Catalog V21 · آپلود مستقیم Media Storage، تنوع، فیلتر و SEO</p></div></div><div className="flex gap-2"><Link to="/dashboard/websites/commerce/operations" className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold">مدیریت پیشرفته</Link><Link to="/dashboard/websites" className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold">Visual Studio</Link></div></header>
 <div className="mb-5 flex gap-2">{([["products","محصولات"],["orders","سفارش‌ها"],["payments","تنظیمات پرداخت"]] as const).map(([key,label])=><button key={key} type="button" onClick={()=>setView(key)} className={`rounded-xl px-4 py-2 text-sm font-bold ${view===key?"bg-violet-600 text-white":"border border-white/10 text-white/60"}`}>{label}</button>)}</div>
 <section className="mb-7 grid gap-3 md:grid-cols-3"><Stat icon={<Cube/>} title="محصولات" value={String(products.length)}/><Stat icon={<Package/>} title="موجودی کل" value={String(stock)}/><Stat icon={<ShoppingCartSimple/>} title="سفارش‌ها" value={String(orders.length)}/></section>{message&&<div className={`mb-5 rounded-xl border p-3 text-sm ${errors.submit?"border-rose-500/30 bg-rose-500/10 text-rose-200":"border-white/10 bg-white/5"}`}>{message}</div>}
 {view==="orders"&&<OrdersView orders={orders} selectedOrderId={selectedOrderId} onSelect={setSelectedOrderId} busy={orderBusy} message={orderMessage} onUpdateStatus={updateOrderStatus}/>}
 {view==="payments"&&<PaymentSettingsView providerKey={providerKeyInput} onProviderKey={setProviderKeyInput} credentialReference={credentialReferenceInput} onCredentialReference={setCredentialReferenceInput} busy={paymentBusy} message={paymentMessage} lastConfigured={lastConfiguredProvider} onSubmit={configureProvider}/>}
 {view==="products"&&<div className="grid gap-6 xl:grid-cols-[440px_1fr]"><section className="h-fit rounded-2xl border border-white/10 bg-[#0d1320] p-5"><div className="mb-4 flex items-center justify-between"><b className="flex items-center gap-2"><Plus/> ایجاد محصول</b><button onClick={()=>setAdvanced(v=>!v)} className="text-xs text-violet-300">{advanced?"فرم ساده":"SEO و پیشرفته"}</button></div><div className="space-y-3"><Input label="نام محصول" value={form.name} error={errors.name} onChange={v=>{setForm({...form,name:v});setErrors(e=>({...e,name:undefined}))}}/><label className="block text-xs text-white/45">توضیحات<textarea className="input mt-2 min-h-24" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><MediaPicker title="تصویر اصلی محصول" files={primary?[primary]:[]} single onPick={fs=>setPrimary(fs[0]||null)} onRemove={()=>setPrimary(null)}/><MediaPicker title="گالری محصول" files={gallery} onPick={fs=>setGallery(x=>[...x,...fs].slice(0,8))} onRemove={i=>setGallery(x=>x.filter((_,j)=>j!==i))}/><div className="grid grid-cols-2 gap-3"><Input label="قیمت" value={form.price} error={errors.price} placeholder="۰ برای محصول رایگان" onChange={v=>{setForm({...form,price:v});setErrors(e=>({...e,price:undefined}))}}/><Input label="قیمت خط‌خورده" value={form.compareAt} onChange={v=>setForm({...form,compareAt:v})}/><Input label="SKU (اختیاری)" value={form.sku} placeholder="اگر خالی باشد خودکار ساخته می‌شود" onChange={v=>setForm({...form,sku:v})}/><Input label="موجودی" value={form.inventory} error={errors.inventory} onChange={v=>{setForm({...form,inventory:v});setErrors(e=>({...e,inventory:undefined}))}}/><Input label="دسته‌بندی" value={form.category} onChange={v=>setForm({...form,category:v})}/><Input label="برند" value={form.brand} onChange={v=>setForm({...form,brand:v})}/></div><label className="flex items-center justify-between rounded-xl border border-white/10 p-3 text-xs"><span className="flex items-center gap-2"><Star/> محصول ویژه</span><input type="checkbox" checked={form.featured} onChange={e=>setForm({...form,featured:e.target.checked})}/></label>{advanced&&<div className="space-y-3 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3"><Input label="Slug" value={form.slug} onChange={v=>setForm({...form,slug:v})}/><Input label="عنوان SEO" value={form.seoTitle} onChange={v=>setForm({...form,seoTitle:v})}/><Input label="توضیحات SEO" value={form.seoDescription} onChange={v=>setForm({...form,seoDescription:v})}/></div>}<label className="block text-xs text-white/45">ارز<select className="input mt-2" value={form.currency} onChange={e=>setForm({...form,currency:e.target.value})}><option>IRT</option><option>IRR</option><option>USD</option><option>EUR</option><option>AED</option></select></label>{errors.submit&&<div className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-xs leading-6 text-rose-200">{errors.submit}</div>}<button disabled={busy} onClick={()=>void createProduct()} className="w-full rounded-xl bg-violet-600 p-3 text-sm font-black disabled:cursor-wait disabled:opacity-60">{busy?"در حال ثبت و آپلود تصاویر…":"ثبت محصول"}</button><p className="text-center text-[10px] leading-5 text-white/30">تصاویر مستقیماً در Media Storage ذخیره می‌شوند؛ SKU در صورت خالی بودن خودکار ساخته می‌شود.</p></div>
 <div className="mt-6 border-t border-white/10 pt-5"><b>تنوع رنگ / سایز</b><div className="mt-3 space-y-3"><label className="block text-xs text-white/45">محصول<select className="input mt-2" value={variantForm.productId} onChange={e=>setVariantForm({...variantForm,productId:e.target.value})}><option value="">انتخاب محصول</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><div className="grid grid-cols-2 gap-3"><Input label="عنوان تنوع" value={variantForm.title} onChange={v=>setVariantForm({...variantForm,title:v})}/><Input label="SKU" value={variantForm.sku} onChange={v=>setVariantForm({...variantForm,sku:v})}/><Input label="رنگ" value={variantForm.color} onChange={v=>setVariantForm({...variantForm,color:v})}/><Input label="سایز" value={variantForm.size} onChange={v=>setVariantForm({...variantForm,size:v})}/><Input label="قیمت اختصاصی" value={variantForm.price} onChange={v=>setVariantForm({...variantForm,price:v})}/><Input label="موجودی" value={variantForm.inventory} onChange={v=>setVariantForm({...variantForm,inventory:v})}/></div><MediaPicker title="تصویر این تنوع" files={variantImage?[variantImage]:[]} single onPick={fs=>setVariantImage(fs[0]||null)} onRemove={()=>setVariantImage(null)}/><button disabled={busy} onClick={()=>void addVariant()} className="w-full rounded-xl border border-violet-500/40 p-3 text-sm font-bold text-violet-200">افزودن Variant</button></div></div></section>
 <section className="rounded-2xl border border-white/10 bg-[#0d1320] p-5"><label className="relative mb-4 block"><MagnifyingGlass className="absolute right-3 top-3 text-white/30"/><input className="input pr-10" placeholder="جستجو نام، SKU، برند…" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="space-y-3">{filtered.length?filtered.map(p=>{const image=(Array.isArray(p.metadata?.gallery)?(p.metadata!.gallery as string[])[0]:undefined)||p.variants?.[0]?.imageUrl;return <article key={p.id} className="rounded-xl border border-white/10 bg-white/[.025] p-4"><div className="flex gap-4"><div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/5">{image?<img src={image} alt={p.name} className="h-full w-full object-cover"/>:<ImageSquare size={30} className="text-white/20"/>}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><b>{p.name}</b><p className="mt-1 text-xs text-white/35">{p.brand||"بدون برند"} · {p.category||"بدون دسته"}</p></div><b className="text-violet-300">{fmt(p.basePriceMinor,p.currency)}</b></div><div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/50"><span className="rounded bg-white/5 px-2 py-1">{p.status}</span><span className="rounded bg-white/5 px-2 py-1">{p.variants?.length||0} تنوع</span><span className="rounded bg-white/5 px-2 py-1">موجودی {(p.variants||[]).reduce((n,v)=>n+v.inventoryQuantity,0)}</span></div><div className="mt-3 flex gap-2"><Link to={`/dashboard/websites/commerce/product/${p.id}`} className="rounded-lg border border-white/10 px-3 py-2 text-xs">صفحه محصول</Link><Link to="/dashboard/websites/commerce/operations" className="rounded-lg border border-white/10 px-3 py-2 text-xs">ویرایش کامل</Link></div></div></div></article>}):<div className="grid min-h-72 place-items-center rounded-xl border border-dashed border-white/10 text-sm text-white/35">هنوز محصولی نداریم؛ اولین محصول را از فرم کناری بساز.</div>}</div></section></div>}</div></main>
}

function MediaPicker({title,files,single,onPick,onRemove}:{title:string;files:File[];single?:boolean;onPick:(f:File[])=>void;onRemove:(i:number)=>void}){return <div className="rounded-2xl border border-dashed border-white/15 bg-white/[.025] p-3"><div className="flex items-center justify-between gap-3"><div><b className="text-xs">{title}</b><p className="mt-1 text-[10px] text-white/35">JPG / PNG / WEBP / GIF / SVG · حداکثر ۲۵MB</p></div><label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold"><UploadSimple/>آپلود عکس<input hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml" multiple={!single} onChange={e=>{onPick(Array.from(e.target.files||[]));e.currentTarget.value=""}}/></label></div>{files.length>0&&<div className="mt-3 grid grid-cols-4 gap-2">{files.map((f,i)=><div key={`${f.name}-${i}`} className="relative aspect-square overflow-hidden rounded-xl bg-white/5"><img src={URL.createObjectURL(f)} alt={f.name} className="h-full w-full object-cover"/><button type="button" onClick={()=>onRemove(i)} className="absolute left-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/70"><X size={12}/></button></div>)}</div>}</div>}
function Input({label,value,onChange,error,placeholder}:{label:string;value:string;onChange:(v:string)=>void;error?:string;placeholder?:string}){return <label className={`block text-xs ${error?"text-rose-300":"text-white/45"}`}>{label}<input className={`input mt-2 ${error?"border-rose-500/50":""}`} value={value} placeholder={placeholder} onChange={e=>onChange(e.target.value)}/>{error&&<span className="mt-1 block text-[10px] text-rose-300">{error}</span>}</label>}
function Stat({icon,title,value}:{icon:React.ReactNode;title:string;value:string}){return <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#0d1320] p-5"><div><div className="text-xs text-white/40">{title}</div><b className="mt-1 block text-2xl">{value}</b></div><div className="rounded-xl bg-violet-500/15 p-3 text-violet-300">{icon}</div></div>}

function OrdersView({orders,selectedOrderId,onSelect,busy,message,onUpdateStatus}:{orders:Order[];selectedOrderId:string|null;onSelect:(id:string|null)=>void;busy:boolean;message:string;onUpdateStatus:(id:string,patch:{status?:string;fulfillmentStatus?:string})=>void}){
 return <section className="rounded-2xl border border-white/10 bg-[#0d1320] p-5">
  <div className="mb-4 flex items-center justify-between"><b>سفارش‌های فروشگاه</b><span className="text-xs text-white/35">{orders.length} سفارش</span></div>
  {message&&<div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">{message}</div>}
  {orders.length?<div className="space-y-2">{orders.map(o=><div key={o.id} className="rounded-xl border border-white/10 bg-white/[.025] p-4">
    <button type="button" onClick={()=>onSelect(selectedOrderId===o.id?null:o.id)} className="flex w-full flex-wrap items-center justify-between gap-2 text-right">
     <div><b className="text-sm">سفارش #{o.id.slice(-8)}</b><p className="mt-1 text-xs text-white/35">{o.email||"بدون ایمیل"} · {new Date(o.createdAt).toLocaleDateString("fa-IR")}</p></div>
     <div className="flex items-center gap-2 text-[11px]"><span className="rounded bg-white/5 px-2 py-1">{ORDER_STATUS_LABELS[o.status]||o.status}</span><span className="rounded bg-white/5 px-2 py-1">{PAYMENT_STATUS_LABELS[o.paymentStatus]||o.paymentStatus}</span><span className="rounded bg-white/5 px-2 py-1">{FULFILLMENT_STATUS_LABELS[o.fulfillmentStatus]||o.fulfillmentStatus}</span><b className="text-violet-300">{fmt(o.totalMinor,o.currency)}</b></div>
    </button>
    {selectedOrderId===o.id&&<div className="mt-4 border-t border-white/10 pt-4">
      <div className="grid gap-3 md:grid-cols-2">
       <div className="rounded-xl border border-white/10 bg-white/[.025] p-3"><b className="text-xs">اقلام سفارش</b><div className="mt-2 space-y-2 text-xs text-white/60">{o.items.map(item=><div key={item.id} className="flex justify-between gap-2"><span>{item.productName} × {item.quantity}</span><span>{fmt(item.lineTotalMinor,o.currency)}</span></div>)}</div></div>
       <div className="rounded-xl border border-white/10 bg-white/[.025] p-3"><b className="text-xs">آدرس ارسال</b><p className="mt-2 text-xs leading-6 text-white/60">{o.shippingAddress?.fullName||"—"} · {o.shippingAddress?.phone||"—"}<br/>{[o.shippingAddress?.province,o.shippingAddress?.city,o.shippingAddress?.address].filter(Boolean).join("، ")||"آدرسی ثبت نشده"}</p></div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
       <label className="block text-xs text-white/45">وضعیت سفارش<select disabled={busy} className="input mt-2" value={o.status} onChange={e=>onUpdateStatus(o.id,{status:e.target.value})}>{ORDER_STATUS_OPTIONS.map(s=><option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>)}</select></label>
       <label className="block text-xs text-white/45">وضعیت ارسال<select disabled={busy} className="input mt-2" value={o.fulfillmentStatus} onChange={e=>onUpdateStatus(o.id,{fulfillmentStatus:e.target.value})}>{FULFILLMENT_STATUS_OPTIONS.map(s=><option key={s} value={s}>{FULFILLMENT_STATUS_LABELS[s]}</option>)}</select></label>
      </div>
      <p className="mt-3 text-[10px] leading-5 text-white/30">وضعیت پرداخت و بازگشت وجه فقط از مسیر رسمی پرداخت/بازگشت تغییر می‌کند و از این‌جا قابل ویرایش نیست.</p>
    </div>}
   </div>)}</div>:<div className="grid min-h-72 place-items-center rounded-xl border border-dashed border-white/10 text-sm text-white/35">هنوز سفارشی ثبت نشده است.</div>}
 </section>;
}

function PaymentSettingsView({providerKey,onProviderKey,credentialReference,onCredentialReference,busy,message,lastConfigured,onSubmit}:{providerKey:string;onProviderKey:(v:string)=>void;credentialReference:string;onCredentialReference:(v:string)=>void;busy:boolean;message:string;lastConfigured:PaymentProviderConfig|null;onSubmit:()=>void}){
 return <section className="max-w-xl rounded-2xl border border-white/10 bg-[#0d1320] p-5">
  <b>تنظیمات درگاه پرداخت</b>
  <p className="mt-1 text-xs leading-6 text-white/40">این بخش فقط پیکربندی درگاه را ذخیره می‌کند؛ اتصال واقعی به درگاه پرداخت هنوز انجام نشده و پرداخت آنلاین در فروشگاه فعال نیست.</p>
  <div className="mt-4 space-y-3">
   <Input label="کلید درگاه (مثال: zarinpal)" value={providerKey} onChange={onProviderKey}/>
   <Input label="شناسه اعتبارنامه (اختیاری)" value={credentialReference} onChange={onCredentialReference} placeholder="مرجع اعتبارنامه ذخیره‌شده، نه خود کلید محرمانه"/>
   {message&&<div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs">{message}</div>}
   <button disabled={busy} onClick={onSubmit} className="w-full rounded-xl bg-violet-600 p-3 text-sm font-black disabled:cursor-wait disabled:opacity-60">{busy?"در حال ذخیره…":"ذخیره تنظیمات درگاه"}</button>
   {lastConfigured&&<p className="text-center text-[10px] text-white/30">آخرین ذخیره: {lastConfigured.providerKey} · وضعیت: {lastConfigured.status}</p>}
  </div>
 </section>;
}
