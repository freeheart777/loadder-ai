import { useState } from "react";
import { CheckCircle, DotsSixVertical, Headset, ImageSquare, MagnifyingGlass, Package, Plus, ShieldCheck, ShoppingCart, TextT, Truck, UserCircle } from "@phosphor-icons/react";
import { formatMoney, productView, productsForSection } from "./config";
import type { DeviceMode, ElementType, PageMode, Product, ProductSettings, SectionConfig, Selection, StudioConfig } from "./types";

type CanvasProps = {
  config: StudioConfig;
  products: Product[];
  device: DeviceMode;
  selected: Selection;
  select: (selection: Selection) => void;
  interactive?: boolean;
  onAddProduct?: (sectionId: string) => void;
  onReorderProduct?: (sectionId: string, fromId: string, toId: string) => void;
  onInsertSection?: (index: number, type: SectionConfig["type"]) => void;
  onReorderSection?: (fromId: string, toId: string) => void;
  runtimePage?: PageMode;
  onRuntimePage?: (page: PageMode) => void;
};

function EditorElement({ type, id, selected, onSelect, interactive = true, draggable = false, className = "", style, children, onDragStart, onDragOver, onDrop }: {
  type: ElementType; id: string | null; selected: Selection; onSelect: (selection: Selection) => void; interactive?: boolean; draggable?: boolean; className?: string; style?: React.CSSProperties; children: React.ReactNode; onDragStart?: React.DragEventHandler<HTMLDivElement>; onDragOver?: React.DragEventHandler<HTMLDivElement>; onDrop?: React.DragEventHandler<HTMLDivElement>;
}) {
  const active = interactive && selected.type === type && selected.id === id;
  return <div role={interactive ? "button" : undefined} tabIndex={interactive ? 0 : undefined} data-editor-element={interactive ? type : undefined} data-editor-selected={interactive ? (active ? "true" : "false") : undefined} draggable={interactive && draggable} className={`relative outline-none transition ${interactive ? "cursor-pointer" : ""} ${active ? "z-10 ring-[3px] ring-emerald-400 ring-offset-2 ring-offset-slate-100" : interactive ? "hover:ring-2 hover:ring-violet-400/50" : ""} ${className}`} style={style} onDragStart={interactive ? onDragStart : undefined} onDragOver={interactive ? onDragOver : undefined} onDrop={interactive ? onDrop : undefined} onClick={interactive ? (e) => { e.stopPropagation(); onSelect({ type, id }); } : undefined} onKeyDown={interactive ? (e) => { if (e.key === "Enter" || e.key === " ") onSelect({ type, id }); } : undefined}>
    {active && <span className="pointer-events-none absolute right-3 top-3 z-40 rounded-full bg-emerald-400 px-3 py-1 text-[10px] font-black text-slate-950 shadow-lg">ویرایش</span>}
    {children}
  </div>;
}

function InsertBetween({ index, onInsert }: { index: number; onInsert?: CanvasProps["onInsertSection"] }) {
  const [open, setOpen] = useState(false);
  const items: Array<[SectionConfig["type"], string, React.ReactNode]> = [["products", "محصولات", <Package />], ["banner", "بنر", <ImageSquare />], ["text", "متن", <TextT />], ["trust", "مزیت‌ها", <ShieldCheck />], ["spacer", "فاصله", <Plus />]];
  return <div className="group relative z-30 flex h-7 items-center justify-center" onClick={(e) => e.stopPropagation()}>
    <div className="absolute inset-x-8 top-1/2 border-t border-dashed border-violet-300/0 transition group-hover:border-violet-300/70" />
    <button type="button" aria-label="افزودن بخش" onClick={() => setOpen((v) => !v)} className="relative grid h-7 w-7 place-items-center rounded-full border border-violet-300 bg-white text-violet-600 opacity-0 shadow-lg transition hover:scale-110 group-hover:opacity-100"><Plus size={16} weight="bold" /></button>
    {open && <div className="absolute top-8 flex gap-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">{items.map(([type, label, icon]) => <button key={type} type="button" onClick={() => { onInsert?.(index, type); setOpen(false); }} className="flex min-w-20 flex-col items-center gap-1 rounded-xl px-3 py-2 text-[10px] font-bold text-slate-600 hover:bg-violet-50 hover:text-violet-700">{icon}<span>{label}</span></button>)}</div>}
  </div>;
}

function Header(props: CanvasProps) {
  const { config, device, selected, select, interactive = true, onRuntimePage } = props;
  const mobile = device === "mobile";
  return <EditorElement type="header" id="header" selected={selected} onSelect={select} interactive={interactive} className={config.header.sticky ? "sticky top-0 z-20" : ""} style={{ background: config.header.backgroundColor, color: config.header.textColor }}>
    <div className="bg-slate-950 px-4 py-2 text-center text-[10px] font-bold text-white/75">ارسال سریع · پشتیبانی خرید · تجربه امن</div>
    <div className="mx-auto flex min-h-20 items-center gap-3 px-5" style={{ maxWidth: config.design.containerWidth }}>
      <div className="flex items-center gap-3">{config.header.logoUrl ? <img src={config.header.logoUrl} alt="لوگو" className="h-11 w-11 rounded-xl object-cover" /> : <div className="grid h-11 w-11 place-items-center rounded-xl bg-slate-900 font-black text-white">L</div>}<div><b className="block">{config.header.storeName}</b><span className="text-[10px] text-slate-400">فروشگاه آنلاین</span></div></div>
      {config.header.showSearch && !mobile && <label className="mx-auto flex min-h-11 max-w-xl flex-1 items-center gap-2 rounded-2xl bg-slate-100 px-4 text-xs text-slate-400"><MagnifyingGlass size={18}/><input className="w-full bg-transparent text-slate-700 outline-none" placeholder="جستجو در محصولات" /></label>}
      <div className="mr-auto flex items-center gap-1">{config.header.showAccount && <span className="grid h-11 w-11 place-items-center"><UserCircle size={24}/></span>}{config.header.showCart && <button type="button" onClick={!interactive ? () => onRuntimePage?.("cart") : undefined} className="relative grid h-11 w-11 place-items-center"><ShoppingCart size={23}/><span className="absolute right-0 top-0 rounded-full bg-violet-600 px-1.5 text-[9px] text-white">۱</span></button>}</div>
    </div>
    {!mobile && <nav className="mx-auto flex min-h-11 items-center gap-6 border-t border-slate-100 px-5 text-xs font-bold text-slate-600" style={{ maxWidth: config.design.containerWidth }}><span>فروشگاه</span><span>جدیدترین‌ها</span><span>پرفروش‌ها</span><span>تخفیف‌ها</span><span className="mr-auto" style={{ color: config.design.primaryColor }}>پیشنهاد ویژه</span></nav>}
  </EditorElement>;
}

function Hero(props: CanvasProps) {
  const { config, device, selected, select, interactive = true } = props;
  if (!config.hero.enabled) return null;
  const mobile = device === "mobile";
  return <EditorElement type="hero" id="hero" selected={selected} onSelect={select} interactive={interactive} className="overflow-hidden" style={{ background: config.hero.backgroundColor, color: config.hero.textColor }}>
    <div className={`mx-auto grid ${mobile ? "grid-cols-1" : "grid-cols-[1.05fr_.95fr]"}`} style={{ maxWidth: config.design.containerWidth, minHeight: mobile ? 420 : Math.max(380, config.hero.height) }}>
      <div className="flex items-center p-8 sm:p-12"><div className="max-w-xl" style={{ textAlign: config.hero.alignment }}><span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-black">{config.hero.eyebrow}</span><h2 className="mt-5 font-black leading-[1.15]" style={{ fontSize: mobile ? 36 : 54 * config.design.headingScale / 100 }}>{config.hero.title}</h2><p className="mt-5 text-sm leading-8 opacity-75">{config.hero.subtitle}</p><a href={config.hero.ctaHref || "#products"} onClick={interactive ? (e) => e.preventDefault() : undefined} className="mt-7 inline-flex min-h-12 items-center px-7 text-sm font-black text-white" style={{ background: config.design.primaryColor, borderRadius: config.design.buttonRadius }}>{config.hero.ctaLabel}</a></div></div>
      <div className="min-h-72 bg-slate-100">{config.hero.imageUrl ? <img src={config.hero.imageUrl} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full min-h-80 place-items-center text-center text-slate-400"><div><ImageSquare size={62} className="mx-auto"/><b className="mt-3 block">برای تغییر تصویر کلیک کنید</b><span className="text-xs">Media Library</span></div></div>}</div>
    </div>
  </EditorElement>;
}

function TrustStrip({ config }: { config: StudioConfig }) { const items = [[Truck,"ارسال سریع"],[ShieldCheck,"پرداخت امن"],[CheckCircle,"ضمانت خرید"],[Headset,"پشتیبانی"]] as const; return <div className="border-y border-slate-100 bg-white"><div className="mx-auto grid grid-cols-2 gap-3 px-5 py-5 md:grid-cols-4" style={{ maxWidth: config.design.containerWidth }}>{items.map(([Icon,label]) => <div key={label} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3"><span style={{color:config.design.primaryColor}}><Icon size={22}/></span><b className="text-xs text-slate-800">{label}</b></div>)}</div></div>; }

function ProductCard({ product, settings, config, selected, select, sectionId, interactive, onReorderProduct, onRuntimePage }: { product: Product; settings: ProductSettings; config: StudioConfig; selected: Selection; select: CanvasProps["select"]; sectionId: string; interactive: boolean; onReorderProduct?: CanvasProps["onReorderProduct"]; onRuntimePage?: CanvasProps["onRuntimePage"] }) {
  const view = productView(product, config); const inventory = (product.variants || []).reduce((s,v)=>s+Number(v.inventoryQuantity||0),0);
  return <EditorElement type="product-card" id={product.id} selected={selected} onSelect={select} interactive={interactive} draggable className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm" onDragStart={(e)=>{e.dataTransfer.setData("text/loadder-product-id",product.id);}} onDragOver={(e)=>e.preventDefault()} onDrop={(e)=>{e.preventDefault();e.stopPropagation();const from=e.dataTransfer.getData("text/loadder-product-id");if(from)onReorderProduct?.(sectionId,from,product.id);}}>
    {interactive && <span className="absolute left-2 top-2 z-20 grid h-8 w-8 place-items-center rounded-xl bg-slate-950/70 text-white"><DotsSixVertical/></span>}
    <div className="aspect-square bg-slate-50">{view.imageUrl ? <img src={view.imageUrl} alt={view.title} className="h-full w-full object-contain p-3"/> : <div className="grid h-full place-items-center text-slate-300"><Package size={48}/></div>}</div>
    <div className="p-4"><span className="text-[10px] text-slate-400">{product.brand || product.category || "محصول"}</span><b className="mt-1 block text-sm text-slate-900">{view.title}</b>{settings.showStock && <span className="mt-2 block text-[10px] text-emerald-600">{inventory>0?`${inventory} عدد موجود`:"ناموجود"}</span>}<div className="mt-4 flex items-center justify-between gap-2"><strong className="text-sm" style={{color:config.design.primaryColor}}>{formatMoney(view.regularPriceMinor,product.currency)}</strong></div>{settings.showCartButton && <button type="button" onClick={!interactive?()=>onRuntimePage?.("cart"):undefined} className="mt-3 min-h-11 w-full text-xs font-black text-white" style={{background:config.design.primaryColor,borderRadius:config.design.buttonRadius}}>{view.ctaLabel || config.commerce.cartButtonLabel}</button>}</div>
  </EditorElement>;
}

function SectionShell({ section, index, props, children }: { section: SectionConfig; index: number; props: CanvasProps; children: React.ReactNode }) {
  const type: ElementType = section.type === "banner" ? "banner" : section.type === "trust" ? "trust" : "section";
  return <><InsertBetween index={index} onInsert={props.interactive === false ? undefined : props.onInsertSection}/><EditorElement type={type} id={section.id} selected={props.selected} onSelect={props.select} interactive={props.interactive !== false} draggable className="group/section" onDragStart={(e)=>{e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/loadder-section-id",section.id);}} onDragOver={(e)=>{if(e.dataTransfer.types.includes("text/loadder-section-id")){e.preventDefault();e.dataTransfer.dropEffect="move";}}} onDrop={(e)=>{const from=e.dataTransfer.getData("text/loadder-section-id");if(from){e.preventDefault();e.stopPropagation();props.onReorderSection?.(from,section.id);}}}>
    {props.interactive !== false && <div className="pointer-events-none absolute left-3 top-3 z-30 flex items-center gap-1 rounded-xl bg-slate-950/80 px-2 py-1 text-[9px] font-bold text-white opacity-0 transition group-hover/section:opacity-100"><DotsSixVertical/> برای جابه‌جایی بکشید</div>}
    {children}
  </EditorElement></>;
}

function StorefrontCanvas(props: CanvasProps) {
  const visible = props.config.sections.filter(s=>s.enabled);
  return <div className="min-h-full bg-slate-50" style={{color:props.config.design.textColor}}><Header {...props}/><Hero {...props}/><TrustStrip config={props.config}/>{visible.map((section,index)=>{
    if(section.type==="spacer") return <SectionShell key={section.id} section={section} index={index} props={props}><div style={{height:section.spacingTop+section.spacingBottom}}/></SectionShell>;
    if(section.type==="products") { const settings=section.productSettings!; const source=productsForSection(props.products,settings); const shown=(source.length?source:settings.source==="manual"?[]:props.products).slice(0,12); const columns=props.device==="mobile"?settings.columnsMobile:props.device==="tablet"?settings.columnsTablet:settings.columnsDesktop; return <SectionShell key={section.id} section={section} index={index} props={props}><section id="products" className="mx-auto px-5 py-10" style={{maxWidth:props.config.design.containerWidth}}><div className="mb-6"><span className="text-[10px] font-black" style={{color:props.config.design.primaryColor}}>منتخب فروشگاه</span><h3 className="mt-2 text-2xl font-black text-slate-900">{section.title}</h3><p className="mt-2 text-xs text-slate-400">{section.subtitle}</p></div><div className="grid gap-4" style={{gridTemplateColumns:`repeat(${columns},minmax(0,1fr))`}}>{shown.map(p=><ProductCard key={p.id} product={p} settings={settings} config={props.config} selected={props.selected} select={props.select} sectionId={section.id} interactive={props.interactive!==false} onReorderProduct={props.onReorderProduct} onRuntimePage={props.onRuntimePage}/>)}{props.interactive!==false && <button type="button" onClick={(e)=>{e.stopPropagation();props.onAddProduct?.(section.id);}} className="grid min-h-64 place-items-center rounded-3xl border-2 border-dashed border-violet-300 bg-violet-50 text-violet-700"><span><Plus size={32} className="mx-auto"/><b className="mt-2 block">افزودن محصول</b><small>از کاتالوگ</small></span></button>}</div></section></SectionShell>; }
    if(section.type==="banner") return <SectionShell key={section.id} section={section} index={index} props={props}><section className="mx-auto px-5 py-8" style={{maxWidth:props.config.design.containerWidth}}><div className="grid overflow-hidden rounded-[28px] md:grid-cols-2" style={{background:section.backgroundColor,color:section.textColor}}><div className="p-8"><h3 className="text-2xl font-black">{section.title}</h3><p className="mt-3 text-sm opacity-70">{section.subtitle}</p></div><div className="min-h-48 bg-white/10">{section.imageUrl?<img src={section.imageUrl} alt="" className="h-full w-full object-cover"/>:<div className="grid h-full place-items-center text-sm opacity-50">برای انتخاب تصویر کلیک کنید</div>}</div></div></section></SectionShell>;
    return <SectionShell key={section.id} section={section} index={index} props={props}><section className="mx-auto px-5 py-8" style={{maxWidth:props.config.design.containerWidth}}><div className="rounded-[28px] border bg-white p-7"><h3 className="text-xl font-black text-slate-900">{section.title}</h3><p className="mt-3 text-sm text-slate-500">{section.subtitle}</p></div></section></SectionShell>;
  })}<InsertBetween index={visible.length} onInsert={props.interactive===false?undefined:props.onInsertSection}/><footer className="mt-8 bg-slate-950 text-white"><div className="mx-auto grid gap-8 px-5 py-10 md:grid-cols-3" style={{maxWidth:props.config.design.containerWidth}}><div><b>{props.config.header.storeName}</b><p className="mt-3 text-xs text-white/45">خرید ساده، سریع و مطمئن.</p></div><div><b>راهنمای خرید</b><p className="mt-3 text-xs text-white/45">ارسال · بازگشت · سوالات متداول</p></div><div><b>پشتیبانی</b><p className="mt-3 text-xs text-white/45">پیگیری سفارش · تماس</p></div></div></footer></div>;
}

function CartCanvas(props: CanvasProps) { const item=props.products[0]; const view=item?productView(item,props.config):null; return <div className="min-h-[650px] bg-slate-50 p-8 text-slate-900"><div className="mx-auto max-w-4xl"><h2 className="text-2xl font-black">سبد خرید</h2>{item&&view?<div className="mt-6 flex items-center gap-4 rounded-3xl border bg-white p-5">{view.imageUrl&&<img src={view.imageUrl} className="h-24 w-24 object-contain"/>}<div className="flex-1"><b>{view.title}</b><p className="mt-2 text-sm text-slate-400">تعداد: ۱</p></div><strong>{formatMoney(view.regularPriceMinor,item.currency)}</strong></div>:<p className="mt-8 text-slate-400">سبد خالی است.</p>}<button onClick={()=>props.onRuntimePage?.("checkout")} className="mt-6 rounded-xl bg-violet-600 px-6 py-3 text-sm font-black text-white">ادامه و تسویه</button></div></div>; }
function CheckoutCanvas(props: CanvasProps) { return <div className="min-h-[650px] bg-slate-50 p-8 text-slate-900"><div className="mx-auto max-w-xl rounded-3xl border bg-white p-7"><h2 className="text-2xl font-black">تسویه حساب</h2><input className="mt-6 min-h-12 w-full rounded-xl border px-4" placeholder="نام و نام خانوادگی"/><input className="mt-3 min-h-12 w-full rounded-xl border px-4" placeholder="شماره تماس"/><button onClick={()=>props.onRuntimePage?.("success")} className="mt-5 w-full rounded-xl bg-violet-600 py-3 font-black text-white">ثبت سفارش آزمایشی</button></div></div>; }
function SuccessCanvas(props: CanvasProps) { return <div className="grid min-h-[650px] place-items-center bg-slate-50 p-8 text-center text-slate-900"><div><CheckCircle size={64} className="mx-auto text-emerald-500"/><h2 className="mt-4 text-2xl font-black">{props.config.commerce.orderSuccessTitle}</h2><button onClick={()=>props.onRuntimePage?.("storefront")} className="mt-6 rounded-xl border bg-white px-5 py-3 font-bold">بازگشت به فروشگاه</button></div></div>; }

export default function StudioCanvas(props: CanvasProps) {
  const [runtimePage,setRuntimePage]=useState<PageMode>(props.runtimePage || props.config.activePage);
  const page=props.interactive===false?runtimePage:props.config.activePage;
  const navigate=(next:PageMode)=>{setRuntimePage(next);props.onRuntimePage?.(next);};
  const effective={...props,onRuntimePage:navigate};
  return <div data-canvas-interactive={props.interactive === false ? "false" : "true"} data-preview-device={props.device} className="mx-auto overflow-hidden bg-white shadow-2xl" style={{width:props.device==="desktop"?"100%":props.device==="tablet"?"768px":"390px",maxWidth:"100%"}}>{page==="storefront"?<StorefrontCanvas {...effective}/>:page==="cart"?<CartCanvas {...effective}/>:page==="checkout"?<CheckoutCanvas {...effective}/>:<SuccessCanvas {...effective}/>}</div>;
}
