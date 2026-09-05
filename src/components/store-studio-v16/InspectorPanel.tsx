import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import { activeMediaSlots, bannerConfigForSection, defaultProductSettings, productView } from "./config";
import type {
  BannerLayout,
  LayoutDirection,
  LayoutHeight,
  LayoutRatio,
  MediaAsset,
  MediaSlotKey,
  Product,
  SectionConfig,
  StudioActions,
  StudioConfig,
} from "./types";

type Props = {
  config: StudioConfig;
  products: Product[];
  assets: MediaAsset[];
  actions: StudioActions;
  moveSection: (id: string, delta: number) => void;
  duplicateSection: (id: string) => void;
  deleteSection: (id: string) => void;
  addSection: (type: SectionConfig["type"]) => void;
};

const fonts = ["Vazirmatn", "IRANSansX", "Peyda", "Dana", "Shabnam", "Sahel", "Tahoma", "Arial"];

function PanelTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return <div><p className="text-[10px] font-black tracking-[.18em] text-emerald-300">{eyebrow}</p><h2 className="mt-1 text-lg font-black">{title}</h2>{text && <p className="mt-2 text-xs leading-6 text-white/40">{text}</p>}</div>;
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string | number; onChange: (value: string) => void; type?: string }) {
  return <label className="block text-xs text-white/55">{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-slate-900 px-3 text-sm text-white outline-none focus:border-emerald-400" /></label>;
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-xs text-white/55">{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-24 w-full rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-white outline-none focus:border-emerald-400" /></label>;
}

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <label className="block text-xs text-white/55">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-slate-900 px-3 text-sm text-white">{children}</select></label>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-black/20 px-3 text-xs text-white/60"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-emerald-400" /></label>;
}

function Range({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <label className="block text-xs text-white/55"><span className="flex justify-between"><span>{label}</span><b>{value}</b></span><input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-2 w-full" /></label>;
}

function Color({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="rounded-xl border border-white/10 p-2 text-center text-[10px] text-white/45"><input type="color" aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="mb-1 h-9 w-full bg-transparent" />{label}</label>;
}

function MediaSelect({ label, value, assets, onChange }: { label: string; value: string; assets: MediaAsset[]; onChange: (value: string) => void }) {
  return <Select label={label} value={value} onChange={onChange}><option value="">بدون تصویر</option>{assets.map((asset) => <option key={asset.id} value={asset.url}>{asset.name}</option>)}</Select>;
}

function HeaderEditor({ config, assets, actions }: Props) {
  return <div className="space-y-4"><PanelTitle eyebrow="HEADER" title="سربرگ فروشگاه" text="این بخش را مستقیماً روی بوم انتخاب کرده‌اید."/><MediaSelect label="لوگو از Media Library" value={config.header.logoUrl} assets={assets} onChange={(logoUrl) => actions.patchHeader({ logoUrl })}/><Field label="نام فروشگاه" value={config.header.storeName} onChange={(storeName) => actions.patchHeader({ storeName })}/><div className="grid grid-cols-2 gap-2"><Toggle label="جستجو" checked={config.header.showSearch} onChange={(showSearch) => actions.patchHeader({ showSearch })}/><Toggle label="حساب کاربر" checked={config.header.showAccount} onChange={(showAccount) => actions.patchHeader({ showAccount })}/><Toggle label="سبد" checked={config.header.showCart} onChange={(showCart) => actions.patchHeader({ showCart })}/><Toggle label="چسبان" checked={config.header.sticky} onChange={(sticky) => actions.patchHeader({ sticky })}/></div><Range label="ارتفاع" value={config.header.height} min={56} max={110} onChange={(height) => actions.patchHeader({ height })}/><div className="grid grid-cols-2 gap-2"><Color label="پس‌زمینه" value={config.header.backgroundColor} onChange={(backgroundColor) => actions.patchHeader({ backgroundColor })}/><Color label="متن" value={config.header.textColor} onChange={(textColor) => actions.patchHeader({ textColor })}/></div></div>;
}

const heroLayoutOptions = [
  ["full-image", "تصویر تمام‌عرض"],
  ["image-text", "تصویر + متن"],
  ["main-two", "بنر اصلی + دو بنر کوچک"],
  ["main-secondary", "بنر اصلی + بنر ثانویه"],
  ["text-led", "متن‌محور"],
] as const;

const heightOptions: Array<[LayoutHeight, string]> = [
  ["compact", "جمع‌وجور"],
  ["medium", "متوسط"],
  ["large", "بزرگ"],
  ["extra-large", "خیلی بزرگ"],
];

const ratioOptions: Array<[LayoutRatio, string]> = [[50, "۵۰ / ۵۰"], [60, "۶۰ / ۴۰"], [70, "۷۰ / ۳۰"], [80, "۸۰ / ۲۰"]];

function MediaSlotSelect({ label, slot, value, assets, onChange }: { label: string; slot: MediaSlotKey; value: string; assets: MediaAsset[]; onChange: (slot: MediaSlotKey, value: string) => void }) {
  return <div className="rounded-xl border border-white/10 bg-white/[.025] p-3"><MediaSelect label={label} value={value} assets={assets} onChange={(next) => onChange(slot, next)} /><Field label="یا URL تصویر" value={value} onChange={(next) => onChange(slot, next)} /></div>;
}

function HeroEditor({ config, assets, actions }: Props) {
  const hero = config.hero;
  const layout = hero.layout === "split" ? "image-text" : hero.layout === "background" ? "full-image" : hero.layout === "centered" || hero.layout === "minimal" ? "text-led" : hero.layout;
  const setSlot = (slot: MediaSlotKey, imageUrl: string) => actions.patchHero({
    ...(slot === "main" ? { imageUrl } : {}),
    mediaSlots: { ...hero.mediaSlots, [slot]: { ...hero.mediaSlots[slot], imageUrl } },
  });
  const usesText = layout !== "main-two" && layout !== "main-secondary";
  return <div className="space-y-4" data-hero-layout-inspector="true">
    <PanelTitle eyebrow="HERO LAYOUT ENGINE" title="ویترین اصلی" text="چیدمان، نسبت و هر تصویر مستقل ذخیره می‌شود و روی موبایل به‌صورت واقعی بازچینی خواهد شد." />
    <Toggle label="نمایش Hero" checked={hero.enabled} onChange={(enabled) => actions.patchHero({ enabled })} />
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {heroLayoutOptions.map(([value, label]) => <button key={value} type="button" onClick={() => actions.patchHero({ layout: value })} className={`min-h-11 rounded-xl border px-3 py-2 text-xs font-bold ${layout === value ? "border-emerald-400 bg-emerald-400/10 text-emerald-200" : "border-white/10 bg-white/5"}`}>{label}</button>)}
    </div>
    {layout !== "full-image" && <Select label={layout === "text-led" ? "جایگاه تصویر نسبت به متن" : "جایگاه تصویر / بنر اصلی"} value={hero.direction} onChange={(direction) => actions.patchHero({ direction: direction as LayoutDirection })}><option value="media-right">تصویر راست</option><option value="media-left">تصویر چپ</option></Select>}
    {layout !== "full-image" && <Select label={layout === "text-led" ? "عرض بخش متن" : "عرض تصویر / بنر اصلی"} value={String(hero.ratio)} onChange={(ratio) => actions.patchHero({ ratio: Number(ratio) as LayoutRatio })}>{ratioOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>}
    <Select label="ارتفاع Hero" value={hero.heightPreset} onChange={(heightPreset) => actions.patchHero({ heightPreset: heightPreset as LayoutHeight })}>{heightOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
    {usesText && <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[.025] p-3">
      <Field label="Eyebrow / برچسب کوچک" value={hero.eyebrow} onChange={(eyebrow) => actions.patchHero({ eyebrow })} />
      <Field label="عنوان اصلی" value={hero.title} onChange={(title) => actions.patchHero({ title })} />
      <TextArea label="زیرعنوان / توضیح" value={hero.subtitle} onChange={(subtitle) => actions.patchHero({ subtitle })} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Field label="متن CTA اصلی" value={hero.ctaLabel} onChange={(ctaLabel) => actions.patchHero({ ctaLabel })} /><Field label="لینک CTA اصلی" value={hero.ctaHref} onChange={(ctaHref) => actions.patchHero({ ctaHref })} /></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Field label="متن CTA دوم" value={hero.secondaryCtaLabel} onChange={(secondaryCtaLabel) => actions.patchHero({ secondaryCtaLabel })} /><Field label="لینک CTA دوم" value={hero.secondaryCtaHref} onChange={(secondaryCtaHref) => actions.patchHero({ secondaryCtaHref })} /></div>
    </div>}
    <div className="space-y-3">{activeMediaSlots(layout).map((slot, index) => <MediaSlotSelect key={slot} label={index === 0 ? "تصویر / بنر اصلی" : `تصویر جانبی ${index}`} slot={slot} value={hero.mediaSlots[slot].imageUrl} assets={assets} onChange={setSlot} />)}</div>
    <div className="grid grid-cols-2 gap-2"><Color label="پس‌زمینه" value={hero.backgroundColor} onChange={(backgroundColor) => actions.patchHero({ backgroundColor })} /><Color label="متن" value={hero.textColor} onChange={(textColor) => actions.patchHero({ textColor })} /></div>
    {layout === "full-image" && <Range label="شدت Overlay متن" value={hero.overlayOpacity} min={0} max={90} onChange={(overlayOpacity) => actions.patchHero({ overlayOpacity })} />}
    {usesText && <Select label="تراز متن" value={hero.alignment} onChange={(alignment) => actions.patchHero({ alignment: alignment as typeof hero.alignment })}><option value="right">راست</option><option value="center">مرکز</option><option value="left">چپ</option></Select>}
  </div>;
}

function ProductSectionEditor({ section, products, actions }: { section: SectionConfig; products: Product[]; actions: StudioActions }) {
  const settings = { ...defaultProductSettings, ...(section.productSettings || {}) };
  const patchSettings = (patch: Partial<typeof settings>) => actions.patchSection(section.id, { productSettings: { ...settings, ...patch } });
  return <div className="space-y-4"><PanelTitle eyebrow="PRODUCT SECTION" title="چیدمان محصولات" text="منبع محصول، تعداد ستون و نمایش کارت‌ها را کنترل کنید."/><div className="rounded-2xl border border-white/10 bg-white/[.03] p-3"><b className="text-xs">باکس‌های فروش آماده</b><p className="mt-1 text-[10px] text-white/35">برای ساخت سریع بخش‌های شبیه فروشگاه‌های بزرگ، یکی از این حالت‌ها را انتخاب کنید.</p><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => { actions.patchSection(section.id, { title: "شگفتانه امروز", subtitle: "فرصت محدود برای خرید با قیمت ویژه", backgroundColor: "#fff1f2", textColor: "#881337" }); patchSettings({ source: "discounted", columnsDesktop: 5, columnsTablet: 3, columnsMobile: 2, showCompareAt: true, showPromotionBadge: true, showCartButton: true, cardStyle: "vertical" }); }} className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs font-black text-rose-200">⚡ شگفتانه</button><button type="button" onClick={() => { actions.patchSection(section.id, { title: "محصولات تخفیفی", subtitle: "انتخاب‌های اقتصادی این هفته" }); patchSettings({ source: "discounted", columnsDesktop: 4, columnsTablet: 3, columnsMobile: 2, showCompareAt: true, showPromotionBadge: true, showCartButton: true }); }} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold">🔥 تخفیف‌دارها</button><button type="button" onClick={() => { actions.patchSection(section.id, { title: "پرفروش‌ترین‌ها", subtitle: "محصولاتی که بیشتر انتخاب شده‌اند" }); patchSettings({ source: "bestselling", columnsDesktop: 5, columnsTablet: 3, columnsMobile: 2, showPromotionBadge: false, showCartButton: true }); }} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold">🏆 پرفروش‌ها</button><button type="button" onClick={() => { actions.patchSection(section.id, { title: "تازه رسیده‌ها", subtitle: "جدیدترین محصولات فروشگاه" }); patchSettings({ source: "latest", columnsDesktop: 4, columnsTablet: 3, columnsMobile: 2, showPromotionBadge: false, showCartButton: true }); }} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold">✨ جدیدترین‌ها</button></div></div><Field label="عنوان بخش" value={section.title} onChange={(title) => actions.patchSection(section.id, { title })}/><Field label="زیرعنوان" value={section.subtitle} onChange={(subtitle) => actions.patchSection(section.id, { subtitle })}/><Select label="منبع محصولات" value={settings.source} onChange={(source) => patchSettings({ source: source as typeof settings.source })}><option value="featured">Featured</option><option value="latest">Latest</option><option value="bestselling">Best selling</option><option value="discounted">Discounted</option><option value="manual">انتخاب دستی</option></Select>{settings.source === "manual" && <div><p className="mb-2 text-xs text-white/55">محصولات دستی</p><div className="max-h-44 space-y-1 overflow-auto rounded-xl border border-white/10 p-2">{products.map((product) => <Toggle key={product.id} label={product.name} checked={settings.productIds.includes(product.id)} onChange={(checked) => patchSettings({ productIds: checked ? [...settings.productIds, product.id] : settings.productIds.filter((id) => id !== product.id) })}/>)}</div></div>}<div className="grid grid-cols-3 gap-2"><Field label="Desktop 1-6" type="number" value={settings.columnsDesktop} onChange={(value) => patchSettings({ columnsDesktop: Math.min(6, Math.max(1, Number(value))) })}/><Field label="Tablet 1-4" type="number" value={settings.columnsTablet} onChange={(value) => patchSettings({ columnsTablet: Math.min(4, Math.max(1, Number(value))) })}/><Field label="Mobile 1-2" type="number" value={settings.columnsMobile} onChange={(value) => patchSettings({ columnsMobile: Math.min(2, Math.max(1, Number(value))) })}/></div><Select label="چیدمان کارت" value={settings.cardStyle} onChange={(cardStyle) => patchSettings({ cardStyle: cardStyle as typeof settings.cardStyle })}><option value="vertical">عمودی</option><option value="compact">فشرده</option><option value="horizontal">افقی</option><option value="minimal">مینیمال</option></Select><Select label="نسبت تصویر" value={settings.imageRatio} onChange={(imageRatio) => patchSettings({ imageRatio: imageRatio as typeof settings.imageRatio })}><option value="square">مربع</option><option value="portrait">عمودی</option><option value="landscape">افقی</option><option value="auto">خودکار</option></Select><div className="grid grid-cols-2 gap-2"><Toggle label="برند" checked={settings.showBrand} onChange={(showBrand) => patchSettings({ showBrand })}/><Toggle label="قیمت" checked={settings.showPrice} onChange={(showPrice) => patchSettings({ showPrice })}/><Toggle label="قیمت قبل" checked={settings.showCompareAt} onChange={(showCompareAt) => patchSettings({ showCompareAt })}/><Toggle label="نشان فروش" checked={settings.showPromotionBadge} onChange={(showPromotionBadge) => patchSettings({ showPromotionBadge })}/><Toggle label="موجودی" checked={settings.showStock} onChange={(showStock) => patchSettings({ showStock })}/><Toggle label="دکمه خرید" checked={settings.showCartButton} onChange={(showCartButton) => patchSettings({ showCartButton })}/></div><SectionStyle section={section} actions={actions}/></div>;
}

function ProductCardEditor({ product, config, assets, actions }: { product: Product; config: StudioConfig; assets: MediaAsset[]; actions: StudioActions }) {
  const view = productView(product, config);
  return <div className="space-y-4"><PanelTitle eyebrow="PRODUCT CARD" title={product.name} text="این‌ها override بصری هستند و حقیقت Catalog را تغییر نمی‌دهند."/><Link to={`/dashboard/websites/commerce/product/${product.id}`} className="block min-h-11 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-3 text-center text-xs font-black text-emerald-300">ویرایش اطلاعات اصلی محصول</Link><Field label="عنوان نمایشی" value={view.title} onChange={(title) => actions.patchProduct(product.id, { title })}/><MediaSelect label="تصویر از Media Library" value={view.imageUrl} assets={assets} onChange={(imageUrl) => actions.patchProduct(product.id, { imageUrl })}/><Field label="یا URL تصویر override" value={view.imageUrl} onChange={(imageUrl) => actions.patchProduct(product.id, { imageUrl })}/><div className="grid grid-cols-2 gap-3"><Field label="قیمت نمایشی" type="number" value={view.regularPriceMinor} onChange={(value) => actions.patchProduct(product.id, { regularPriceMinor: Math.max(0, Number(value)) })}/><Field label="Compare-at" type="number" value={view.compareAtPriceMinor || 0} onChange={(value) => actions.patchProduct(product.id, { compareAtPriceMinor: Number(value) || null })}/></div><Toggle label="نشان فروش ویژه" checked={view.promotionBadge} onChange={(promotionBadge) => actions.patchProduct(product.id, { promotionBadge })}/><Field label="متن نشان" value={view.promotionBadgeText} onChange={(promotionBadgeText) => actions.patchProduct(product.id, { promotionBadgeText })}/><Toggle label="درصد تخفیف" checked={view.showDiscountPercentage} onChange={(showDiscountPercentage) => actions.patchProduct(product.id, { showDiscountPercentage })}/><Toggle label="نمایش موجودی" checked={view.showStock} onChange={(showStock) => actions.patchProduct(product.id, { showStock })}/><Field label="متن CTA" value={view.ctaLabel} onChange={(ctaLabel) => actions.patchProduct(product.id, { ctaLabel })}/><Select label="سبک CTA" value={view.ctaStyle} onChange={(ctaStyle) => actions.patchProduct(product.id, { ctaStyle: ctaStyle as typeof view.ctaStyle })}><option value="solid">Solid</option><option value="outline">Outline</option><option value="soft">Soft</option></Select><Select label="نسبت تصویر" value={view.imageRatio} onChange={(imageRatio) => actions.patchProduct(product.id, { imageRatio: imageRatio as typeof view.imageRatio })}><option value="square">Square</option><option value="portrait">Portrait</option><option value="landscape">Landscape</option><option value="auto">Auto</option></Select><Select label="تراز متن" value={view.textAlign} onChange={(textAlign) => actions.patchProduct(product.id, { textAlign: textAlign as typeof view.textAlign })}><option value="right">راست</option><option value="center">مرکز</option></Select><Range label="گردی کارت" value={view.cardRadius} min={0} max={40} onChange={(cardRadius) => actions.patchProduct(product.id, { cardRadius })}/><Range label="سایه کارت" value={view.cardShadowStrength} min={0} max={40} onChange={(cardShadowStrength) => actions.patchProduct(product.id, { cardShadowStrength })}/><Range label="ضخامت مرز" value={view.borderStrength} min={0} max={30} onChange={(borderStrength) => actions.patchProduct(product.id, { borderStrength })}/><Range label="Padding کارت" value={view.cardPadding} min={8} max={28} onChange={(cardPadding) => actions.patchProduct(product.id, { cardPadding })}/></div>;
}

function SectionStyle({ section, actions }: { section: SectionConfig; actions: StudioActions }) { return <div className="space-y-4"><div className="grid grid-cols-2 gap-2"><Color label="پس‌زمینه" value={section.backgroundColor} onChange={(backgroundColor) => actions.patchSection(section.id, { backgroundColor })}/><Color label="متن" value={section.textColor} onChange={(textColor) => actions.patchSection(section.id, { textColor })}/></div><Range label="فاصله بالا" value={section.spacingTop} min={0} max={120} onChange={(spacingTop) => actions.patchSection(section.id, { spacingTop })}/><Range label="فاصله پایین" value={section.spacingBottom} min={0} max={120} onChange={(spacingBottom) => actions.patchSection(section.id, { spacingBottom })}/></div>; }

const bannerLayoutOptions: Array<[BannerLayout, string]> = [
  ["full-width", "بنر تمام‌عرض"],
  ["two-up", "دو بنر کنار هم"],
  ["main-two", "یک بنر بزرگ + دو کوچک"],
  ["image-text", "تصویر + متن"],
  ["text-image", "متن + تصویر"],
];

function BannerEditor({ section, assets, actions }: { section: SectionConfig; assets: MediaAsset[]; actions: StudioActions }) {
  const banner = bannerConfigForSection(section);
  const patchBanner = (patch: Partial<typeof banner>) => actions.patchSection(section.id, { banner: { ...banner, ...patch } });
  const setSlot = (slot: MediaSlotKey, imageUrl: string) => actions.patchSection(section.id, {
    ...(slot === "main" ? { imageUrl } : {}),
    banner: {
      ...banner,
      mediaSlots: { ...banner.mediaSlots, [slot]: { ...banner.mediaSlots[slot], imageUrl } },
    },
  });
  const usesText = banner.layout === "image-text" || banner.layout === "text-image";

  return <div className="space-y-4" data-banner-layout-inspector="true">
    <PanelTitle eyebrow="BANNER LAYOUT ENGINE" title="بنر صفحه" text="این بخش را می‌توانید در هر جای صفحه قرار دهید؛ هر تصویر مستقل و قابل تعویض است." />
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {bannerLayoutOptions.map(([value, label]) => <button key={value} type="button" onClick={() => patchBanner({ layout: value, ...(value === "image-text" ? { direction: "media-left" as const } : value === "text-image" ? { direction: "media-right" as const } : {}) })} className={`min-h-11 rounded-xl border px-3 py-2 text-xs font-bold ${banner.layout === value ? "border-emerald-400 bg-emerald-400/10 text-emerald-200" : "border-white/10 bg-white/5"}`}>{label}</button>)}
    </div>
    {banner.layout !== "full-width" && <Select label={usesText ? "جایگاه تصویر" : "جایگاه بنر اصلی"} value={banner.direction} onChange={(direction) => patchBanner({ direction: direction as LayoutDirection })}><option value="media-right">تصویر / بنر اصلی راست</option><option value="media-left">تصویر / بنر اصلی چپ</option></Select>}
    {banner.layout !== "full-width" && <Select label={usesText ? "عرض تصویر" : "عرض بنر اصلی"} value={String(banner.ratio)} onChange={(ratio) => patchBanner({ ratio: Number(ratio) as LayoutRatio })}>{ratioOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>}
    <Select label="ارتفاع بنر" value={banner.height} onChange={(height) => patchBanner({ height: height as LayoutHeight })}>{heightOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
    {usesText && <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[.025] p-3">
      <Field label="Eyebrow / برچسب کوچک" value={section.eyebrow || ""} onChange={(eyebrow) => actions.patchSection(section.id, { eyebrow })} />
      <Field label="عنوان" value={section.title} onChange={(title) => actions.patchSection(section.id, { title })} />
      <TextArea label="متن" value={section.subtitle} onChange={(subtitle) => actions.patchSection(section.id, { subtitle })} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Field label="متن CTA" value={section.ctaLabel || ""} onChange={(ctaLabel) => actions.patchSection(section.id, { ctaLabel })} /><Field label="لینک CTA" value={section.ctaHref || ""} onChange={(ctaHref) => actions.patchSection(section.id, { ctaHref })} /></div>
    </div>}
    <div className="space-y-3">{activeMediaSlots(banner.layout).map((slot, index) => <MediaSlotSelect key={slot} label={index === 0 ? "بنر اصلی" : `بنر جانبی ${index}`} slot={slot} value={banner.mediaSlots[slot].imageUrl} assets={assets} onChange={setSlot} />)}</div>
    <SectionStyle section={section} actions={actions} />
  </div>;
}

function GenericSectionEditor({ section, actions }: { section: SectionConfig; actions: StudioActions }) { return <div className="space-y-4"><PanelTitle eyebrow={section.type.toUpperCase()} title="ویرایش بخش"/><Field label="عنوان" value={section.title} onChange={(title) => actions.patchSection(section.id, { title })}/><TextArea label="متن" value={section.subtitle} onChange={(subtitle) => actions.patchSection(section.id, { subtitle })}/><SectionStyle section={section} actions={actions}/></div>; }

function CommerceEditor({ config, actions, kind }: { config: StudioConfig; actions: StudioActions; kind: "cart" | "checkout" | "success" }) { return <div className="space-y-4"><PanelTitle eyebrow={kind.toUpperCase()} title={kind === "cart" ? "تجربه سبد" : kind === "checkout" ? "تجربه تسویه" : "صفحه موفقیت"}/>{kind === "cart" && <Toggle label="بخش کد تخفیف" checked={config.commerce.showCoupon} onChange={(showCoupon) => actions.patchCommerce({ showCoupon })}/>}<Field label="عنوان ارسال" value={config.commerce.shippingLabel} onChange={(shippingLabel) => actions.patchCommerce({ shippingLabel })}/><Field label="آستانه ارسال رایگان" type="number" value={config.commerce.freeShippingThresholdMinor} onChange={(value) => actions.patchCommerce({ freeShippingThresholdMinor: Math.max(0, Number(value)) })}/>{kind !== "success" && <Field label="متن دکمه Checkout" value={config.commerce.checkoutButtonLabel} onChange={(checkoutButtonLabel) => actions.patchCommerce({ checkoutButtonLabel })}/>}<Select label="حالت پرداخت" value={config.commerce.paymentMode} onChange={(paymentMode) => actions.patchCommerce({ paymentMode: paymentMode as "MANUAL" | "ONLINE" })}><option value="MANUAL">هماهنگی دستی</option><option value="ONLINE">آنلاین (فقط preview)</option></Select>{kind === "success" && <Field label="عنوان موفقیت" value={config.commerce.orderSuccessTitle} onChange={(orderSuccessTitle) => actions.patchCommerce({ orderSuccessTitle })}/>}<p className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-[11px] leading-6 text-amber-100/60">این کنترل‌ها فقط preview/configuration هستند؛ runtime عمومی Cart/Checkout/Order تغییر نمی‌کند.</p></div>; }

function DesignEditor({ config, actions }: Props) { const d = config.design; return <div className="space-y-4"><PanelTitle eyebrow="DESIGN SYSTEM" title="ظاهر کلی فروشگاه"/><Select label="فونت" value={d.fontFamily} onChange={(fontFamily) => actions.patchDesign({ fontFamily })}>{fonts.map((font) => <option key={font}>{font}</option>)}</Select><div className="grid grid-cols-3 gap-2"><Color label="اصلی" value={d.primaryColor} onChange={(primaryColor) => actions.patchDesign({ primaryColor })}/><Color label="ثانویه" value={d.secondaryColor} onChange={(secondaryColor) => actions.patchDesign({ secondaryColor })}/><Color label="پس‌زمینه" value={d.backgroundColor} onChange={(backgroundColor) => actions.patchDesign({ backgroundColor })}/><Color label="سطح" value={d.surfaceColor} onChange={(surfaceColor) => actions.patchDesign({ surfaceColor })}/><Color label="متن" value={d.textColor} onChange={(textColor) => actions.patchDesign({ textColor })}/><Color label="متن کمرنگ" value={d.mutedTextColor} onChange={(mutedTextColor) => actions.patchDesign({ mutedTextColor })}/></div><Range label="عرض محتوا" value={d.containerWidth} min={880} max={1280} onChange={(containerWidth) => actions.patchDesign({ containerWidth })}/><Range label="فاصله بخش‌ها" value={d.sectionSpacing} min={16} max={96} onChange={(sectionSpacing) => actions.patchDesign({ sectionSpacing })}/><Range label="گردی عمومی" value={d.globalRadius} min={0} max={40} onChange={(globalRadius) => actions.patchDesign({ globalRadius })}/><Range label="گردی کارت" value={d.cardRadius} min={0} max={40} onChange={(cardRadius) => actions.patchDesign({ cardRadius })}/><Range label="گردی دکمه" value={d.buttonRadius} min={0} max={32} onChange={(buttonRadius) => actions.patchDesign({ buttonRadius })}/><Range label="مقیاس تیتر" value={d.headingScale} min={75} max={140} onChange={(headingScale) => actions.patchDesign({ headingScale })}/><Range label="مقیاس متن" value={d.bodyScale} min={80} max={125} onChange={(bodyScale) => actions.patchDesign({ bodyScale })}/><Range label="سایه کارت" value={d.cardShadowStrength} min={0} max={40} onChange={(cardShadowStrength) => actions.patchDesign({ cardShadowStrength })}/><Range label="مرز" value={d.borderStrength} min={0} max={30} onChange={(borderStrength) => actions.patchDesign({ borderStrength })}/></div>; }

function SectionTree({ config, moveSection, duplicateSection, deleteSection, addSection, actions }: Props) { return <div className="space-y-4"><PanelTitle eyebrow="SECTION TREE" title="ساختار صفحه" text="بخش‌ها را مرتب، کپی یا غیرفعال کنید."/><div className="space-y-2">{config.sections.map((section) => <div key={section.id} className={`rounded-xl border p-3 ${config.selectedElement.id === section.id ? "border-emerald-400 bg-emerald-400/5" : "border-white/10 bg-white/[.025]"}`}><button type="button" onClick={() => actions.select({ type: section.type === "banner" ? "banner" : section.type === "trust" ? "trust" : "section", id: section.id })} className="w-full text-right"><b className="block text-xs">{section.title || section.type}</b><span className="text-[10px] text-white/35">{section.type}</span></button><div className="mt-2 flex items-center gap-1"><button type="button" aria-label="بالا" onClick={() => moveSection(section.id, -1)} className="grid min-h-9 min-w-9 place-items-center rounded-lg bg-white/5"><ArrowUp/></button><button type="button" aria-label="پایین" onClick={() => moveSection(section.id, 1)} className="grid min-h-9 min-w-9 place-items-center rounded-lg bg-white/5"><ArrowDown/></button><button type="button" aria-label="تکثیر" onClick={() => duplicateSection(section.id)} className="grid min-h-9 min-w-9 place-items-center rounded-lg bg-white/5"><Copy/></button><button type="button" aria-label="حذف" onClick={() => deleteSection(section.id)} className="grid min-h-9 min-w-9 place-items-center rounded-lg bg-rose-500/10 text-rose-300"><Trash/></button><label className="mr-auto flex items-center gap-1 text-[10px] text-white/45"><input type="checkbox" checked={section.enabled} onChange={(event) => actions.patchSection(section.id, { enabled: event.target.checked })}/>فعال</label></div></div>)}</div><Select label="افزودن بخش" value="" onChange={(type) => type && addSection(type as SectionConfig["type"])}><option value="">انتخاب نوع…</option><option value="products">Product Grid</option><option value="banner">Banner</option><option value="trust">Trust Features</option><option value="text">Text</option><option value="spacer">Spacer</option></Select><div className="flex items-center gap-2 text-xs text-white/35"><Plus/> افزودن، بدون CMS پیچیده</div></div>; }

export default function InspectorPanel(props: Props & { tab: "context" | "sections" | "design"; onTab: (tab: "context" | "sections" | "design") => void }) {
  const { config, products, assets, actions, tab, onTab } = props;
  const selection = config.selectedElement;
  const section = config.sections.find((item) => item.id === selection.id);
  const product = products.find((item) => item.id === selection.id);
  return <aside className="flex h-full min-h-0 flex-col border-r border-white/10 bg-[#0d1520] text-white"><div className="grid grid-cols-3 gap-1 border-b border-white/10 p-3">{(["context", "sections", "design"] as const).map((value) => <button key={value} type="button" onClick={() => onTab(value)} className={`min-h-11 rounded-xl text-xs font-black ${tab === value ? "bg-emerald-400 text-slate-950" : "bg-white/5 text-white/50"}`}>{value === "context" ? "ویرایش" : value === "sections" ? "بخش‌ها" : "طراحی"}</button>)}</div><div className="min-h-0 flex-1 overflow-y-auto p-5">{tab === "sections" ? <SectionTree {...props}/> : tab === "design" ? <DesignEditor {...props}/> : selection.type === "header" ? <HeaderEditor {...props}/> : selection.type === "hero" ? <HeroEditor {...props}/> : selection.type === "product-card" && product ? <ProductCardEditor product={product} config={config} assets={assets} actions={actions}/> : section?.type === "products" ? <ProductSectionEditor section={section} products={products} actions={actions}/> : section?.type === "banner" ? <BannerEditor section={section} assets={assets} actions={actions}/> : section ? <GenericSectionEditor section={section} actions={actions}/> : selection.type === "cart" ? <CommerceEditor config={config} actions={actions} kind="cart"/> : selection.type === "checkout" ? <CommerceEditor config={config} actions={actions} kind="checkout"/> : selection.type === "success" ? <CommerceEditor config={config} actions={actions} kind="success"/> : <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm leading-7 text-white/35">یک عنصر را روی بوم انتخاب کنید تا کنترل‌های مرتبط همین‌جا نمایش داده شوند.</div>}</div></aside>;
}
