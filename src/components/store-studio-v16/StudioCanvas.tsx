import {
  CheckCircle,
  MagnifyingGlass,
  Package,
  ShoppingCart,
  UserCircle,
} from "@phosphor-icons/react";
import { productView, productsForSection, formatMoney } from "./config";
import type {
  DeviceMode,
  ElementType,
  Product,
  ProductSettings,
  Selection,
  StudioConfig,
} from "./types";

function EditorElement({
  type,
  id,
  selected,
  onSelect,
  className = "",
  style,
  children,
}: {
  type: ElementType;
  id: string | null;
  selected: Selection;
  onSelect: (selection: Selection) => void;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const active = selected.type === type && selected.id === id;
  return (
    <div
      role="button"
      tabIndex={0}
      data-editor-element={type}
      data-editor-selected={active ? "true" : "false"}
      className={`relative cursor-pointer outline-none transition-shadow ${active ? "z-10 ring-[3px] ring-emerald-400 ring-offset-2" : "hover:ring-2 hover:ring-violet-400/70"} ${className}`}
      style={style}
      onClick={(event) => {
        event.stopPropagation();
        onSelect({ type, id });
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onSelect({ type, id });
      }}
    >
      {active && (
        <span className="pointer-events-none absolute right-2 top-2 z-30 rounded-md bg-emerald-400 px-2 py-1 text-[9px] font-black text-slate-950 shadow">
          در حال ویرایش
        </span>
      )}
      {children}
    </div>
  );
}

function ProductCard({
  product,
  settings,
  config,
  selected,
  select,
  compact,
}: {
  product: Product;
  settings: ProductSettings;
  config: StudioConfig;
  selected: Selection;
  select: (selection: Selection) => void;
  compact: boolean;
}) {
  const view = productView(product, config);
  const inventory = (product.variants || []).reduce((sum, variant) => sum + Number(variant.inventoryQuantity || 0), 0);
  const discount = view.compareAtPriceMinor && view.compareAtPriceMinor > view.regularPriceMinor
    ? Math.round((1 - view.regularPriceMinor / view.compareAtPriceMinor) * 100)
    : 0;
  const ratio = view.imageRatio === "portrait" ? "aspect-[3/4]" : view.imageRatio === "landscape" ? "aspect-[4/3]" : view.imageRatio === "auto" ? "min-h-36" : "aspect-square";
  const horizontal = settings.cardStyle === "horizontal" && !compact;
  return (
    <EditorElement
      type="product-card"
      id={product.id}
      selected={selected}
      onSelect={select}
      className={`overflow-hidden bg-white ${horizontal ? "grid grid-cols-2" : ""}`}
      style={{
        borderRadius: view.cardRadius,
        border: `${Math.max(1, view.borderStrength / 5)}px solid rgba(15,23,42,.10)`,
        boxShadow: `0 12px 32px rgba(15,23,42,${view.cardShadowStrength / 180})`,
        textAlign: view.textAlign,
      }}
    >
      <div className={`relative overflow-hidden bg-slate-100 ${ratio}`}>
        {view.imageUrl ? (
          <img src={view.imageUrl} alt={view.title} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full min-h-36 place-items-center text-slate-300"><Package size={42} /></div>
        )}
        {settings.showPromotionBadge && view.promotionBadge && (
          <span className="absolute left-2 top-2 rounded-full bg-rose-500 px-2 py-1 text-[10px] font-black text-white">
            {view.promotionBadgeText}
          </span>
        )}
        {view.showDiscountPercentage && discount > 0 && (
          <span className="absolute bottom-2 right-2 rounded-full bg-emerald-500 px-2 py-1 text-[10px] font-black text-white">
            {discount}٪
          </span>
        )}
      </div>
      <div style={{ padding: view.cardPadding }}>
        {settings.showBrand && <div className="text-[10px] font-bold text-slate-400">{product.brand || "برند فروشگاه"}</div>}
        <b className="mt-1 block line-clamp-2 text-sm">{view.title}</b>
        {settings.showPrice && (
          <div className="mt-3">
            {settings.showCompareAt && view.compareAtPriceMinor && view.compareAtPriceMinor > view.regularPriceMinor ? (
              <small className="block text-slate-400 line-through">{formatMoney(view.compareAtPriceMinor, product.currency)}</small>
            ) : null}
            <strong style={{ color: config.design.primaryColor }}>{formatMoney(view.regularPriceMinor, product.currency)}</strong>
          </div>
        )}
        {settings.showStock && view.showStock && <p className="mt-2 text-[10px] text-slate-400">{inventory > 0 ? `${inventory} عدد موجود` : "ناموجود"}</p>}
        {settings.showCartButton && (
          <button
            type="button"
            className="mt-3 min-h-11 w-full px-2 text-xs font-black"
            style={{
              borderRadius: config.design.buttonRadius,
              color: view.ctaStyle === "solid" ? "white" : config.design.primaryColor,
              background: view.ctaStyle === "solid" ? config.design.primaryColor : view.ctaStyle === "soft" ? `${config.design.primaryColor}18` : "transparent",
              border: view.ctaStyle === "outline" ? `1px solid ${config.design.primaryColor}` : "none",
            }}
          >
            {view.ctaLabel}
          </button>
        )}
      </div>
    </EditorElement>
  );
}

function Header({ config, device, selected, select }: CanvasProps) {
  const mobile = device === "mobile";
  const header = config.header;
  return (
    <EditorElement
      type="header"
      id="header"
      selected={selected}
      onSelect={select}
      className="flex items-center gap-3 border-b px-4"
      style={{ minHeight: header.height, background: header.backgroundColor, color: header.textColor }}
    >
      {header.logoUrl ? <img src={header.logoUrl} alt="لوگو" className="h-10 w-10 rounded-xl object-cover" /> : <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-xs font-black text-white">L</div>}
      <b className="min-w-0 flex-1 truncate">{header.storeName}</b>
      {header.showSearch && (mobile ? <button type="button" className="grid min-h-11 min-w-11 place-items-center"><MagnifyingGlass /></button> : <div className="flex min-h-11 min-w-64 items-center gap-2 rounded-xl bg-slate-100 px-3 text-xs text-slate-400"><MagnifyingGlass /> جستجو در محصولات</div>)}
      {!mobile && header.showAccount && <UserCircle size={25} />}
      {header.showCart && <ShoppingCart size={24} />}
    </EditorElement>
  );
}

function Hero({ config, device, selected, select }: CanvasProps) {
  const hero = config.hero;
  if (!hero.enabled) return null;
  const mobile = device === "mobile";
  const split = hero.layout === "split" && !mobile;
  const backgroundImage = hero.layout === "background" && hero.imageUrl;
  return (
    <EditorElement
      type="hero"
      id="hero"
      selected={selected}
      onSelect={select}
      className={`overflow-hidden ${split ? "grid grid-cols-2" : "grid place-items-center"}`}
      style={{
        minHeight: mobile ? Math.min(hero.height, 520) : hero.height,
        color: hero.textColor,
        backgroundColor: hero.backgroundColor,
        backgroundImage: backgroundImage ? `linear-gradient(rgba(0,0,0,${hero.overlayOpacity / 100}),rgba(0,0,0,${hero.overlayOpacity / 100})),url(${hero.imageUrl})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="p-7 sm:p-12" style={{ textAlign: hero.alignment }}>
        <span className="text-xs font-black opacity-70">{hero.eyebrow}</span>
        <h2 className="mt-4 font-black leading-tight" style={{ fontSize: mobile ? 34 : 52 * config.design.headingScale / 100 }}>{hero.title}</h2>
        <p className="mt-4 max-w-xl leading-8 opacity-75">{hero.subtitle}</p>
        <a href={hero.ctaHref || "#products"} onClick={(event) => event.preventDefault()} className="mt-6 inline-flex min-h-12 items-center px-6 font-black" style={{ borderRadius: config.design.buttonRadius, background: config.design.primaryColor, color: "white" }}>{hero.ctaLabel}</a>
      </div>
      {split && <div className="min-h-full bg-white/5">{hero.imageUrl ? <img src={hero.imageUrl} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full min-h-80 place-items-center text-white/30"><Package size={72} /></div>}</div>}
    </EditorElement>
  );
}

type CanvasProps = {
  config: StudioConfig;
  products: Product[];
  device: DeviceMode;
  selected: Selection;
  select: (selection: Selection) => void;
};

function StorefrontCanvas(props: CanvasProps) {
  const { config, products, device, selected, select } = props;
  return (
    <div style={{ background: config.design.backgroundColor, color: config.design.textColor }}>
      <Header {...props} />
      <Hero {...props} />
      {config.sections.filter((section) => section.enabled).map((section) => {
        const type = section.type === "banner" ? "banner" : section.type === "trust" ? "trust" : "section";
        if (section.type === "spacer") return <EditorElement key={section.id} type="section" id={section.id} selected={selected} onSelect={select} style={{ height: section.spacingTop + section.spacingBottom }}><span /></EditorElement>;
        if (section.type === "products") {
          const settings = { ...section.productSettings! };
          const source = productsForSection(products, settings);
          const shown = (source.length ? source : products).slice(0, 12);
          const columns = device === "mobile" ? settings.columnsMobile : device === "tablet" ? settings.columnsTablet : settings.columnsDesktop;
          return (
            <EditorElement key={section.id} type="section" id={section.id} selected={selected} onSelect={select} style={{ background: section.backgroundColor, color: section.textColor, paddingTop: section.spacingTop, paddingBottom: section.spacingBottom }}>
              <div id="products" className="mx-auto px-4" style={{ maxWidth: config.design.containerWidth }}>
                <div className="mb-6"><h3 className="text-2xl font-black">{section.title}</h3><p className="mt-1 text-sm opacity-55">{section.subtitle}</p></div>
                {shown.length ? <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns},minmax(0,1fr))` }}>{shown.map((product) => <ProductCard key={product.id} product={product} settings={settings} config={config} selected={selected} select={select} compact={device === "mobile"} />)}</div> : <div className="grid min-h-52 place-items-center rounded-3xl border border-dashed text-sm opacity-45">هنوز محصولی در Catalog نیست؛ از مدیریت محصولات اضافه کنید.</div>}
              </div>
            </EditorElement>
          );
        }
        return (
          <EditorElement key={section.id} type={type} id={section.id} selected={selected} onSelect={select} style={{ background: section.backgroundColor, color: section.textColor, paddingTop: section.spacingTop, paddingBottom: section.spacingBottom }}>
            <div className={`mx-auto px-6 ${section.type === "trust" ? "text-center" : "grid gap-5 md:grid-cols-2"}`} style={{ maxWidth: config.design.containerWidth }}>
              <div><h3 className="text-2xl font-black">{section.title}</h3><p className="mt-2 opacity-70">{section.subtitle}</p>{section.ctaLabel && <button type="button" className="mt-5 min-h-11 rounded-xl bg-white/15 px-5 font-bold">{section.ctaLabel}</button>}</div>
              {section.type === "banner" && section.imageUrl && <img src={section.imageUrl} alt="" className="max-h-56 w-full rounded-2xl object-cover" />}
            </div>
          </EditorElement>
        );
      })}
    </div>
  );
}

function CartCanvas(props: CanvasProps) {
  const { config, products, selected, select, device } = props;
  const items = products.slice(0, 2);
  const subtotal = items.reduce((sum, product) => sum + productView(product, config).regularPriceMinor, 0);
  return (
    <EditorElement type="cart" id="cart" selected={selected} onSelect={select} className="min-h-[720px] bg-slate-50 p-5 sm:p-8">
      <h2 className="text-2xl font-black">سبد خرید</h2>
      <div className={`mt-6 grid gap-5 ${device === "mobile" ? "" : "grid-cols-[1fr_320px]"}`}>
        <div className="space-y-3">{items.map((product) => { const view = productView(product, config); return <div key={product.id} className="flex items-center gap-3 rounded-2xl border bg-white p-3">{view.imageUrl ? <img src={view.imageUrl} className="h-20 w-20 rounded-xl object-cover" /> : <div className="h-20 w-20 rounded-xl bg-slate-100" />}<div className="flex-1"><b>{view.title}</b><p className="mt-1 text-xs text-slate-400">تعداد: ۱</p></div><b>{formatMoney(view.regularPriceMinor, product.currency)}</b></div>; })}</div>
        <aside className="rounded-3xl border bg-white p-5"><b>خلاصه سفارش</b><p className="mt-5 flex justify-between"><span>جمع کالاها</span><b>{formatMoney(subtotal, config.commerce.currency)}</b></p>{config.commerce.showCoupon && <div className="mt-4 flex gap-2"><div className="min-h-11 flex-1 rounded-xl border px-3 py-3 text-xs text-slate-400">کد تخفیف</div><button className="rounded-xl border px-3">اعمال</button></div>}<p className="mt-4 flex justify-between text-sm"><span>{config.commerce.shippingLabel}</span><span>مرحله بعد</span></p><button className="mt-5 min-h-12 w-full font-black text-white" style={{ background: config.design.primaryColor, borderRadius: config.design.buttonRadius }}>{config.commerce.checkoutButtonLabel}</button></aside>
      </div>
    </EditorElement>
  );
}

function CheckoutCanvas(props: CanvasProps) {
  const { config, selected, select, device } = props;
  return <EditorElement type="checkout" id="checkout" selected={selected} onSelect={select} className="min-h-[720px] bg-slate-50 p-5 sm:p-8"><h2 className="text-2xl font-black">تکمیل سفارش</h2><div className={`mt-6 grid gap-5 ${device === "mobile" ? "" : "grid-cols-[1fr_320px]"}`}><div className="space-y-4"><PreviewPanel title="اطلاعات تماس"><div className="grid gap-3 sm:grid-cols-2"><FakeField label="نام و نام خانوادگی"/><FakeField label="شماره موبایل"/></div></PreviewPanel><PreviewPanel title="آدرس"><div className="grid gap-3 sm:grid-cols-2"><FakeField label="استان"/><FakeField label="شهر"/><FakeField label="نشانی کامل"/></div></PreviewPanel><PreviewPanel title="ارسال"><div className="flex min-h-14 items-center justify-between rounded-xl border p-3"><span>{config.commerce.shippingLabel}</span><CheckCircle color={config.design.primaryColor}/></div></PreviewPanel></div><aside className="rounded-3xl border bg-white p-5"><b>خلاصه پرداخت</b><p className="mt-4 text-xs text-slate-400">روش پرداخت: {config.commerce.paymentMode === "ONLINE" ? "آنلاین" : "هماهنگی دستی"}</p><button className="mt-5 min-h-12 w-full font-black text-white" style={{ background: config.design.primaryColor, borderRadius: config.design.buttonRadius }}>{config.commerce.checkoutButtonLabel}</button></aside></div></EditorElement>;
}

function SuccessCanvas(props: CanvasProps) {
  const { config, selected, select } = props;
  return <EditorElement type="success" id="success" selected={selected} onSelect={select} className="grid min-h-[720px] place-items-center bg-slate-50 p-6"><div className="max-w-md rounded-[32px] border bg-white p-9 text-center shadow-sm"><CheckCircle size={68} weight="fill" className="mx-auto" color={config.design.primaryColor}/><h2 className="mt-5 text-2xl font-black">{config.commerce.orderSuccessTitle}</h2><p className="mt-3 leading-7 text-slate-500">خلاصه سفارش و کد پیگیری از runtime واقعی نمایش داده خواهد شد.</p><button className="mt-6 min-h-12 px-6 font-black text-white" style={{ background: config.design.primaryColor, borderRadius: config.design.buttonRadius }}>بازگشت به فروشگاه</button></div></EditorElement>;
}

function PreviewPanel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-3xl border bg-white p-5"><h3 className="mb-4 font-black">{title}</h3>{children}</section>; }
function FakeField({ label }: { label: string }) { return <div className="min-h-12 rounded-xl border px-3 py-3 text-xs text-slate-400">{label}</div>; }

export default function StudioCanvas(props: CanvasProps) {
  const width = props.device === "desktop" ? "100%" : props.device === "tablet" ? "768px" : "390px";
  return (
    <div className="mx-auto min-h-full transition-[width]" data-preview-device={props.device} style={{ width, maxWidth: props.device === "desktop" ? "1200px" : undefined }}>
      <div className="min-h-[720px] overflow-hidden bg-white shadow-2xl" style={{ borderRadius: props.device === "desktop" ? 4 : 24, fontFamily: `${props.config.design.fontFamily},Tahoma,sans-serif`, fontSize: `${16 * props.config.design.bodyScale / 100}px` }}>
        {props.config.activePage === "storefront" && <StorefrontCanvas {...props} />}
        {props.config.activePage === "cart" && <CartCanvas {...props} />}
        {props.config.activePage === "checkout" && <CheckoutCanvas {...props} />}
        {props.config.activePage === "success" && <SuccessCanvas {...props} />}
      </div>
    </div>
  );
}
