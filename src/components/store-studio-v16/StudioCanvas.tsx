import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle,
  Headset,
  MagnifyingGlass,
  Package,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Truck,
  UserCircle,
} from "@phosphor-icons/react";
import { productView, productsForSection, formatMoney } from "./config";
import type {
  DeviceMode,
  ElementType,
  PageMode,
  Product,
  ProductSettings,
  Selection,
  StudioConfig,
} from "./types";

type CanvasProps = {
  config: StudioConfig;
  products: Product[];
  device: DeviceMode;
  selected: Selection;
  select: (selection: Selection) => void;
  interactive?: boolean;
  onAddProduct?: (sectionId: string) => void;
  onReorderProduct?: (sectionId: string, fromId: string, toId: string) => void;
  runtimePage?: PageMode;
  onRuntimePage?: (page: PageMode) => void;
};

function EditorElement({
  type,
  id,
  selected,
  onSelect,
  interactive = true,
  draggable = false,
  className = "",
  style,
  children,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  type: ElementType;
  id: string | null;
  selected: Selection;
  onSelect: (selection: Selection) => void;
  interactive?: boolean;
  draggable?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  onDragStart?: React.DragEventHandler<HTMLDivElement>;
  onDragOver?: React.DragEventHandler<HTMLDivElement>;
  onDrop?: React.DragEventHandler<HTMLDivElement>;
}) {
  const active = interactive && selected.type === type && selected.id === id;
  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      data-editor-element={interactive ? type : undefined}
      data-editor-selected={interactive ? (active ? "true" : "false") : undefined}
      draggable={interactive && draggable}
      className={`relative outline-none transition-shadow ${interactive ? "cursor-pointer" : ""} ${active ? "z-10 ring-[3px] ring-emerald-400 ring-offset-2" : interactive ? "hover:ring-2 hover:ring-violet-400/60" : ""} ${className}`}
      style={style}
      onDragStart={interactive ? onDragStart : undefined}
      onDragOver={interactive ? onDragOver : undefined}
      onDrop={interactive ? onDrop : undefined}
      onClick={interactive ? (event) => {
        event.stopPropagation();
        onSelect({ type, id });
      } : undefined}
      onKeyDown={interactive ? (event) => {
        if (event.key === "Enter" || event.key === " ") onSelect({ type, id });
      } : undefined}
    >
      {active && <span className="pointer-events-none absolute right-2 top-2 z-30 rounded-md bg-emerald-400 px-2 py-1 text-[9px] font-black text-slate-950 shadow">در حال ویرایش</span>}
      {children}
    </div>
  );
}

function Header(props: CanvasProps) {
  const { config, device, selected, select, interactive = true, onRuntimePage } = props;
  const mobile = device === "mobile";
  const header = config.header;
  const nav = ["فروشگاه", "جدیدترین‌ها", "پرفروش‌ها", "تخفیف‌ها"];
  return (
    <EditorElement type="header" id="header" selected={selected} onSelect={select} interactive={interactive} className={header.sticky ? "sticky top-0 z-20" : ""} style={{ background: header.backgroundColor, color: header.textColor }}>
      <div className="bg-slate-950 px-4 py-2 text-center text-[10px] font-bold text-white/75">ارسال سریع · پشتیبانی خرید · تجربه امن فروشگاهی</div>
      <div className="mx-auto flex min-h-20 items-center gap-3 px-4" style={{ maxWidth: config.design.containerWidth }}>
        <div className="flex min-w-0 items-center gap-3">
          {header.logoUrl ? <img src={header.logoUrl} alt="لوگو" className="h-11 w-11 rounded-xl object-cover" /> : <div className="grid h-11 w-11 place-items-center rounded-xl bg-slate-900 text-sm font-black text-white">L</div>}
          <div className="min-w-0"><b className="block truncate">{header.storeName}</b><span className="hidden text-[10px] text-slate-400 sm:block">فروشگاه آنلاین</span></div>
        </div>
        {header.showSearch && !mobile && <label className="mx-auto flex min-h-11 max-w-xl flex-1 items-center gap-2 rounded-xl bg-slate-100 px-4 text-xs text-slate-400"><MagnifyingGlass size={18} /><input className="w-full bg-transparent outline-none" placeholder="جستجو در محصولات" /></label>}
        <div className="mr-auto flex items-center gap-1">
          {header.showSearch && mobile && <button type="button" className="grid min-h-11 min-w-11 place-items-center rounded-xl" aria-label="جستجو"><MagnifyingGlass size={22} /></button>}
          {header.showAccount && <span className="grid min-h-11 min-w-11 place-items-center rounded-xl"><UserCircle size={24} /></span>}
          {header.showCart && <button type="button" onClick={!interactive ? () => onRuntimePage?.("cart") : undefined} className="relative grid min-h-11 min-w-11 place-items-center rounded-xl" aria-label="سبد خرید"><ShoppingCart size={23} /><span className="absolute right-0 top-0 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[9px] font-black text-white" style={{ background: config.design.primaryColor }}>۱</span></button>}
        </div>
      </div>
      {!mobile && <div className="border-t border-slate-100"><nav className="mx-auto flex min-h-11 items-center gap-6 px-4 text-xs font-bold text-slate-600" style={{ maxWidth: config.design.containerWidth }}>{nav.map((item) => <span key={item}>{item}</span>)}<span className="mr-auto" style={{ color: config.design.primaryColor }}>پیشنهاد ویژه</span></nav></div>}
    </EditorElement>
  );
}

function Hero(props: CanvasProps) {
  const { config, device, selected, select, interactive = true } = props;
  const hero = config.hero;
  if (!hero.enabled) return null;
  const mobile = device === "mobile";
  return (
    <EditorElement type="hero" id="hero" selected={selected} onSelect={select} interactive={interactive} className="overflow-hidden" style={{ background: hero.backgroundColor, color: hero.textColor }}>
      <div className={`mx-auto grid ${mobile ? "grid-cols-1" : "grid-cols-[1.08fr_.92fr]"}`} style={{ maxWidth: config.design.containerWidth, minHeight: mobile ? Math.min(hero.height, 480) : Math.max(420, hero.height) }}>
        <div className="flex items-center p-7 sm:p-12"><div className="max-w-xl" style={{ textAlign: hero.alignment }}><span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-[11px] font-black">{hero.eyebrow}</span><h2 className="mt-5 font-black leading-[1.2]" style={{ fontSize: mobile ? 36 : 56 * config.design.headingScale / 100 }}>{hero.title}</h2><p className="mt-5 text-sm leading-8 opacity-75">{hero.subtitle}</p><a href={hero.ctaHref || "#products"} onClick={interactive ? (event) => event.preventDefault() : undefined} className="mt-7 inline-flex min-h-12 items-center px-7 text-sm font-black text-white" style={{ background: config.design.primaryColor, borderRadius: config.design.buttonRadius }}>{hero.ctaLabel}</a></div></div>
        <div className="relative min-h-72 bg-slate-100">{hero.imageUrl ? <img src={hero.imageUrl} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full min-h-80 place-items-center text-center text-slate-400"><div><Package size={68} className="mx-auto" /><b className="mt-3 block text-sm">تصویر کمپین فروشگاه</b><span className="mt-1 block text-xs">از Media Library انتخاب کنید</span></div></div>}</div>
      </div>
    </EditorElement>
  );
}

function TrustStrip({ config }: { config: StudioConfig }) {
  const items = [[Truck, "ارسال سریع"], [ShieldCheck, "پرداخت امن"], [CheckCircle, "ضمانت خرید"], [Headset, "پشتیبانی"]] as const;
  return <div className="border-y border-slate-100 bg-white"><div className="mx-auto grid grid-cols-2 gap-3 px-4 py-5 md:grid-cols-4" style={{ maxWidth: config.design.containerWidth }}>{items.map(([Icon, label]) => <div key={label} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white" style={{ color: config.design.primaryColor }}><Icon size={21} /></span><b className="text-xs text-slate-800">{label}</b></div>)}</div></div>;
}

function ProductCard({ product, settings, config, selected, select, compact, sectionId, interactive, onReorderProduct, onRuntimePage }: {
  product: Product;
  settings: ProductSettings;
  config: StudioConfig;
  selected: Selection;
  select: (selection: Selection) => void;
  compact: boolean;
  sectionId: string;
  interactive: boolean;
  onReorderProduct?: (sectionId: string, fromId: string, toId: string) => void;
  onRuntimePage?: (page: PageMode) => void;
}) {
  const view = productView(product, config);
  const inventory = (product.variants || []).reduce((sum, variant) => sum + Number(variant.inventoryQuantity || 0), 0);
  const discount = view.compareAtPriceMinor && view.compareAtPriceMinor > view.regularPriceMinor ? Math.round((1 - view.regularPriceMinor / view.compareAtPriceMinor) * 100) : 0;
  const ratio = view.imageRatio === "portrait" ? "aspect-[3/4]" : view.imageRatio === "landscape" ? "aspect-[4/3]" : "aspect-square";
  const horizontal = settings.cardStyle === "horizontal" && !compact;
  return <EditorElement type="product-card" id={product.id} selected={selected} onSelect={select} interactive={interactive} draggable className={`overflow-hidden border border-slate-200 bg-white ${horizontal ? "grid grid-cols-2" : ""}`} style={{ borderRadius: Math.max(14, view.cardRadius), textAlign: view.textAlign, boxShadow: `0 10px 30px rgba(15,23,42,${Math.max(6, view.cardShadowStrength) / 240})` }} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/loadder-product-id", product.id); }} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); const fromId = event.dataTransfer.getData("text/loadder-product-id"); if (fromId) onReorderProduct?.(sectionId, fromId, product.id); }}>
    {interactive && <span className="pointer-events-none absolute left-2 top-2 z-20 rounded-md bg-slate-950/75 px-2 py-1 text-[9px] font-bold text-white">برای جابه‌جایی بکشید</span>}
    <div className={`relative overflow-hidden bg-slate-50 ${ratio}`}>{view.imageUrl ? <img src={view.imageUrl} alt={view.title} className="h-full w-full object-contain p-3" /> : <div className="grid h-full min-h-44 place-items-center text-slate-300"><Package size={44} /></div>}{settings.showPromotionBadge && view.promotionBadge && <span className="absolute left-3 top-3 rounded-full bg-rose-500 px-2.5 py-1 text-[10px] font-black text-white">{view.promotionBadgeText}</span>}{view.showDiscountPercentage && discount > 0 && <span className="absolute bottom-3 right-3 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-black text-white">{discount}٪</span>}</div>
    <div className="flex min-h-40 flex-col p-4">{settings.showBrand && <span className="text-[10px] font-bold text-slate-400">{product.brand || product.category || "محصول"}</span>}<b className="mt-1 block line-clamp-2 text-sm leading-5 text-slate-900">{view.title}</b>{settings.showStock && view.showStock && <span className={`mt-2 text-[10px] font-bold ${inventory > 0 ? "text-emerald-600" : "text-rose-500"}`}>{inventory > 0 ? `${inventory} عدد موجود` : "ناموجود"}</span>}<div className="mt-auto pt-4">{settings.showPrice && <div className="mb-3 flex items-end justify-between gap-2"><strong className="text-sm" style={{ color: config.design.primaryColor }}>{formatMoney(view.regularPriceMinor, product.currency)}</strong>{settings.showCompareAt && view.compareAtPriceMinor && view.compareAtPriceMinor > view.regularPriceMinor ? <small className="text-[10px] text-slate-400 line-through">{formatMoney(view.compareAtPriceMinor, product.currency)}</small> : null}</div>}{settings.showCartButton && <button type="button" onClick={!interactive ? () => onRuntimePage?.("cart") : undefined} className="min-h-11 w-full px-3 text-xs font-black text-white" style={{ background: config.design.primaryColor, borderRadius: config.design.buttonRadius }}>{view.ctaLabel || config.commerce.cartButtonLabel}</button>}</div></div>
  </EditorElement>;
}

function StorefrontCanvas(props: CanvasProps) {
  const { config, products, device, selected, select, interactive = true, onAddProduct, onReorderProduct, onRuntimePage } = props;
  return <div className="min-h-full bg-slate-50" style={{ color: config.design.textColor }}><Header {...props} /><Hero {...props} /><TrustStrip config={config} />{config.sections.filter((section) => section.enabled).map((section) => {
    const type = section.type === "banner" ? "banner" : section.type === "trust" ? "trust" : "section";
    if (section.type === "spacer") return <EditorElement key={section.id} type="section" id={section.id} selected={selected} onSelect={select} interactive={interactive} style={{ height: section.spacingTop + section.spacingBottom }}><span /></EditorElement>;
    if (section.type === "products") {
      const settings = { ...section.productSettings! };
      const source = productsForSection(products, settings);
      const shown = (source.length ? source : settings.source === "manual" ? [] : products).slice(0, 12);
      const columns = device === "mobile" ? settings.columnsMobile : device === "tablet" ? settings.columnsTablet : settings.columnsDesktop;
      return <EditorElement key={section.id} type="section" id={section.id} selected={selected} onSelect={select} interactive={interactive} style={{ paddingTop: Math.max(32, section.spacingTop), paddingBottom: Math.max(32, section.spacingBottom) }}><section id="products" className="mx-auto px-4" style={{ maxWidth: config.design.containerWidth }}><div className="mb-6 flex items-end justify-between gap-4"><div><span className="text-[10px] font-black uppercase tracking-[.16em]" style={{ color: config.design.primaryColor }}>منتخب فروشگاه</span><h3 className="mt-2 text-2xl font-black text-slate-900">{section.title}</h3><p className="mt-2 text-xs text-slate-400">{section.subtitle}</p></div><span className="hidden rounded-xl border bg-white px-4 py-2 text-xs font-bold text-slate-500 sm:block">مشاهده همه</span></div><div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns},minmax(0,1fr))` }}>{shown.map((product) => <ProductCard key={product.id} product={product} settings={settings} config={config} selected={selected} select={select} compact={device === "mobile"} sectionId={section.id} interactive={interactive} onReorderProduct={onReorderProduct} onRuntimePage={onRuntimePage} />)}{interactive && <button type="button" onClick={(event) => { event.stopPropagation(); onAddProduct?.(section.id); }} className="grid min-h-64 place-items-center rounded-3xl border-2 border-dashed border-violet-300 bg-violet-50/70 p-5 text-violet-700"><span><Plus size={32} className="mx-auto" /><b className="mt-3 block text-sm">افزودن محصول</b><small className="mt-1 block">انتخاب از Catalog</small></span></button>}</div>{!shown.length && !interactive && <div className="grid min-h-52 place-items-center rounded-3xl border border-dashed bg-white text-sm text-slate-400">هنوز محصولی انتخاب نشده است.</div>}</section></EditorElement>;
    }
    if (section.type === "banner") return <EditorElement key={section.id} type="banner" id={section.id} selected={selected} onSelect={select} interactive={interactive} style={{ paddingTop: section.spacingTop, paddingBottom: section.spacingBottom }}><section className="mx-auto px-4" style={{ maxWidth: config.design.containerWidth }}><div className="grid overflow-hidden rounded-[28px] md:grid-cols-[1.1fr_.9fr]" style={{ background: section.backgroundColor, color: section.textColor }}><div className="flex items-center p-8"><div><h3 className="text-2xl font-black">{section.title}</h3><p className="mt-3 text-sm leading-7 opacity-70">{section.subtitle}</p>{section.ctaLabel && <button type="button" className="mt-5 min-h-11 rounded-xl bg-white px-5 text-xs font-black text-slate-900">{section.ctaLabel}</button>}</div></div><div className="min-h-48 bg-white/10">{section.imageUrl ? <img src={section.imageUrl} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-sm opacity-40">تصویر بنر</div>}</div></div></section></EditorElement>;
    return <EditorElement key={section.id} type={type} id={section.id} selected={selected} onSelect={select} interactive={interactive} style={{ paddingTop: section.spacingTop, paddingBottom: section.spacingBottom }}><section className="mx-auto px-4" style={{ maxWidth: config.design.containerWidth }}><div className="rounded-[28px] border border-slate-200 bg-white p-7"><h3 className="text-xl font-black text-slate-900">{section.title}</h3><p className="mt-3 text-sm leading-7 text-slate-500">{section.subtitle}</p></div></section></EditorElement>;
  })}<footer className="mt-12 bg-slate-950 text-white"><div className="mx-auto grid gap-8 px-5 py-10 md:grid-cols-3" style={{ maxWidth: config.design.containerWidth }}><div><b className="text-lg">{config.header.storeName}</b><p className="mt-3 text-xs leading-6 text-white/45">فروشگاه آنلاین شما با تجربه خرید ساده و قابل اعتماد.</p></div><div><b className="text-sm">راهنمای خرید</b><p className="mt-3 text-xs leading-6 text-white/45">ارسال · بازگشت · سوالات متداول</p></div><div><b className="text-sm">پشتیبانی</b><p className="mt-3 text-xs leading-6 text-white/45">پیگیری سفارش · تماس با فروشگاه</p></div></div><div className="border-t border-white/10 py-4 text-center text-[10px] text-white/30">ساخته‌شده با Loadder Commerce</div></footer></div>;
}

function CartCanvas(props: CanvasProps) {
  const { config, products, selected, select, device, interactive = true, onRuntimePage } = props;
  const items = products.slice(0, 2);
  const subtotal = items.reduce((sum, product) => sum + productView(product, config).regularPriceMinor, 0);
  return <EditorElement type="cart" id="cart" selected={selected} onSelect={select} interactive={interactive} className="min-h-[720px] bg-slate-50 p-5 sm:p-8"><div className="mx-auto" style={{ maxWidth: config.design.containerWidth }}><div className="flex items-center justify-between"><h2 className="text-2xl font-black text-slate-900">سبد خرید</h2><button type="button" onClick={!interactive ? () => onRuntimePage?.("storefront") : undefined} className="rounded-xl border bg-white px-4 py-2 text-xs font-bold text-slate-600">ادامه خرید</button></div><div className={`mt-6 grid gap-5 ${device === "mobile" ? "" : "grid-cols-[1fr_340px]"}`}><div className="space-y-3">{items.map((product) => { const view = productView(product, config); return <div key={product.id} className="flex items-center gap-4 rounded-3xl border bg-white p-4">{view.imageUrl ? <img src={view.imageUrl} alt={view.title} className="h-24 w-24 rounded-2xl bg-slate-50 object-contain p-2" /> : <div className="h-24 w-24 rounded-2xl bg-slate-100" />}<div className="min-w-0 flex-1"><b className="block truncate text-slate-900">{view.title}</b><span className="mt-2 block text-xs text-slate-400">تعداد: ۱</span></div><b style={{ color: config.design.primaryColor }}>{formatMoney(view.regularPriceMinor, product.currency)}</b></div>; })}</div><aside className="h-fit rounded-3xl border bg-white p-5"><b className="text-slate-900">خلاصه سفارش</b><p className="mt-5 flex justify-between text-sm text-slate-500"><span>جمع کالاها</span><b className="text-slate-900">{formatMoney(subtotal, config.commerce.currency)}</b></p>{config.commerce.showCoupon && <div className="mt-4 flex gap-2"><input className="min-h-11 min-w-0 flex-1 rounded-xl border px-3 text-xs" placeholder="کد تخفیف"/><button className="rounded-xl border px-3 text-xs font-bold">اعمال</button></div>}<button onClick={!interactive ? () => onRuntimePage?.("checkout") : undefined} className="mt-5 min-h-12 w-full font-black text-white" style={{ background: config.design.primaryColor, borderRadius: config.design.buttonRadius }}>{config.commerce.checkoutButtonLabel}</button></aside></div></div></EditorElement>;
}

function PreviewPanel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-3xl border bg-white p-5"><h3 className="mb-4 font-black text-slate-900">{title}</h3>{children}</section>; }
function FakeField({ label }: { label: string }) { return <label className="block text-xs text-slate-500">{label}<input className="mt-2 min-h-12 w-full rounded-xl border px-3 outline-none" /></label>; }

function CheckoutCanvas(props: CanvasProps) {
  const { config, selected, select, device, interactive = true, onRuntimePage } = props;
  return <EditorElement type="checkout" id="checkout" selected={selected} onSelect={select} interactive={interactive} className="min-h-[720px] bg-slate-50 p-5 sm:p-8"><div className="mx-auto" style={{ maxWidth: config.design.containerWidth }}><h2 className="text-2xl font-black text-slate-900">تکمیل سفارش</h2><div className={`mt-6 grid gap-5 ${device === "mobile" ? "" : "grid-cols-[1fr_340px]"}`}><div className="space-y-4"><PreviewPanel title="اطلاعات تماس"><div className="grid gap-3 sm:grid-cols-2"><FakeField label="نام و نام خانوادگی"/><FakeField label="شماره موبایل"/></div></PreviewPanel><PreviewPanel title="آدرس"><div className="grid gap-3 sm:grid-cols-2"><FakeField label="استان"/><FakeField label="شهر"/><FakeField label="نشانی کامل"/></div></PreviewPanel><PreviewPanel title="ارسال"><div className="flex min-h-14 items-center justify-between rounded-xl border p-3"><span>{config.commerce.shippingLabel}</span><CheckCircle color={config.design.primaryColor}/></div></PreviewPanel></div><aside className="h-fit rounded-3xl border bg-white p-5"><b className="text-slate-900">پرداخت</b><p className="mt-4 text-xs text-slate-400">روش پرداخت: {config.commerce.paymentMode === "ONLINE" ? "آنلاین" : "هماهنگی دستی"}</p><button onClick={!interactive ? () => onRuntimePage?.("success") : undefined} className="mt-5 min-h-12 w-full font-black text-white" style={{ background: config.design.primaryColor, borderRadius: config.design.buttonRadius }}>{config.commerce.checkoutButtonLabel}</button></aside></div></div></EditorElement>;
}

function SuccessCanvas(props: CanvasProps) {
  const { config, selected, select, interactive = true, onRuntimePage } = props;
  return <EditorElement type="success" id="success" selected={selected} onSelect={select} interactive={interactive} className="grid min-h-[720px] place-items-center bg-slate-50 p-6"><div className="max-w-md rounded-[32px] border bg-white p-9 text-center"><CheckCircle size={68} weight="fill" className="mx-auto" color={config.design.primaryColor}/><h2 className="mt-5 text-2xl font-black text-slate-900">{config.commerce.orderSuccessTitle}</h2><p className="mt-3 leading-7 text-slate-500">این بخش Preview است و سفارش واقعی production ایجاد نمی‌کند.</p><button onClick={!interactive ? () => onRuntimePage?.("storefront") : undefined} className="mt-6 min-h-12 px-6 font-black text-white" style={{ background: config.design.primaryColor, borderRadius: config.design.buttonRadius }}>بازگشت به فروشگاه</button></div></EditorElement>;
}

export default function StudioCanvas(props: CanvasProps) {
  const [internalRuntimePage, setInternalRuntimePage] = useState<PageMode>(props.config.activePage);
  useEffect(() => setInternalRuntimePage(props.config.activePage), [props.config.activePage]);
  const page = props.interactive === false ? (props.runtimePage || internalRuntimePage) : props.config.activePage;
  const onRuntimePage = props.onRuntimePage || setInternalRuntimePage;
  const runtimeConfig = useMemo(() => ({ ...props.config, activePage: page }), [props.config, page]);
  const width = props.device === "desktop" ? "100%" : props.device === "tablet" ? "768px" : "390px";
  const canvasProps = { ...props, config: runtimeConfig, runtimePage: page, onRuntimePage };
  return <div className="mx-auto min-h-full transition-[width]" data-preview-device={props.device} data-canvas-interactive={props.interactive === false ? "false" : "true"} style={{ width, maxWidth: props.device === "desktop" ? "1240px" : undefined }}><div className="min-h-[720px] overflow-hidden bg-white shadow-2xl" style={{ borderRadius: props.device === "desktop" ? 8 : 24, fontFamily: `${props.config.design.fontFamily},Tahoma,sans-serif`, fontSize: `${16 * props.config.design.bodyScale / 100}px` }}>{page === "storefront" && <StorefrontCanvas {...canvasProps} />}{page === "cart" && <CartCanvas {...canvasProps} />}{page === "checkout" && <CheckoutCanvas {...canvasProps} />}{page === "success" && <SuccessCanvas {...canvasProps} />}</div></div>;
}
