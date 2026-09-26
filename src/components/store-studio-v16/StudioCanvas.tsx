import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Bank, Briefcase, Buildings, Certificate, ChatCircleText, CheckCircle, Clock, CopySimple, DotsSixVertical, FileText, Gavel, Handshake, Headset, Heart, HouseLine, ImageSquare, Lightning, MagnifyingGlass, Medal, Package, PencilSimple, Plus, Scales, ShieldCheck, ShoppingBag, ShoppingCart, SlidersHorizontal, Star, TextT, Trash, Trophy, Truck, UserCircle, Users } from "@phosphor-icons/react";
import { defaultProductSettings, formatMoney, productView, productsForSection } from "./config";
import { isCommerceSite, sectionAnchor, siteTypeDefinition } from "./site-types";
import { navigationPages } from "./pages";
import type { DeviceMode, ElementType, PageMode, Product, ProductSettings, SectionConfig, SectionItem, Selection, StudioConfig } from "./types";
import type { SectionItemIcon } from "./item-icons";

export type InlineMediaTarget = { kind: "hero" | "banner" | "logo" | "product"; id?: string };
export type RuntimeCartItem = { id: string; productName: string; variantTitle?: string; quantity: number; unitPriceMinor: number; lineTotalMinor: number };
export type RuntimeCart = { currency: string; items: RuntimeCartItem[]; subtotalMinor: number; discountMinor: number; shippingMinor: number; totalMinor: number };
export type CheckoutInput = { fullName: string; phone: string; email?: string; shippingAddress?: { province?: string; city?: string; address?: string; postalCode?: string; notes?: string } };
export type StorefrontRuntimeAdapter = { openStorefront: () => void; openCollection: () => void; openProduct: (product: Product) => void; openCart: () => void; addProduct: (product: Product) => void | Promise<void>; cartCount?: number; cart?: RuntimeCart | null; checkout?: (input: CheckoutInput) => Promise<{ orderId: string; totalMinor: number; currency: string }> };
type CanvasProps = { config: StudioConfig; products: Product[]; device: DeviceMode; selected: Selection; select: (selection: Selection) => void; onEditElement?: (selection: Selection) => void; interactive?: boolean; onAddProduct?: (sectionId: string) => void; onReorderProduct?: (sectionId: string, fromId: string, toId: string) => void; onInsertSection?: (index: number, type: SectionConfig["type"]) => void; onReorderSection?: (fromId: string, toId: string) => void; onMoveSection?: (id: string, delta: number) => void; onDuplicateSection?: (id: string) => void; onDeleteSection?: (id: string) => void; onImageUpload?: (target: InlineMediaTarget, file: File) => void | Promise<void>; imageBusy?: boolean; runtimePage?: PageMode; onRuntimePage?: (page: PageMode) => void; runtimeAdapter?: StorefrontRuntimeAdapter; onLeadSubmit?: (input: { name: string; phone: string; email: string; company: string; message: string }) => Promise<void>; pageBasePath?: string; };

function InlineMediaControl({ target, onUpload, busy, label = "تغییر تصویر", compact = false }: { target: InlineMediaTarget; onUpload?: CanvasProps["onImageUpload"]; busy?: boolean; label?: string; compact?: boolean }) {
  if (!onUpload) return null;
  return <label data-inline-media-control="true" onClick={(e)=>e.stopPropagation()} className="group/media absolute inset-0 z-40 cursor-pointer overflow-hidden rounded-[inherit]" title={label} aria-label={label}>
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-slate-950/0 transition-colors group-hover/media:bg-slate-950/15" />
    {!compact && <span className="pointer-events-none absolute bottom-3 left-3 translate-y-1 rounded-full border border-white/20 bg-slate-950/80 px-3 py-2 text-[10px] font-black text-white opacity-0 shadow-lg transition group-hover/media:translate-y-0 group-hover/media:opacity-100 group-focus-within/media:translate-y-0 group-focus-within/media:opacity-100">{busy ? "در حال بارگذاری…" : label}</span>}
    <input data-inline-media-input="true" type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e)=>{const file=e.target.files?.[0]; if(file) void onUpload(target,file); e.currentTarget.value="";}}/>
  </label>;
}

function editorLabel(type: ElementType) { if (type === "hero") return "بنر اصلی"; if (type === "header") return "هدر"; if (type === "product-card") return "محصول"; if (type === "banner") return "بنر"; if (type === "trust") return "مزیت‌ها"; return "بخش"; }

function EditorElement({ type, id, selected, onSelect, onEdit, interactive = true, draggable = false, className = "", style, children, onDragStart, onDragOver, onDrop, onMoveUp, onMoveDown, onDuplicate, onDelete }: { type: ElementType; id: string | null; selected: Selection; onSelect: (selection: Selection) => void; onEdit?: (selection: Selection) => void; interactive?: boolean; draggable?: boolean; className?: string; style?: React.CSSProperties; children: React.ReactNode; onDragStart?: React.DragEventHandler<HTMLDivElement>; onDragOver?: React.DragEventHandler<HTMLDivElement>; onDrop?: React.DragEventHandler<HTMLDivElement>; onMoveUp?: () => void; onMoveDown?: () => void; onDuplicate?: () => void; onDelete?: () => void; }) {
  const active = interactive && selected.type === type && selected.id === id; const selection = { type, id } as Selection; const action = (fn?: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn?.(); };
  return <div role={interactive ? "button" : undefined} tabIndex={interactive ? 0 : undefined} data-editor-element={interactive ? type : undefined} data-editor-selected={interactive ? (active ? "true" : "false") : undefined} draggable={interactive && draggable} className={`relative outline-none transition ${interactive ? "cursor-pointer border border-transparent" : ""} ${active ? "z-10 border-emerald-400 ring-[3px] ring-emerald-400/80 ring-offset-2 ring-offset-slate-100 shadow-[0_0_0_6px_rgba(16,185,129,.12)]" : interactive ? "hover:border-violet-300/70 hover:ring-2 hover:ring-violet-400/40" : ""} ${className}`} style={style} onDragStart={interactive ? onDragStart : undefined} onDragOver={interactive ? onDragOver : undefined} onDrop={interactive ? onDrop : undefined} onClick={interactive ? (e) => { e.stopPropagation(); onSelect(selection); } : undefined} onKeyDown={interactive ? (e) => { if (e.key === "Enter" || e.key === " ") onSelect(selection); } : undefined}>
    {active && <div className="absolute right-3 top-3 z-50 flex max-w-[calc(100%-24px)] flex-wrap items-center gap-1 rounded-2xl border border-slate-200 bg-white/95 p-1 text-slate-700 shadow-2xl backdrop-blur" onClick={(e) => e.stopPropagation()}><span className="px-2 text-[10px] font-black text-slate-400">{editorLabel(type)}</span><button type="button" onClick={action(() => (onEdit || onSelect)(selection))} className="flex min-h-8 items-center gap-1 rounded-xl bg-slate-950 px-2.5 text-[10px] font-black text-white"><PencilSimple size={13}/>ویرایش</button>{onMoveUp && <button type="button" title="بالاتر" onClick={action(onMoveUp)} className="grid h-8 w-8 place-items-center rounded-xl bg-slate-100"><ArrowUp size={13}/></button>}{onMoveDown && <button type="button" title="پایین‌تر" onClick={action(onMoveDown)} className="grid h-8 w-8 place-items-center rounded-xl bg-slate-100"><ArrowDown size={13}/></button>}{onDuplicate && <button type="button" title="کپی" onClick={action(onDuplicate)} className="grid h-8 w-8 place-items-center rounded-xl bg-violet-50 text-violet-700"><CopySimple size={13}/></button>}{onDelete && <button type="button" title="حذف" onClick={action(onDelete)} className="grid h-8 w-8 place-items-center rounded-xl bg-rose-50 text-rose-600"><Trash size={13}/></button>}{draggable && <span className="flex min-h-8 items-center gap-1 rounded-xl bg-slate-100 px-2 text-[10px] font-bold text-slate-500"><DotsSixVertical size={13}/> بکشید</span>}</div>}{children}
  </div>;
}

function Header(props: CanvasProps) { const { config, device, selected, select, interactive = true, onRuntimePage, runtimeAdapter } = props; const mobile = device === "mobile"; const openStorefront=()=>runtimeAdapter?.openStorefront() ?? onRuntimePage?.("storefront"); const openCollection=()=>runtimeAdapter?.openCollection() ?? onRuntimePage?.("collection"); const openCart=()=>runtimeAdapter?.openCart() ?? onRuntimePage?.("cart"); return <EditorElement type="header" id="header" selected={selected} onSelect={select} onEdit={props.onEditElement} interactive={interactive} className={config.header.sticky ? "sticky top-0 z-30" : ""} style={{ background: config.header.backgroundColor, color: config.header.textColor }}><div className="bg-slate-950 px-4 py-2 text-center text-[10px] font-bold text-white/75">ارسال سریع · ضمانت خرید · پشتیبانی واقعی</div><div className="mx-auto flex min-h-20 items-center gap-4 px-5" style={{ maxWidth: config.design.containerWidth }}><button type="button" onClick={!interactive ? openStorefront : undefined} className="flex items-center gap-3 text-right"><span className="relative block">{config.header.logoUrl ? <img src={config.header.logoUrl} alt="لوگو" className="h-11 w-11 rounded-xl object-cover" /> : <span className="grid h-11 w-11 place-items-center rounded-xl bg-slate-900 font-black text-white">L</span>}{interactive && <InlineMediaControl target={{kind:"logo"}} onUpload={props.onImageUpload} busy={props.imageBusy} label="لوگو" compact/>}</span><span><b className="block">{config.header.storeName}</b><span className="text-[10px] text-slate-400">فروشگاه آنلاین</span></span></button>{config.header.showSearch && !mobile && <label className="mx-auto flex min-h-11 max-w-xl flex-1 items-center gap-2 rounded-2xl bg-slate-100 px-4 text-xs text-slate-400"><MagnifyingGlass size={18}/><input className="w-full bg-transparent text-slate-700 outline-none" placeholder="جستجو بین محصولات..." /></label>}<div className="mr-auto flex items-center gap-1">{config.header.showAccount && <span className="grid h-11 w-11 place-items-center"><UserCircle size={24}/></span>}{config.header.showCart && <button type="button" onClick={!interactive ? openCart : undefined} className="relative grid h-11 w-11 place-items-center" aria-label="سبد خرید"><ShoppingCart size={23}/><span className="absolute right-0 top-0 rounded-full bg-violet-600 px-1.5 text-[9px] text-white">{new Intl.NumberFormat("fa-IR").format(runtimeAdapter?.cartCount ?? 1)}</span></button>}</div></div>{!mobile && <nav className="mx-auto flex min-h-11 items-center gap-6 border-t border-slate-100 px-5 text-xs font-bold text-slate-600" style={{ maxWidth: config.design.containerWidth }}><button type="button" onClick={!interactive ? openStorefront : undefined}>خانه</button><button type="button" onClick={!interactive ? openCollection : undefined}>همه محصولات</button><span>جدیدترین‌ها</span><span>پرفروش‌ها</span><span className="mr-auto" style={{ color: config.design.primaryColor }}>تخفیف‌های ویژه</span></nav>}</EditorElement>; }

function Hero(props: CanvasProps) {
  const { config, device, selected, select, interactive = true, onRuntimePage } = props;
  if (!config.hero.enabled) return null;
  const { hero } = config;
  const mobile = device === "mobile";
  const openCollection = () => props.runtimeAdapter?.openCollection() ?? onRuntimePage?.("collection");
  const height = mobile ? Math.max(400, Math.min(hero.height, 560)) : Math.max(280, hero.height);
  const copy = <div className={`relative z-10 ${hero.layout === "centered" ? "mx-auto max-w-3xl text-center" : "max-w-xl"}`} style={{ textAlign: hero.layout === "centered" ? "center" : hero.alignment }}>
    <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-black">{hero.eyebrow || "انتخاب امروز"}</span>
    <h2 className="mt-5 font-black leading-[1.1]" style={{ fontSize: mobile ? 36 : 52 * config.design.headingScale / 100 }}>{hero.title}</h2>
    <p className={`mt-5 text-sm leading-8 opacity-80 ${hero.layout === "centered" ? "mx-auto max-w-2xl" : "max-w-lg"}`}>{hero.subtitle}</p>
    <button type="button" onClick={!interactive ? openCollection : undefined} className="mt-7 inline-flex min-h-12 items-center gap-2 px-7 text-sm font-black text-white" style={{ background: config.design.primaryColor, borderRadius: config.design.buttonRadius }}>{hero.ctaLabel || "مشاهده محصولات"}<ArrowLeft size={16}/></button>
  </div>;
  const mediaControl = interactive && <InlineMediaControl target={{ kind: "hero" }} onUpload={props.onImageUpload} busy={props.imageBusy} label={hero.imageUrl ? "تعویض عکس" : "افزودن عکس"}/>;
  const imageFallback = <div className="grid h-full min-h-72 place-items-center bg-gradient-to-br from-slate-100 to-slate-200 text-center text-slate-400"><div><ShoppingBag size={66} className="mx-auto"/><b className="mt-3 block text-slate-600">تصویر کمپین شما</b><span className="text-xs">از + همین تصویر را اضافه کنید</span></div></div>;
  const imageStyle = hero.imageUrl ? { backgroundImage: `url(${hero.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined;

  return <EditorElement type="hero" id="hero" selected={selected} onSelect={select} onEdit={props.onEditElement} interactive={interactive} className="overflow-hidden" style={{ background: hero.backgroundColor, color: hero.textColor }}>
    <section data-hero-layout={hero.layout} className="relative" style={{ minHeight: height }}>
      {hero.layout === "split" && <div className={`mx-auto grid ${mobile ? "grid-cols-1" : "grid-cols-[1.05fr_.95fr]"}`} style={{ maxWidth: config.design.containerWidth, minHeight: height }}><div className="flex items-center p-8 sm:p-12">{copy}</div><div className="relative min-h-72 bg-slate-100">{hero.imageUrl ? <img src={hero.imageUrl} alt="" className="h-full w-full object-cover" /> : imageFallback}{mediaControl}</div></div>}
      {hero.layout === "background" && <div className="relative grid min-h-[inherit] place-items-center overflow-hidden bg-slate-950 px-6 py-12" style={imageStyle}><div data-hero-overlay className="absolute inset-0 bg-slate-950" style={{ opacity: hero.imageUrl ? hero.overlayOpacity / 100 : 0.18 }}/><div className="mx-auto w-full" style={{ maxWidth: config.design.containerWidth }}>{copy}</div>{mediaControl}</div>}
      {hero.layout === "centered" && <div className="relative grid min-h-[inherit] place-items-center overflow-hidden px-6 py-12" style={imageStyle}><div data-hero-overlay className="absolute inset-0" style={{ background: hero.imageUrl ? "#0f172a" : hero.backgroundColor, opacity: hero.imageUrl ? hero.overlayOpacity / 100 : 1 }}/>{copy}{mediaControl}</div>}
      {hero.layout === "minimal" && <div className="mx-auto flex min-h-[inherit] items-center px-6 py-10 sm:px-12" style={{ maxWidth: config.design.containerWidth }}>{copy}{mediaControl}</div>}
    </section>
  </EditorElement>;
}

function TrustStrip({ config }: { config: StudioConfig }) { const items = [[Truck,"ارسال سریع"],[ShieldCheck,"پرداخت امن"],[CheckCircle,"ضمانت خرید"],[Headset,"پشتیبانی"]] as const; return <div className="border-y border-slate-100 bg-white"><div className="mx-auto grid grid-cols-2 gap-3 px-5 py-5 md:grid-cols-4" style={{ maxWidth: config.design.containerWidth }}>{items.map(([Icon,label]) => <div key={label} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3"><span style={{color:config.design.primaryColor}}><Icon size={22}/></span><b className="text-xs text-slate-800">{label}</b></div>)}</div></div>; }

function ProductCard({ product, settings, config, selected, select, sectionId, interactive, onReorderProduct, onRuntimePage, onEditElement, onImageUpload, imageBusy, runtimeAdapter }: { product: Product; settings: ProductSettings; config: StudioConfig; selected: Selection; select: CanvasProps["select"]; sectionId: string; interactive: boolean; onReorderProduct?: CanvasProps["onReorderProduct"]; onRuntimePage?: CanvasProps["onRuntimePage"]; onEditElement?: CanvasProps["onEditElement"]; onImageUpload?: CanvasProps["onImageUpload"]; imageBusy?: boolean; runtimeAdapter?: StorefrontRuntimeAdapter }) { const view = productView(product, config); const inventory = (product.variants || []).reduce((s,v)=>s+Number(v.inventoryQuantity||0),0); const purchasable=(product.variants||[]).some(v=>v.purchasable ?? (v.inventoryPolicy!=="DENY"||v.inventoryQuantity>0)); const open=()=>runtimeAdapter?.openProduct(product) ?? (select({ type: "product-card", id: product.id }), onRuntimePage?.("product")); const add=()=>runtimeAdapter?.addProduct(product) ?? onRuntimePage?.("cart"); return <EditorElement type="product-card" id={product.id} selected={selected} onSelect={select} onEdit={onEditElement} interactive={interactive} draggable={interactive} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl" onDragStart={(e)=>{e.dataTransfer.setData("text/loadder-product-id",product.id);}} onDragOver={(e)=>e.preventDefault()} onDrop={(e)=>{e.preventDefault();e.stopPropagation();const from=e.dataTransfer.getData("text/loadder-product-id");if(from)onReorderProduct?.(sectionId,from,product.id);}}><button type="button" onClick={!interactive ? open : undefined} className="block w-full text-right"><div className="relative aspect-square bg-slate-50">{view.imageUrl ? <img src={view.imageUrl} alt={view.title} className="h-full w-full object-contain p-4 transition group-hover:scale-[1.03]"/> : <div className="grid h-full place-items-center text-slate-300"><Package size={52}/></div>}{view.promotionBadge && <span className="absolute right-3 top-3 rounded-full bg-rose-500 px-2.5 py-1 text-[10px] font-black text-white">{view.promotionBadgeText || "تخفیف"}</span>}<span className="absolute left-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white shadow"><Heart size={16}/></span>{interactive && <InlineMediaControl target={{kind:"product",id:product.id}} onUpload={onImageUpload} busy={imageBusy} label={view.imageUrl ? "تعویض عکس" : "افزودن عکس"} compact/>}</div><div className="p-4"><span className="text-[10px] text-slate-400">{product.brand || product.category || "محصول"}</span><b className="mt-1 block text-sm text-slate-900">{view.title}</b><div className="mt-2 flex gap-0.5 text-amber-400"><Star weight="fill"/><Star weight="fill"/><Star weight="fill"/><Star weight="fill"/><Star/></div>{settings.showStock && <span className={`mt-2 block text-[10px] ${purchasable?"text-emerald-600":"text-rose-500"}`}>{inventory>0?`${inventory} عدد موجود`:purchasable?"قابل سفارش":"ناموجود"}</span>}<div className="mt-4 flex items-center gap-2"><strong className="text-sm" style={{color:config.design.primaryColor}}>{formatMoney(view.regularPriceMinor,product.currency)}</strong>{settings.showCompareAt && view.compareAtPriceMinor && <del className="text-[10px] text-slate-400">{formatMoney(view.compareAtPriceMinor, product.currency)}</del>}</div></div></button>{settings.showCartButton && <button type="button" disabled={!purchasable} onClick={(e)=>{e.stopPropagation(); if(!interactive) void add();}} className="mx-4 mb-4 min-h-11 w-[calc(100%-32px)] text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-45" style={{background:config.design.primaryColor,borderRadius:config.design.buttonRadius}}>{purchasable?(view.ctaLabel || config.commerce.cartButtonLabel):"ناموجود"}</button>}</EditorElement>; }

function InsertBetween({ index, onInsert, siteKind }: { index: number; onInsert?: CanvasProps["onInsertSection"]; siteKind: StudioConfig["siteKind"] }) { const [open, setOpen] = useState(false); const items = insertableSections(siteKind); return <div className="group relative z-20 flex h-9 items-center justify-center" onClick={(e) => e.stopPropagation()}><div className="absolute inset-x-8 top-1/2 border-t border-dashed border-violet-300/30 transition group-hover:border-violet-400"/><button type="button" aria-label="افزودن بخش در اینجا" onClick={()=>setOpen(v=>!v)} className="relative flex h-7 items-center gap-1 rounded-full border border-violet-300 bg-white px-2 text-[10px] font-black text-violet-700 shadow-lg transition group-hover:scale-105"><Plus size={14}/><span className="hidden sm:inline">بخش</span></button>{open && <div className="absolute top-9 flex gap-1 rounded-2xl border bg-white p-2 shadow-2xl">{items.map(([type,label,icon])=><button key={type} type="button" onClick={()=>{onInsert?.(index,type);setOpen(false);}} className="flex min-w-20 flex-col items-center gap-1 rounded-xl px-3 py-2 text-[10px] font-bold text-slate-600 hover:bg-violet-50">{icon}<span>{label}</span></button>)}</div>}</div>; }

function SectionShell({ section, index, props, children }: { section: SectionConfig; index: number; props: CanvasProps; children: React.ReactNode }) { const type: ElementType = section.type === "banner" ? "banner" : section.type === "trust" ? "trust" : "section"; return <><InsertBetween index={index} onInsert={props.interactive === false ? undefined : props.onInsertSection} siteKind={props.config.siteKind}/><EditorElement type={type} id={section.id} selected={props.selected} onSelect={props.select} onEdit={props.onEditElement} interactive={props.interactive !== false} draggable className="group/section" onMoveUp={()=>props.onMoveSection?.(section.id,-1)} onMoveDown={()=>props.onMoveSection?.(section.id,1)} onDuplicate={()=>props.onDuplicateSection?.(section.id)} onDelete={()=>props.onDeleteSection?.(section.id)} onDragStart={(e)=>{e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/loadder-section-id",section.id);}} onDragOver={(e)=>{if(e.dataTransfer.types.includes("text/loadder-section-id")){e.preventDefault();e.dataTransfer.dropEffect="move";}}} onDrop={(e)=>{const from=e.dataTransfer.getData("text/loadder-section-id");if(from){e.preventDefault();e.stopPropagation();props.onReorderSection?.(from,section.id);}}}>{children}</EditorElement></>; }

/** A deterministic countdown to a fixed timestamp — no scheduling, no AI, just the current wall clock. */
function Countdown({ endsAt }: { endsAt: string }) {
  const target = useMemo(() => new Date(endsAt).getTime(), [endsAt]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!Number.isFinite(target)) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);
  if (!Number.isFinite(target)) return null;
  const remaining = Math.max(0, target - now);
  if (remaining <= 0) return <span className="rounded-full bg-slate-200 px-3 py-1 text-[11px] font-black text-slate-500">فروش ویژه به پایان رسید</span>;
  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return <span dir="ltr" className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-3 py-1 text-[11px] font-black text-white">{days > 0 ? `${days}d ` : ""}{pad(hours)}:{pad(minutes)}:{pad(seconds)}</span>;
}

/** A curated grid of image+title tiles — used by category-grid and brand, the same shape services/team/portfolio already use on the corporate side. */
function StoreItemGrid({ section, columns = 4 }: { section: SectionConfig; columns?: number }) {
  const items = section.items || [];
  return <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.max(1, Math.min(6, columns))},minmax(0,1fr))` }}>
    {items.map((item) => <a key={item.id} href={item.href || "#products"} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white text-center shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      <div className="aspect-square bg-slate-50">{item.imageUrl ? <img src={item.imageUrl} alt={item.title} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-[1.03]" /> : <div className="grid h-full place-items-center text-slate-300"><ImageSquare size={40} /></div>}</div>
      <div className="p-3"><b className="text-xs text-slate-900">{item.title}</b></div>
    </a>)}
  </div>;
}

function StorefrontCanvas(props: CanvasProps) { const visible = props.config.sections.filter(s=>s.enabled); const openCollection=()=>props.runtimeAdapter?.openCollection() ?? props.onRuntimePage?.("collection"); return <div className="min-h-full" style={{color:props.config.design.textColor,background:props.config.design.backgroundColor}}><Header {...props}/><Hero {...props}/><TrustStrip config={props.config}/>{visible.map((section,index)=>{ if(section.type==="spacer") return <SectionShell key={section.id} section={section} index={index} props={props}><div style={{height:section.spacingTop+section.spacingBottom}}/></SectionShell>; if(section.type==="products") { const settings=section.productSettings || defaultProductSettings; const source=productsForSection(props.products,settings); const visibleCap=Math.max(1,Math.min(12,Number(section.visibleProductCount)||12)); const shown=(source.length?source:settings.source==="manual"?[]:props.products).slice(0,visibleCap); const baseColumns=props.device==="mobile"?settings.columnsMobile:props.device==="tablet"?settings.columnsTablet:settings.columnsDesktop; const columns=section.productImageSize==="large"?Math.max(1,Math.min(baseColumns,props.device==="mobile"?1:2)):baseColumns; return <SectionShell key={section.id} section={section} index={index} props={props}><section id="products" className="mx-auto px-5 py-10" style={{maxWidth:props.config.design.containerWidth}}>{(section.saleLabel || section.saleEndsAt) && <div className="mb-3 flex flex-wrap items-center gap-2">{section.saleLabel && <b className="text-xs font-black text-rose-600">{section.saleLabel}</b>}{section.saleEndsAt && <Countdown endsAt={section.saleEndsAt}/>}</div>}<div className="mb-6 flex items-end justify-between gap-4"><div><span className="text-[10px] font-black" style={{color:props.config.design.primaryColor}}>منتخب فروشگاه</span><h3 className="mt-2 text-2xl font-black text-slate-900">{section.title}</h3><p className="mt-2 text-xs text-slate-400">{section.subtitle}</p></div>{props.interactive===false && <button type="button" onClick={openCollection} className="text-xs font-black" style={{color:props.config.design.primaryColor}}>مشاهده همه ←</button>}</div><div className="grid gap-4" style={{gridTemplateColumns:`repeat(${columns},minmax(0,1fr))`}}>{shown.map(p=><ProductCard key={p.id} product={p} settings={settings} config={props.config} selected={props.selected} select={props.select} sectionId={section.id} interactive={props.interactive!==false} onReorderProduct={props.onReorderProduct} onRuntimePage={props.onRuntimePage} onEditElement={props.onEditElement} onImageUpload={props.onImageUpload} imageBusy={props.imageBusy} runtimeAdapter={props.runtimeAdapter}/>)}{props.interactive!==false && <button type="button" onClick={(e)=>{e.stopPropagation();props.onAddProduct?.(section.id);}} className="grid min-h-64 place-items-center rounded-3xl border-2 border-dashed border-violet-300 bg-violet-50 text-violet-700"><span><Plus size={32} className="mx-auto"/><b className="mt-2 block">افزودن محصول</b><small>از کاتالوگ واقعی</small></span></button>}</div></section></SectionShell>; } if(section.type==="banner") return <SectionShell key={section.id} section={section} index={index} props={props}><section className="mx-auto px-5 py-8" style={{maxWidth:props.config.design.containerWidth}}><div className="grid overflow-hidden rounded-[28px] md:grid-cols-2" style={{background:section.backgroundColor,color:section.textColor}}><div className="p-8"><span className="text-[10px] font-black opacity-60">پیشنهاد فروشگاه</span><h3 className="mt-2 text-2xl font-black">{section.title}</h3><p className="mt-3 text-sm opacity-70">{section.subtitle}</p></div><div className="relative min-h-48 bg-white/10">{section.imageUrl?<img src={section.imageUrl} alt="" className="h-full w-full object-cover"/>:<div className="grid h-full place-items-center text-sm opacity-50">از + همین‌جا تصویر را اضافه کنید</div>}{props.interactive!==false && <InlineMediaControl target={{kind:"banner",id:section.id}} onUpload={props.onImageUpload} busy={props.imageBusy} label={section.imageUrl ? "تعویض بنر" : "افزودن بنر"}/>}</div></div></section></SectionShell>; if(section.type==="category-grid"||section.type==="brand") return <SectionShell key={section.id} section={section} index={index} props={props}><section id={sectionAnchor(section)} className="mx-auto px-5 py-10" style={{maxWidth:props.config.design.containerWidth}}><div className="mb-6"><h3 className="text-2xl font-black text-slate-900">{section.title}</h3><p className="mt-2 text-xs text-slate-400">{section.subtitle}</p></div><StoreItemGrid section={section} columns={section.type==="brand"?6:4}/></section></SectionShell>; return <SectionShell key={section.id} section={section} index={index} props={props}><section className="mx-auto px-5 py-8" style={{maxWidth:props.config.design.containerWidth}}><div className="rounded-[28px] border bg-white p-7"><h3 className="text-xl font-black text-slate-900">{section.title}</h3><p className="mt-3 text-sm text-slate-500">{section.subtitle}</p></div></section></SectionShell>; })}<InsertBetween index={visible.length} onInsert={props.interactive===false?undefined:props.onInsertSection} siteKind={props.config.siteKind}/><Footer config={props.config}/></div>; }

function CollectionCanvas(props: CanvasProps) { const settings: ProductSettings = { ...defaultProductSettings, columnsDesktop: 4, columnsTablet: 3, columnsMobile: 2, showCompareAt: true, showCartButton: true, showPromotionBadge: true }; return <div className="min-h-full bg-slate-50 text-slate-900"><Header {...props}/><section className="mx-auto px-5 py-10" style={{maxWidth:props.config.design.containerWidth}}><div className="rounded-[32px] bg-slate-950 p-7 text-white md:p-10"><span className="text-[10px] font-black text-emerald-300">COLLECTION</span><h2 className="mt-2 text-3xl font-black md:text-4xl">همه محصولات فروشگاه</h2><p className="mt-3 max-w-xl text-sm leading-7 text-white/55">محصولات واقعی کاتالوگ Loadder؛ آماده فیلتر، دسته‌بندی و اتصال به کمپین‌ها.</p></div><div className="mt-7 flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2"><button className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white">همه</button><button className="rounded-full border bg-white px-4 py-2 text-xs font-bold">جدیدترین</button><button className="rounded-full border bg-white px-4 py-2 text-xs font-bold">تخفیف‌دار</button></div><button className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-bold"><SlidersHorizontal/>فیلتر و مرتب‌سازی</button></div><div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">{props.products.map(p=><ProductCard key={p.id} product={p} settings={settings} config={props.config} selected={props.selected} select={props.select} sectionId="collection" interactive={false} onRuntimePage={props.onRuntimePage} runtimeAdapter={props.runtimeAdapter}/>)}</div></section><Footer config={props.config}/></div>; }

function ProductCanvas(props: CanvasProps) { const product = props.products.find(p=>p.id===props.selected.id) || props.products[0]; if(!product) return <div className="grid min-h-[650px] place-items-center bg-slate-50 text-slate-500">هنوز محصولی در کاتالوگ نیست.</div>; const view = productView(product, props.config); const gallery = [view.imageUrl, ...(product.metadata?.gallery || [])].filter(Boolean).slice(0,4); const inventory=(product.variants||[]).reduce((sum,v)=>sum+Number(v.inventoryQuantity||0),0); const purchasable=(product.variants||[]).some(v=>v.purchasable ?? (v.inventoryPolicy!=="DENY"||v.inventoryQuantity>0)); const openCollection=()=>props.runtimeAdapter?.openCollection() ?? props.onRuntimePage?.("collection"); const add=()=>props.runtimeAdapter?.addProduct(product) ?? props.onRuntimePage?.("cart"); return <div className="min-h-full bg-white text-slate-900"><Header {...props}/><main className="mx-auto px-5 py-8" style={{maxWidth:props.config.design.containerWidth}}><button type="button" onClick={openCollection} className="mb-5 text-xs font-bold text-slate-500">← بازگشت به محصولات</button><div className="grid gap-8 lg:grid-cols-[1.05fr_.95fr]"><div><div className="relative aspect-square overflow-hidden rounded-[32px] bg-slate-50">{view.imageUrl?<img src={view.imageUrl} alt={view.title} className="h-full w-full object-contain p-8"/>:<div className="grid h-full place-items-center text-slate-300"><Package size={90}/></div>}{props.interactive!==false && <InlineMediaControl target={{kind:"product",id:product.id}} onUpload={props.onImageUpload} busy={props.imageBusy} label={view.imageUrl ? "تعویض عکس محصول" : "افزودن عکس محصول"}/>}</div>{gallery.length>1&&<div className="mt-3 grid grid-cols-4 gap-3">{gallery.map((src,i)=><div key={`${src}-${i}`} className="aspect-square overflow-hidden rounded-2xl border bg-slate-50"><img src={src} alt="" className="h-full w-full object-contain p-2"/></div>)}</div>}</div><div className="lg:pt-5"><span className="text-xs font-black" style={{color:props.config.design.primaryColor}}>{product.brand || product.category || "محصول منتخب"}</span><h1 className="mt-3 text-3xl font-black leading-tight md:text-4xl">{view.title}</h1><div className="mt-4 flex items-center gap-2 text-amber-400"><Star weight="fill"/><Star weight="fill"/><Star weight="fill"/><Star weight="fill"/><Star/><span className="mr-2 text-xs text-slate-400">۴.۸ · ۱۲۸ نظر</span></div><div className="mt-7 flex items-center gap-3"><strong className="text-2xl" style={{color:props.config.design.primaryColor}}>{formatMoney(view.regularPriceMinor,product.currency)}</strong>{view.compareAtPriceMinor&&<del className="text-sm text-slate-400">{formatMoney(view.compareAtPriceMinor,product.currency)}</del>}</div><p className="mt-6 text-sm leading-8 text-slate-500">{product.description || "برای این محصول هنوز توضیحی ثبت نشده است."}</p><div className="mt-6 rounded-2xl border bg-slate-50 p-4"><b className="text-xs">انتخاب مدل / تنوع</b><div className="mt-3 flex flex-wrap gap-2">{(product.variants?.length?product.variants:[{title:"استاندارد",inventoryQuantity:inventory}]).slice(0,4).map((v,i)=><button key={v.id||i} disabled={!(v.purchasable ?? (v.inventoryPolicy!=="DENY"||v.inventoryQuantity>0))} className={`rounded-xl border px-4 py-2 text-xs font-bold disabled:opacity-40 ${i===0?"border-slate-950 bg-slate-950 text-white":"bg-white"}`}>{v.title||`مدل ${i+1}`}</button>)}</div></div><div className="mt-5 flex gap-3"><button type="button" disabled={!purchasable} onClick={()=>void add()} className="min-h-13 flex-1 rounded-2xl px-6 text-sm font-black text-white disabled:opacity-45" style={{background:props.config.design.primaryColor}}>{purchasable?(view.ctaLabel || props.config.commerce.cartButtonLabel):"ناموجود"}</button><button className="grid h-13 w-13 place-items-center rounded-2xl border"><Heart size={22}/></button></div><div className="mt-6 grid gap-2 text-xs text-slate-600"><div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3"><Truck/>ارسال سریع و قابل پیگیری</div><div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3"><ShieldCheck/>پرداخت امن و ضمانت خرید</div><div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3"><Headset/>پشتیبانی قبل و بعد از خرید</div></div></div></div><section className="mt-14 border-t pt-10"><h2 className="text-2xl font-black">محصولات پیشنهادی</h2><div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">{props.products.filter(p=>p.id!==product.id).slice(0,4).map(p=><ProductCard key={p.id} product={p} settings={{...defaultProductSettings,showCartButton:false}} config={props.config} selected={props.selected} select={props.select} sectionId="related" interactive={false} onRuntimePage={props.onRuntimePage} runtimeAdapter={props.runtimeAdapter}/>)}</div></section></main><Footer config={props.config}/></div>; }

function Footer({config}:{config:StudioConfig}) { return <footer className="mt-8 bg-slate-950 text-white"><div className="mx-auto grid gap-8 px-5 py-10 md:grid-cols-4" style={{maxWidth:config.design.containerWidth}}><div><b className="text-lg">{config.header.storeName}</b><p className="mt-3 text-xs leading-6 text-white/45">خرید ساده، سریع و مطمئن.</p></div><div><b>فروشگاه</b><p className="mt-3 text-xs leading-6 text-white/45">محصولات · جدیدترین‌ها · تخفیف‌ها</p></div><div><b>راهنمای خرید</b><p className="mt-3 text-xs leading-6 text-white/45">ارسال · بازگشت · سوالات متداول</p></div><div><b>پشتیبانی</b><p className="mt-3 text-xs leading-6 text-white/45">پیگیری سفارش · تماس با ما</p></div></div></footer>; }
function CartCanvas(props: CanvasProps) {
  const adapter = props.runtimeAdapter;
  if (adapter) {
    const cart = adapter.cart;
    const items = cart?.items || [];
    return <div className="min-h-[650px] bg-slate-50 text-slate-900"><Header {...props}/><div className="mx-auto max-w-4xl p-8"><h2 className="text-2xl font-black">سبد خرید</h2>
      {items.length ? <div className="mt-6 space-y-3">{items.map((item) => <div key={item.id} className="flex items-center gap-4 rounded-3xl border bg-white p-5 shadow-sm"><div className="flex-1"><b>{item.productName}</b>{item.variantTitle && item.variantTitle !== "Default" && <span className="mr-2 text-xs text-slate-400">{item.variantTitle}</span>}<p className="mt-2 text-sm text-slate-400">تعداد: {new Intl.NumberFormat("fa-IR").format(item.quantity)}</p></div><strong>{formatMoney(item.lineTotalMinor, cart?.currency || "IRT")}</strong></div>)}</div> : <p className="mt-8 text-slate-400">سبد خالی است.</p>}
      <div className="mt-6 rounded-3xl border bg-white p-5"><div className="flex justify-between text-sm"><span>جمع سفارش</span><b>{cart ? formatMoney(cart.totalMinor, cart.currency) : "—"}</b></div><button disabled={!items.length} onClick={() => props.onRuntimePage?.("checkout")} className="mt-5 w-full rounded-2xl bg-violet-600 px-6 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">ادامه و تسویه</button></div>
    </div></div>;
  }
  const item=props.products.find(p=>p.id===props.selected.id)||props.products[0]; const view=item?productView(item,props.config):null; return <div className="min-h-[650px] bg-slate-50 text-slate-900"><Header {...props}/><div className="mx-auto max-w-4xl p-8"><h2 className="text-2xl font-black">سبد خرید</h2>{item&&view?<div className="mt-6 flex items-center gap-4 rounded-3xl border bg-white p-5 shadow-sm">{view.imageUrl&&<img src={view.imageUrl} className="h-24 w-24 object-contain"/>}<div className="flex-1"><b>{view.title}</b><p className="mt-2 text-sm text-slate-400">تعداد: ۱</p></div><strong>{formatMoney(view.regularPriceMinor,item.currency)}</strong></div>:<p className="mt-8 text-slate-400">سبد خالی است.</p>}<div className="mt-6 rounded-3xl border bg-white p-5"><div className="flex justify-between text-sm"><span>جمع سفارش</span><b>{item&&view?formatMoney(view.regularPriceMinor,item.currency):"—"}</b></div><button onClick={()=>props.onRuntimePage?.("checkout")} className="mt-5 w-full rounded-2xl bg-violet-600 px-6 py-3 text-sm font-black text-white">ادامه و تسویه</button></div></div></div>; }

function CheckoutForm({ adapter, onRuntimePage }: { adapter: StorefrontRuntimeAdapter; onRuntimePage?: CanvasProps["onRuntimePage"] }) {
  const [form, setForm] = useState({ fullName: "", phone: "", email: "", address: "", city: "", province: "", postalCode: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const field = (key: keyof typeof form) => ({ value: form[key], onChange: (event: React.ChangeEvent<HTMLInputElement>) => setForm((current) => ({ ...current, [key]: event.target.value })) });
  return <div className="min-h-[650px] bg-slate-50 p-8 text-slate-900"><div className="mx-auto max-w-xl rounded-3xl border bg-white p-7 shadow-sm"><h2 className="text-2xl font-black">تسویه حساب</h2><p className="mt-2 text-xs text-slate-400">اطلاعات ارسال و پرداخت</p>
    <form data-checkout-form="real" noValidate onSubmit={async (event) => {
      event.preventDefault();
      if (!form.fullName.trim() || !form.phone.trim()) { setError("نام و شماره تماس الزامی است."); return; }
      setBusy(true); setError("");
      try {
        await adapter.checkout!({
          fullName: form.fullName.trim(), phone: form.phone.trim(), email: form.email.trim() || undefined,
          shippingAddress: { province: form.province.trim(), city: form.city.trim(), address: form.address.trim(), postalCode: form.postalCode.trim() },
        });
        onRuntimePage?.("success");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "ثبت سفارش ناموفق بود.");
      } finally {
        setBusy(false);
      }
    }}>
      <input required className="mt-6 min-h-12 w-full rounded-xl border px-4" placeholder="نام و نام خانوادگی" {...field("fullName")} />
      <input required className="mt-3 min-h-12 w-full rounded-xl border px-4" placeholder="شماره تماس" {...field("phone")} />
      <input className="mt-3 min-h-12 w-full rounded-xl border px-4" type="email" placeholder="ایمیل (اختیاری)" {...field("email")} />
      <input className="mt-3 min-h-12 w-full rounded-xl border px-4" placeholder="آدرس ارسال" {...field("address")} />
      <div className="mt-3 grid grid-cols-2 gap-3"><input className="min-h-12 w-full rounded-xl border px-4" placeholder="شهر" {...field("city")} /><input className="min-h-12 w-full rounded-xl border px-4" placeholder="استان" {...field("province")} /></div>
      {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-600">{error}</p>}
      <button type="submit" disabled={busy} className="mt-5 w-full rounded-xl bg-violet-600 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? "در حال ثبت سفارش…" : "ثبت سفارش"}</button>
    </form>
  </div></div>;
}

function CheckoutCanvas(props: CanvasProps) {
  if (props.runtimeAdapter?.checkout) return <CheckoutForm adapter={props.runtimeAdapter} onRuntimePage={props.onRuntimePage} />;
  return <div className="min-h-[650px] bg-slate-50 p-8 text-slate-900"><div className="mx-auto max-w-xl rounded-3xl border bg-white p-7 shadow-sm"><h2 className="text-2xl font-black">تسویه حساب</h2><p className="mt-2 text-xs text-slate-400">اطلاعات ارسال و پرداخت</p><input className="mt-6 min-h-12 w-full rounded-xl border px-4" placeholder="نام و نام خانوادگی"/><input className="mt-3 min-h-12 w-full rounded-xl border px-4" placeholder="شماره تماس"/><input className="mt-3 min-h-12 w-full rounded-xl border px-4" placeholder="آدرس ارسال"/><button onClick={()=>props.onRuntimePage?.("success")} className="mt-5 w-full rounded-xl bg-violet-600 py-3 font-black text-white">ثبت سفارش آزمایشی</button></div></div>;
}
function SuccessCanvas(props: CanvasProps) { return <div className="grid min-h-[650px] place-items-center bg-slate-50 p-8 text-center text-slate-900"><div><CheckCircle size={64} className="mx-auto text-emerald-500"/><h2 className="mt-4 text-2xl font-black">{props.config.commerce.orderSuccessTitle}</h2><p className="mt-2 text-sm text-slate-400">سفارش شما با موفقیت ثبت شد.</p><button onClick={()=>props.onRuntimePage?.("storefront")} className="mt-6 rounded-xl border bg-white px-5 py-3 font-bold">بازگشت به فروشگاه</button></div></div>; }

const SECTION_LABELS: Record<SectionConfig["type"], [string, React.ReactNode]> = {
  products: ["محصولات", <Package />], banner: ["بنر", <ImageSquare />], trust: ["مزیت‌ها", <ShieldCheck />],
  text: ["متن", <TextT />], spacer: ["فاصله", <Plus />], about: ["درباره ما", <TextT />],
  services: ["خدمات", <Star />], portfolio: ["نمونه‌کار", <ImageSquare />], team: ["تیم", <UserCircle />],
  "text-image": ["متن و تصویر", <ImageSquare />], cta: ["فراخوان", <ArrowLeft />], contact: ["تماس", <Headset />],
  "category-grid": ["دسته‌بندی‌ها", <ImageSquare />], brand: ["برندها", <ShoppingBag />],
};
function insertableSections(siteKind: StudioConfig["siteKind"]): Array<[SectionConfig["type"], string, React.ReactNode]> {
  return siteTypeDefinition(siteKind).sectionTypes.map((type) => [type, SECTION_LABELS[type][0], SECTION_LABELS[type][1]]);
}

/** Navigation is derived from the enabled sections — a corporate site never
 *  maintains a separate menu structure that can drift out of sync. */
function navItemsFor(config: StudioConfig, basePath = "") {
  // Navigation references page identity. A single-page site keeps the original
  // in-page anchor menu so existing corporate sites are unchanged.
  if (config.pages.length > 1) {
    return navigationPages(config.pages).map((page) => ({
      id: page.id,
      label: page.navLabel || page.title,
      href: page.slug ? `${basePath}/${page.slug}` : (basePath || "/"),
    }));
  }
  return config.sections.filter((section) => section.enabled && section.showInNav !== false && section.type !== "spacer")
    .map((section) => ({ id: section.id, label: section.navLabel || section.title, href: `#${sectionAnchor(section)}` }));
}

function CorporateHeader(props: CanvasProps) {
  const { config, device, selected, select, interactive = true } = props;
  const mobile = device === "mobile";
  const items = navItemsFor(config, props.pageBasePath);
  return <EditorElement type="header" id="header" selected={selected} onSelect={select} onEdit={props.onEditElement} interactive={interactive} className={config.header.sticky ? "sticky top-0 z-30" : ""} style={{ background: config.header.backgroundColor, color: config.header.textColor }}>
    <div className="mx-auto flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-5" style={{ maxWidth: config.design.containerWidth }}>
      <span className="flex items-center gap-3">
        <span className="relative block">
          {config.header.logoUrl ? <img src={config.header.logoUrl} alt="لوگو" className="h-10 w-10 rounded-xl object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-xl font-black text-white" style={{ background: config.design.primaryColor }}>L</span>}
          {interactive && <InlineMediaControl target={{ kind: "logo" }} onUpload={props.onImageUpload} busy={props.imageBusy} label="لوگو" compact />}
        </span>
        <b className="text-sm sm:text-base">{config.header.storeName}</b>
      </span>
      {config.nav.enabled && !mobile && <nav className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs font-bold opacity-80">
        {items.map((entry) => <a key={entry.id} href={entry.href} onClick={interactive ? (event) => event.preventDefault() : undefined}>{entry.label}</a>)}
      </nav>}
      {config.nav.enabled && <a href={config.nav.ctaHref} onClick={interactive ? (event) => event.preventDefault() : undefined} className="mr-auto inline-flex min-h-10 items-center px-4 text-xs font-black text-white" style={{ background: config.design.primaryColor, borderRadius: config.design.buttonRadius }}>{config.nav.ctaLabel}</a>}
    </div>
    {config.nav.enabled && mobile && <nav className="flex gap-4 overflow-x-auto border-t border-black/5 px-4 py-2 text-[11px] font-bold opacity-80">
      {items.map((entry) => <a key={entry.id} href={entry.href} className="whitespace-nowrap" onClick={interactive ? (event) => event.preventDefault() : undefined}>{entry.label}</a>)}
    </nav>}
  </EditorElement>;
}

function CorporateFooter({ config }: { config: StudioConfig }) {
  if (!config.footer.enabled) return null;
  return <footer className="mt-4" style={{ background: config.footer.backgroundColor, color: config.footer.textColor }}>
    <div className="mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-8 sm:px-5" style={{ maxWidth: config.design.containerWidth }}>
      <b className="text-sm">{config.header.storeName}</b>
      <span className="text-xs opacity-70">{config.footer.text}</span>
    </div>
  </footer>;
}

// Repeater item icons (see item-icons.ts); an item without one keeps the star.
const ITEM_ICON_COMPONENTS: Record<SectionItemIcon, typeof Star> = { scales: Scales, gavel: Gavel, briefcase: Briefcase, handshake: Handshake, bank: Bank, buildings: Buildings, house: HouseLine, users: Users, shield: ShieldCheck, certificate: Certificate, trophy: Trophy, medal: Medal, clock: Clock, chat: ChatCircleText, file: FileText, lightning: Lightning, star: Star };

function ItemCard({ item, section, config, variant }: { item: SectionItem; section: SectionConfig; config: StudioConfig; variant: "service" | "team" | "portfolio" }) {
  const rounded = { borderRadius: config.design.cardRadius };
  return <article className="overflow-hidden border border-black/5 bg-white" style={rounded}>
    {variant !== "service" && <div className="aspect-[4/3] w-full bg-slate-100">
      {item.imageUrl ? <img src={item.imageUrl} alt={item.title} loading="lazy" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-slate-300">{variant === "team" ? <UserCircle size={44} /> : <ImageSquare size={44} />}</div>}
    </div>}
    <div className="p-5">
      {variant === "service" && <span className="mb-3 inline-grid h-10 w-10 place-items-center rounded-xl text-white" style={{ background: config.design.primaryColor }}>{(() => { const Icon = (item.icon && ITEM_ICON_COMPONENTS[item.icon]) || Star; return <Icon size={20} data-item-icon={item.icon || "star"} />; })()}</span>}
      <b className="block text-sm" style={{ color: section.textColor }}>{item.title}</b>
      {item.subtitle && <span className="mt-1 block text-xs opacity-60">{item.subtitle}</span>}
      {item.body && <p className="mt-3 text-xs leading-6 opacity-70">{item.body}</p>}
    </div>
  </article>;
}

function ContactForm({ section, config, onSubmit }: { section: SectionConfig; config: StudioConfig; onSubmit?: CanvasProps["onLeadSubmit"] }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", company: "", message: "" });
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const field = (key: keyof typeof form) => ({ value: form[key], onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((current) => ({ ...current, [key]: event.target.value })) });
  const input = "min-h-12 w-full rounded-xl border border-black/10 bg-white px-4 text-sm outline-none focus:border-violet-400";
  if (state === "done") return <p role="status" data-lead-state="submitted" className="rounded-2xl bg-emerald-50 p-5 text-sm font-bold text-emerald-700">{section.contact?.successMessage}</p>;
  return <form data-lead-form="corporate" className="grid gap-3" onSubmit={async (event) => {
    event.preventDefault();
    if (!onSubmit) return;
    setState("busy"); setError("");
    try { await onSubmit(form); setState("done"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "ارسال ناموفق بود."); setState("error"); }
  }}>
    <div className="grid gap-3 sm:grid-cols-2">
      <input className={input} name="name" required placeholder="نام و نام خانوادگی" aria-label="نام و نام خانوادگی" {...field("name")} />
      <input className={input} name="phone" required placeholder="شماره تماس" aria-label="شماره تماس" {...field("phone")} />
      <input className={input} name="email" type="email" placeholder="ایمیل (اختیاری)" aria-label="ایمیل" {...field("email")} />
      <input className={input} name="company" placeholder="نام سازمان (اختیاری)" aria-label="نام سازمان" {...field("company")} />
    </div>
    <textarea className={`${input} min-h-28 py-3`} name="message" placeholder="شرح درخواست شما" aria-label="شرح درخواست" {...field("message")} />
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</p>}
    <button type="submit" disabled={state === "busy" || !onSubmit} className="min-h-12 px-6 text-sm font-black text-white disabled:opacity-60" style={{ background: config.design.primaryColor, borderRadius: config.design.buttonRadius }}>
      {state === "busy" ? "در حال ارسال…" : section.contact?.submitLabel || "ارسال"}
    </button>
  </form>;
}

function CorporateSection({ section, props }: { section: SectionConfig; props: CanvasProps }) {
  const { config } = props;
  const shell = { maxWidth: config.design.containerWidth };
  const pad = { paddingTop: section.spacingTop, paddingBottom: section.spacingBottom };
  const head = <div className="mb-7">
    {section.subtitle && <span className="text-[11px] font-black" style={{ color: config.design.primaryColor }}>{section.subtitle}</span>}
    <h2 className="mt-2 font-black" style={{ fontSize: props.device === "mobile" ? 24 : 30 * config.design.headingScale / 100 }}>{section.title}</h2>
  </div>;
  const columns = props.device === "mobile" ? 1 : props.device === "tablet" ? Math.min(2, section.columns || 3) : (section.columns || 3);
  const grid = { display: "grid", gap: 16, gridTemplateColumns: `repeat(${columns},minmax(0,1fr))` } as React.CSSProperties;

  if (section.type === "about" || section.type === "text-image") {
    const media = <div className="relative min-h-56 overflow-hidden bg-slate-100" style={{ borderRadius: config.design.cardRadius }}>
      {section.imageUrl ? <img src={section.imageUrl} alt={section.title} loading="lazy" className="h-full w-full object-cover" /> : <div className="grid h-full min-h-56 place-items-center text-slate-300"><ImageSquare size={48} /></div>}
      {props.interactive !== false && <InlineMediaControl target={{ kind: "banner", id: section.id }} onUpload={props.onImageUpload} busy={props.imageBusy} label={section.imageUrl ? "تعویض تصویر" : "افزودن تصویر"} />}
    </div>;
    const copy = <div>{head}<p className="text-sm leading-8 opacity-75">{section.body}</p></div>;
    return <section id={sectionAnchor(section)} className="mx-auto px-4 sm:px-5" style={{ ...shell, ...pad }}>
      <div className={props.device === "mobile" ? "grid gap-6" : "grid gap-8 md:grid-cols-2"}>
        {section.mediaPosition === "start" ? <>{media}{copy}</> : <>{copy}{media}</>}
      </div>
    </section>;
  }

  if (section.type === "services" || section.type === "team" || section.type === "portfolio") {
    const variant = section.type === "services" ? "service" : section.type === "team" ? "team" : "portfolio";
    return <section id={sectionAnchor(section)} className="mx-auto px-4 sm:px-5" style={{ ...shell, ...pad }}>
      {head}
      <div style={grid}>{(section.items || []).map((entry) => <ItemCard key={entry.id} item={entry} section={section} config={config} variant={variant} />)}</div>
    </section>;
  }

  if (section.type === "cta") {
    return <section id={sectionAnchor(section)} className="mx-auto px-4 sm:px-5" style={{ ...shell, ...pad }}>
      <div className="flex flex-wrap items-center justify-between gap-5 p-8" style={{ background: section.backgroundColor, color: section.textColor, borderRadius: config.design.cardRadius }}>
        <div><h2 className="text-xl font-black sm:text-2xl">{section.title}</h2><p className="mt-2 text-sm opacity-80">{section.subtitle}</p></div>
        <a href={section.ctaHref || "#contact-main"} onClick={props.interactive !== false ? (event) => event.preventDefault() : undefined} className="inline-flex min-h-12 items-center bg-white px-6 text-sm font-black" style={{ color: section.backgroundColor, borderRadius: config.design.buttonRadius }}>{section.ctaLabel}</a>
      </div>
    </section>;
  }

  if (section.type === "contact") {
    const details = [["تلفن", section.contact?.phone], ["ایمیل", section.contact?.email], ["نشانی", section.contact?.address]].filter(([, value]) => Boolean(value));
    return <section id={sectionAnchor(section)} className="mx-auto px-4 sm:px-5" style={{ ...shell, ...pad }}>
      {head}
      <div className={props.device === "mobile" ? "grid gap-6" : "grid gap-8 md:grid-cols-[1.1fr_.9fr]"}>
        {section.contact?.formEnabled !== false
          ? <ContactForm section={section} config={config} onSubmit={props.interactive === false ? props.onLeadSubmit : undefined} />
          : <p className="text-sm leading-8 opacity-70">{section.body}</p>}
        <div className="grid content-start gap-3">
          {details.map(([label, value]) => <div key={label as string} className="border border-black/5 bg-white p-4 text-sm" style={{ borderRadius: config.design.cardRadius }}>
            <b className="block text-xs opacity-60">{label}</b><span className="mt-1 block">{value}</span>
          </div>)}
        </div>
      </div>
    </section>;
  }

  return <section id={sectionAnchor(section)} className="mx-auto px-4 sm:px-5" style={{ ...shell, ...pad }}>
    {head}{section.body && <p className="text-sm leading-8 opacity-75">{section.body}</p>}
  </section>;
}

function CorporateCanvas(props: CanvasProps) {
  const visible = props.config.sections.filter((section) => section.enabled);
  return <div className="min-h-full" style={{ color: props.config.design.textColor, background: props.config.design.backgroundColor }}>
    <CorporateHeader {...props} />
    {props.config.pages[0]?.id === props.config.activePageId && <Hero {...props} />}
    {visible.map((section, index) => section.type === "spacer"
      ? <SectionShell key={section.id} section={section} index={index} props={props}><div style={{ height: section.spacingTop + section.spacingBottom }} /></SectionShell>
      : <SectionShell key={section.id} section={section} index={index} props={props}>
          <div style={{ background: section.backgroundColor, color: section.textColor }}><CorporateSection section={section} props={props} /></div>
        </SectionShell>)}
    <InsertBetween index={visible.length} onInsert={props.interactive === false ? undefined : props.onInsertSection} siteKind={props.config.siteKind} />
    <CorporateFooter config={props.config} />
  </div>;
}

export default function StudioCanvas(props: CanvasProps) { const [runtimePage,setRuntimePage]=useState<PageMode>(props.runtimePage || props.config.activePage); const page=props.interactive===false?runtimePage:props.config.activePage; const navigate=(next:PageMode)=>{setRuntimePage(next);props.onRuntimePage?.(next);}; const effective=useMemo(()=>({...props,onRuntimePage:navigate}),[props]); return <div dir="rtl" data-canvas-interactive={props.interactive === false ? "false" : "true"} data-preview-device={props.device} data-storefront-renderer="store-studio-v16" data-site-kind={props.config.siteKind} className="mx-auto overflow-hidden bg-white shadow-2xl" style={{width:props.device==="desktop"?"100%":props.device==="tablet"?"768px":"390px",maxWidth:"100%",fontFamily:props.config.design.fontFamily,fontSize:`${props.config.design.bodyScale}%`}}>{!isCommerceSite(props.config.siteKind)?<CorporateCanvas {...effective}/>:page==="storefront"?<StorefrontCanvas {...effective}/>:page==="collection"?<CollectionCanvas {...effective}/>:page==="product"?<ProductCanvas {...effective}/>:page==="cart"?<CartCanvas {...effective}/>:page==="checkout"?<CheckoutCanvas {...effective}/>:<SuccessCanvas {...effective}/>}</div>; }
