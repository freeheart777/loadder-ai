import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle,
  Heart,
  Headset,
  MagnifyingGlass,
  Package,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Star,
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
  className = "",
  style,
  children,
  interactive = true,
  draggable = false,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  type: ElementType;
  id: string | null;
  selected: Selection;
  onSelect: (selection: Selection) => void;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  interactive?: boolean;
  draggable?: boolean;
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
      className={`relative outline-none transition-shadow ${interactive ? "cursor-pointer" : ""} ${active ? "z-10 ring-[3px] ring-emerald-400 ring-offset-2" : interactive ? "hover:ring-2 hover:ring-violet-400/70" : ""} ${className}`}
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
  const discount = view.compareAtPriceMinor && view.compareAtPriceMinor > view.regularPriceMinor
    ? Math.round((1 - view.regularPriceMinor / view.compareAtPriceMinor) * 100)
    : 0;
  const ratio = view.imageRatio === "portrait" ? "aspect-[3/4]" : view.imageRatio === "landscape" ? "aspect-[4/3]" : view.imageRatio === "auto" ? "min-h-44" : "aspect-square";
  const horizontal = settings.cardStyle === "horizontal" && !compact;
  return (
    <EditorElement
      type="product-card"
      id={product.id}
      selected={selected}
      onSelect={select}
      interactive={interactive}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/loadder-product-id", product.id);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const fromId = event.dataTransfer.getData("text/loadder-product-id");
        if (fromId) onReorderProduct?.(sectionId, fromId, product.id);
      }}
      className={`group overflow-hidden border border-slate-200 bg-white transition ${horizontal ? "grid grid-cols-2" : ""}`}
      style={{ borderRadius: Math.max(view.cardRadius, 14), boxShadow: `0 10px 28px rgba(15,23,42,${Math.max(6, view.cardShadowStrength) / 220})`, textAlign: view.textAlign }}
    >
      {interactive && <div className="pointer-events-none absolute left-2 top-2 z-20 rounded-md bg-slate-950/75 px-2 py-1 text-[9px] font-bold text-white">برای جابه‌جایی بکشید</div>}
      <div className={`relative overflow-hidden bg-slate-50 ${ratio}`}>
        {view.imageUrl ? <img src={view.imageUrl} alt={view.title} className="h-full w-full object-contain p-3 transition duration-300 group-hover:scale-[1.03]" /> : <div className="grid h-full min-h-44 place-items-center text-slate-300"><Package size={46} /></div>}
        <button type="button" aria-label="علاقه‌مندی" className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white/95 text-slate-500 shadow-sm"><Heart size={17} /></button>
        {settings.showPromotionBadge && view.promotionBadge && <span className="absolute left-3 top-3 rounded-full bg-rose-500 px-2.5 py-1 text-[10px] font-black text-white">{view.promotionBadgeText}</span>}
        {view.showDiscountPercentage && discount > 0 && <span className="absolute bottom-3 right-3 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-black text-white">{discount}٪ تخفیف</span>}
      </div>
      <div className="flex min-h-44 flex-col" style={{ padding: Math.max(view.cardPadding, 16) }}>
        <div className="mb-2 flex items-center justify-between gap-2">
          {settings.showBrand && <span className="truncate text-[10px] font-bold uppercase tracking-wide text-slate-400">{product.brand || product.category || "فروشگاه"}</span>}
          <span className="flex items-center gap-1 text-[10px] text-amber-500"><Star size={12} weight="fill" /> ۴.۸</span>
        </div>
        <b className="block min-h-10 line-clamp-2 text-sm leading-5 text-slate-900">{view.title}</b>
        {settings.showStock && view.showStock && <p className={`mt-2 text-[10px] font-bold ${inventory > 0 ? "text-emerald-600" : "text-rose-500"}`}>{inventory > 0 ? `${inventory} عدد موجود` : "ناموجود"}</p>}
        <div className="mt-auto pt-4">
          {settings.showPrice && <div className="mb-3 flex items-end justify-between gap-2">
            <strong className="text-sm" style={{ color: config.design.primaryColor }}>{formatMoney(view.regularPriceMinor, product.currency)}</strong>
            {settings.showCompareAt && view.compareAtPriceMinor && view.compareAtPriceMinor > view.regularPriceMinor ? <small className="text-[10px] text-slate-400 line-through">{formatMoney(view.compareAtPriceMinor, product.currency)}</small> : null}
          </div>}
          {settings.showCartButton && <button type="button" onClick={!interactive ? () => onRuntimePage?.("cart") : undefined} className="min-h-11 w-full px-3 text-xs font-black transition hover:brightness-95" style={{ borderRadius: config.design.buttonRadius, color: "white", background: config.design.primaryColor }}>{view.ctaLabel || config.commerce.cartButtonLabel}</button>}
        </div>
      </div>
    </EditorElement>
  );
}

function Header(props: CanvasProps) {
  const { config, device, selected, select, interactive = true, onRuntimePage } = props;
  const mobile = device === "mobile";
  const header = config.header;
  const categories = ["جدیدترین‌ها", "پرفروش‌ها", "تخفیف‌ها", "دسته‌بندی‌ها"];
  return (
    <EditorElement type="header" id="header" selected={selected} onSelect={select} interactive={interactive} className={header.sticky ? "sticky top-0 z-20" : ""} style={{ background: header.backgroundColor, color: header.textColor }}>
      <div className="border-b border-slate-100 bg-slate-900 px-4 py-2 text-center text-[10px] font-bold text-white/80">ارسال رایگان برای سفارش‌های منتخب · پشتیبانی ۷ روز هفته</div>
      <div className="mx-auto flex items-center gap-3 px-4 py-4" style={{ maxWidth: config.design.containerWidth }}>
        <div className="flex min-w-0 items-center gap-2">
          {header.logoUrl ? <img src={header.logoUrl} alt="لوگو" className="h-11 w-11 rounded-2xl object-cover" /> : <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-900 text-sm font-black text-white">L</div>}
          <div className="min-w-0"><b className="block truncate text-sm sm:text-base">{header.storeName}</b><span className="hidden text-[10px] text-slate-400 sm:block">خرید مطمئن، سریع و ساده</span></div>
        </div>
        {header.showSearch && !mobile && <label className="mx-auto flex min-h-11 max-w-xl flex-1 items-center gap-2 rounded-2xl bg-slate-100 px-4 text-xs text-slate-400"><MagnifyingGlass size={18} /><input className="w-full bg-transparent outline-none" placeholder="جستجو در محصولات، برند یا دسته‌بندی" /></label>}
        <div className="mr-auto flex items-center gap-1">
          {header.showSearch && mobile && <button type="button" aria-label="جستجو" className="grid min-h-11 min-w-11 place-items-center rounded-xl hover:bg-slate-100"><MagnifyingGlass size={22} /></button>}
          {header.showAccount && <div title="حساب کاربری" className="grid min-h-11 min-w-11 place-items-center rounded-xl text-slate-700"><UserCircle size={24} /></div>}
          {header.showCart && <button type="button" aria-label="سبد خرید" onClick={!interactive ? () => onRuntimePage?.("cart") : undefined} className="relative grid min-h-11 min-w-11 place-items-center rounded-xl text-slate-700 hover:bg-slate-100"><ShoppingCart size={23} /><span className="absolute right-0 top-0 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[9px] font-black text-white" style={{ background: config.design.primaryColor }}>۱</span></button>}
        </div>
      </div>
      {!mobile && <div className="border-t border-slate-100"><div className="mx-auto flex min-h-11 items-center gap-6 overflow-x-auto px-4 text-xs font-bold text-slate-600" style={{ maxWidth: config.design.containerWidth }}>{categories.map((item) => <span key={item} className="whitespace-nowrap">{item}</span>)}<span className="mr-auto whitespace-nowrap font-black" style={{ color: config.design.primaryColor }}>پیشنهاد ویژه امروز</span></div></div>}
    </EditorElement>
  );
}

function Hero(props: CanvasProps) {
  const { config, device, selected, select, interactive = true } = props;
  const hero = config.hero;
  if (!hero.enabled) return null;
  const mobile = device === "mobile";
  const hasImage = Boolean(hero.imageUrl);
  const backgroundImage = hero.layout === "background" && hasImage;
  return (
    <EditorElement type="hero" id="hero" selected={selected} onSelect={select} interactive={interactive} className="overflow-hidden" style={{ color: hero.textColor, backgroundColor: hero.backgroundColor }}>
      <div className={`mx-auto grid overflow-hidden ${mobile ? "grid-cols-1" : "grid-cols-[1.1fr_.9fr]"}`} style={{ maxWidth: config.design.containerWidth, minHeight: mobile ? Math.min(hero.height, 480) : Math.max(430, hero.height) }}>
        <div className="flex items-center p-7 sm:p-12" style={{ backgroundImage: backgroundImage ? `linear-gradient(rgba(0,0,0,${hero.overlayOpacity / 100}),rgba(0,0,0,${hero.overlayOpacity / 100})),url(${hero.imageUrl})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }}>
          <div className="max-w-xl" style={{ textAlign: hero.alignment }}>
            <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-[11px] font-black backdrop-blur">{hero.eyebrow}</span>
            <h2 className="mt-5 font-black leading-[1.2]" style={{ fontSize: mobile ? 36 : 58 * config.design.headingScale / 100 }}>{hero.title}</h2>
            <p className="mt-5 max-w-xl text-sm leading-8 opacity-80">{hero.subtitle}</p>
            <div className="mt-7 flex flex-wrap items-center gap-3"><a href={hero.ctaHref || "#products"} onClick={interactive ? (event) => event.preventDefault() : undefined} className="inline-flex min-h-12 items-center justify-center px-7 text-sm font-black text-white" style={{ borderRadius: config.design.buttonRadius, background: config.design.primaryColor }}>{hero.ctaLabel}</a><span className="text-xs opacity-65">ارسال سریع · ضمانت خرید</span></div>
          </div>
        </div>
        <div className="relative min-h-72 overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200">
          {hasImage ? <img src={hero.imageUrl} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full min-h-80 place-items-center"><div className="text-center text-slate-400"><Package size={76} className="mx-auto" /><b className="mt-4 block text-sm">تصویر کمپین فروشگاه</b><span className="mt-1 block text-xs">از Media Library انتخاب کنید</span></div></div>}
          <div className="absolute bottom-5 left-5 rounded-2xl bg-white/95 p-4 text-slate-900 shadow-xl"><small className="block text-slate-400">پیشنهاد محدود</small><b className="mt-1 block">تا ۳۰٪ تخفیف</b></div>
        </div>
      </div>
    </EditorElement>
  );
}

function TrustStrip({ config }: { config: StudioConfig }) {
  const items = [
    [Truck, "ارسال سریع", "تحویل مطمئن سفارش"],
    [ShieldCheck, "پرداخت امن", "خرید با خیال راحت"],
    [CheckCircle, "ضمانت بازگشت", "فرآیند شفاف بازگشت"],
    [Headset, "پشتیبانی", "همراه شما بعد از خرید"],
  ] as const;
  return <div className="border-y border-slate-100 bg-white"><div className="mx-auto grid grid-cols-2 gap-3 px-4 py-5 md:grid-cols-4" style={{ maxWidth: config.design.containerWidth }}>{items.map(([Icon, title, text]) => <div key={title} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-white shadow-sm" style={{ color: config.design.primaryColor }}><Icon size={21} /></div><div><b className="block text-xs text-slate-900">{title}</b><span className="mt-1 block text-[10px] text-slate-400">{text}</span></div></div>)}</div></div>;
}

function StorefrontCanvas(props: CanvasProps) {
  const { config, products, device, selected, select, interactive = true, onAddProduct, onReorderProduct, onRuntimePage } = props;
  return <div className="min-h-full bg-slate-50" style={{ color: config.design.textColor }}>
    <Header {...props} />
    <Hero {...props} />
    <TrustStrip config={config} />
    {config.sections.filter((section) => section.enabled).map((section) => {
      const type = section.type === "banner" ? "banner" : section.type === "trust" ? "trust" : "section";
      if (section.type === "spacer") return <EditorElement key={section.id} type="section" id={section.id} selected={selected} onSelect={select} interactive={interactive} style={{ height: section.spacingTop + section.spacingBottom }}><span /></EditorElement>;
      if (section.type === "products") {
        const settings = { ...section.productSettings! };
        const source = productsForSection(products, settings);
        const shown = (source.length ? source : settings.source === "manual" ? [] : products).slice(0, 12);
        const columns = device === "mobile" ? settings.columnsMobile : device === "tablet" ? settings.columnsTablet : settings.columnsDesktop;
        return <EditorElement key={section.id} type="section" id={section.id} selected={selected} onSelect={select} interactive={interactive} style={{ paddingTop: Math.max(32, section.spacingTop), paddingBottom: Math.max(32, section.spacingBottom) }}>
          <section id="products" className="mx-auto px-4" style={{ maxWidth: config.design.containerWidth }}>
            <div className="mb-6 flex items-end justify-between gap-4"><div><span className="text-[10px] font-black uppercase tracking-[.18em]" style={{ color: config.design.primaryColor }}>منتخب فروشگاه</span><h3 className="mt-2 text-2xl font-black text-slate-900">{section.title}</h3><p className="mt-2 text-xs text-slate-400">{section.subtitle}</p></div><button type="button" className="hidden rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 sm:block">مشاهده همه</button></div>
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns},minmax(0,1fr))` }}>
              {shown.map((product) => <ProductCard key={product.id} product={product} settings={settings} config={config} selected={selected} select={select} compact={device === "mobile"} sectionId={section.id} interactive={interactive} onReorderProduct={onReorderProduct} onRuntimePage={onRuntimePage} />)}
              {interactive && <button type="button" onClick={(event) => { event.stopPropagation(); onAddProduct?.(section.id); }} className="grid min-h-64 place-items-center rounded-3xl border-2 border-dashed border-violet-300 bg-violet-50/70 p-5 text-center text-violet-700 transition hover:border-violet-500 hover:bg-violet-100" aria-label="افزودن محصول"><span><Plus size={34} weight="bold" className="mx-auto" /><b className="mt-3 block text-sm">افزودن محصول</b><small className="mt-1 block opacity-60">انتخاب از Catalog فروشگاه</small></span></button>}
            </div>
            {!shown.length && !interactive && <div className="grid min-h-56 place-items-center rounded-3xl border border-dashed bg-white text-sm text-slate-400">هنوز محصولی برای این بخش انتخاب نشده است.</div>}
          </section>
        </EditorElement>;
      }
      if (section.type === "banner") return <EditorElement key={section.id} type={type} id={section.id} selected={selected} onSelect={select} interactive={interactive} style={{ paddingTop: section.spacingTop, paddingBottom: section.spacingBottom }}><section className="mx-auto px-4" style={{ maxWidth: config.design.containerWidth }}><div className="grid overflow-hidden rounded-[28px] md:grid-cols-[1.15fr_.85fr]" style={{ background: section.backgroundColor, color: section.textColor }}><div className="flex items-center p-7 sm:p-10"><div><span className="text-[10px] font-black uppercase tracking-[.18em] opacity-60">پیشنهاد ویژه</span><h3 className="mt-3 text-2xl font-black">{section.title}</h3><p className="mt-3 max-w-lg text-sm leading-7 opacity-75">{section.subtitle}</p>{section.ctaLabel && <button type="button" className="mt-5 min-h-11 rounded-xl bg-white px-5 text-xs font-black text-slate-900">{section.ctaLabel}</button>}</div></div><div className="min-h-48 bg-white/10">{section.imageUrl ? <img src={section.imageUrl} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-sm opacity-40">تصویر بنر</div>}</div></div></section></EditorElement>;
      if (section.type === "trust") return <EditorElement key={section.id} type={type} id={section.id} selected={selected} onSelect={select} interactive={interactive} style={{ paddingTop: section.spacingTop, paddingBottom: section.spacingBottom }}><section className="mx-auto px-4" style={{ maxWidth: config.design.containerWidth }}><div className="rounded-[28px] border border-slate-200 bg-white p-7 text-center"><h3 className="text-xl font-black text-slate-900">{section.title}</h3><p className="mt-2 text-sm text-slate-400">{section.subtitle}</p></div></section></EditorElement>;
      return <EditorElement key={section.id} type={type} id={section.id} selected={selected} onSelect={select} interactive={interactive} style={{ paddingTop: section.spacingTop, paddingBottom: section.spacingBottom }}><section className="mx-auto px-4" style={{ maxWidth: config.design.containerWidth }}><div className="rounded-[28px] bg-white p-7"><h3 className="text-xl font-black text-slate-900">{section.title}</h3><p className="mt-3 text-sm leading-7 text-slate-500">{section.subtitle}</p></div></section></EditorElement>;
    })}
    <footer className="mt-12 bg-slate-950 text-white"><div className="mx-auto grid gap-8 px-5 py-10 md:grid-cols-[1.2fr_.8fr_.8fr]" style={{ maxWidth: config.design.containerWidth }}><div><b className="text-lg">{config.header.storeName}</b><p className="mt-3 max-w-md text-xs leading-6 text-white/45">تجربه خرید آنلاین ساده، شفاف و قابل اعتماد. اطلاعات محصولات، موجودی و سفارش‌ها از هسته واقعی فروشگاه شما تغذیه می‌شوند.</p></div><div><b className="text-sm">راهنمای خرید</b><div className="mt-3 space-y-2 text-xs text-white/45"><p>روش‌های ارسال</p><p>شرایط بازگشت</p><p>سوالات متداول</p></div></div><div><b className="text-sm">ارتباط با ما</b><div className="mt-3 space-y-2 text-xs text-white/45"><p>پشتیبانی مشتریان</p><p>پیگیری سفارش</p><p>درباره فروشگاه</p></div></div></div><div className="border-t border-white/10 py-4 text-center text-[10px] text-white/30">ساخته‌شده با Loadder Commerce</div></footer>
  </div>;
}

function CartCanvas(props: CanvasProps) {
  const { config, products, selected, select, device, interactive = true, onRuntimePage } = props;
  const items = products.slice(0, 2);
  const subtotal = items.reduce((sum, product) => sum + productView(product, config).regularPriceMinor, 0);
  return <EditorElement type="cart" id="cart" selected={selected} onSelect={select} interactive={interactive} className="min-h-[720px] bg-slate-50 p-5 sm:p-8"><div className="mx-auto" style={{ maxWidth: config.design.containerWidth }}><div className="mb-6 flex items-center justify-between"><div><span className="text-[10px] font-black uppercase tracking-[.18em] text-slate-400">سبد خرید</span><h2 className="mt-2 text-2xl font-black text-slate-900">سفارش شما</h2></div><button type="button" onClick={!interactive ? () => onRuntimePage?.("storefront") : undefined} className="rounded-xl border bg-white px-4 py-2 text-xs font-bold text-slate-600">ادامه خرید</button></div><div className={`grid gap-5 ${device === "mobile" ? "" : "grid-cols-[1fr_340px]"}`}><div className="space-y-3">{items.map((product) => { const view = productView(product, config); return <div key={product.id} className="flex items-center gap-4 rounded-3xl border bg-white p-4">{view.imageUrl ? <img src={view.imageUrl} alt={view.title} className="h-24 w-24 rounded-2xl bg-slate-50 object-contain p-2" /> : <div className="h-24 w-24 rounded-2xl bg-slate-100" />}<div className="min-w-0 flex-1"><b className="block truncate text-slate-900">{view.title}</b><p className="mt-2 text-xs text-slate-400">تعداد: ۱</p></div><b className="text-sm" style={{ color: config.design.primaryColor }}>{formatMoney(view.regularPriceMinor, product.currency)}</b></div>; })}</div><aside className="h-fit rounded-3xl border bg-white p-5"><b className="text-slate-900">خلاصه سفارش</b><p className="mt-5 flex justify-between text-sm text-slate-500"><span>جمع کالاها</span><b className="text-slate-900">{formatMoney(subtotal, config.commerce.currency)}</b></p>{config.commerce.showCoupon && <div className="mt-4 flex gap-2"><input className="min-h-11 min-w-0 flex-1 rounded-xl border px-3 text-xs" placeholder="کد تخفیف"/><button className="rounded-xl border px-3 text-xs font-bold">اعمال</button></div>}<p className="mt-4 flex justify-between text-xs text-slate-400"><span>{config.commerce.shippingLabel}</span><span>محاسبه در مرحله بعد</span></p><button onClick={!interactive ? () => onRuntimePage?.("checkout") : undefined} className="mt-5 min-h-12 w-full font-black text-white" style={{ background: config.design.primaryColor, borderRadius: config.design.buttonRadius }}>{config.commerce.checkoutButtonLabel}</button></aside></div></div></EditorElement>;
}

function CheckoutCanvas(props: CanvasProps) {
  const { config, selected, select, device, interactive = true, onRuntimePage } = props;
  return <EditorElement type="checkout" id="checkout" selected={selected} onSelect={select} interactive={interactive} className="min-h-[720px] bg-slate-50 p-5 sm:p-8"><div className="mx-auto" style={{ maxWidth: config.design.containerWidth }}><h2 className="text-2xl font-black text-slate-900">تکمیل سفارش</h2><p className="mt-2 text-xs text-slate-400">اطلاعات سفارش را بررسی و پرداخت را تکمیل کنید.</p><div className={`mt-6 grid gap-5 ${device === "mobile" ? "" : "grid-cols-[1fr_340px]"}`}><div className="space-y-4"><PreviewPanel title="اطلاعات تماس"><div className="grid gap-3 sm:grid-cols-2"><FakeField label="نام و نام خانوادگی"/><FakeField label="شماره موبایل"/></div></PreviewPanel><PreviewPanel title="آدرس"><div className="grid gap-3 sm:grid-cols-2"><FakeField label="استان"/><FakeField label="شهر"/><FakeField label="نشانی کامل"/></div></PreviewPanel><PreviewPanel title="روش ارسال"><div className="flex min-h-14 items-center justify-between rounded-xl border p-3"><span>{config.commerce.shippingLabel}</span><CheckCircle color={config.design.primaryColor}/></div></PreviewPanel></div><aside className="h-fit rounded-3xl border bg-white p-5"><b className="text-slate-900">پرداخت</b><p className="mt-4 text-xs text-slate-400">روش پرداخت: {config.commerce.paymentMode === "ONLINE" ? "آنلاین" : "هماهنگی دستی"}</p><button onClick={!interactive ? () => onRuntimePage?.("success") : undefined} className="mt-5 min-h-12 w-full font-black text-white" style={{ background: config.design.primaryColor, borderRadius: config.design.buttonRadius }}>{config.commerce.checkoutButtonLabel}</button></aside></div></div></EditorElement>;
}

function SuccessCanvas(props: CanvasProps) {
  const { config, selected, select, interactive = true, onRuntimePage } = props;
  return <EditorElement type="success" id="success" selected={selected} onSelect={select} interactive={interactive} className="grid min-h-[720px] place-items-center bg-slate-50 p-6"><div className="max-w-md rounded-[32px] border bg-white p-9 text-center shadow-sm"><CheckCircle size={68} weight="fill" className="mx-auto" color={config.design.primaryColor}/><h2 className="mt-5 text-2xl font-black text-slate-900">{config.commerce.orderSuccessTitle}</h2><p className="mt-3 leading-7 text-slate-500">سفارش با موفقیت ثبت شد. کد پیگیری و جزئیات سفارش در نسخه production از runtime واقعی نمایش داده می‌شود.</p><button onClick={!interactive ? () => onRuntimePage?.("storefront") : undefined} className="mt-6 min-h-12 px-6 font-black text-white" style={{ background: config.design.primaryColor, borderRadius: config.design.buttonRadius }}>بازگشت به فروشگاه</button></div></EditorElement>;
}

function PreviewPanel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-3xl border bg-white p-5"><h3 className="mb-4 font-black text-slate-900">{title}</h3>{children}</section>; }
function FakeField({ label }: { label: string }) { return <label className="block text-xs text-slate-500">{label}<input className="mt-2 min-h-12 w-full rounded-xl border px-3 outline-none" /></label>; }

export default function StudioCanvas(props: CanvasProps) {
  const [internalRuntimePage, setInternalRuntimePage] = useState<PageMode>(props.config.activePage);
  useEffect(() => { setInternalRuntimePage(props.config.activePage); }, [props.config.activePage]);
  const page = props.interactive === false ? (props.runtimePage || internalRuntimePage) : props.config.activePage;
  const onRuntimePage = props.onRuntimePage || setInternalRuntimePage;
  const runtimeConfig = useMemo(() => ({ ...props.config, activePage: page }), [props.config, page]);
  const width = props.device === "desktop" ? "100%" : props.device === "tablet" ? "768px" : "390px";
  const canvasProps = { ...props, config: runtimeConfig, runtimePage: page, onRuntimePage };
  return (
    <div className="mx-auto min-h-full transition-[width]" data-preview-device={props.device} data-canvas-interactive={props.interactive === false ? "false" : "true"} style={{ width, maxWidth: props.device === "desktop" ? "1240px" : undefined }}>
      <div className="min-h-[720px] overflow-hidden bg-white shadow-2xl" style={{ borderRadius: props.device === "desktop" ? 8 : 24, fontFamily: `${props.config.design.fontFamily},Tahoma,sans-serif`, fontSize: `${16 * props.config.design.bodyScale / 100}px` }}>
        {page === "storefront" && <StorefrontCanvas {...canvasProps} />}
        {page === "cart" && <CartCanvas {...canvasProps} />}
        {page === "checkout" && <CheckoutCanvas {...canvasProps} />}
        {page === "success" && <SuccessCanvas {...canvasProps} />}
      </div>
    </div>
  );
}
