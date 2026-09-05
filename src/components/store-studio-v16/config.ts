import { productMainImage } from "../../lib/productMedia";
import type {
  BannerLayout,
  BannerLayoutConfig,
  CommerceConfig,
  DesignConfig,
  HeaderConfig,
  HeroConfig,
  HeroLayout,
  LayoutHeight,
  LayoutRatio,
  MediaSlotKey,
  MediaSlots,
  Product,
  ProductSettings,
  ProductView,
  SectionConfig,
  StudioConfig,
} from "./types";

const layoutRatios = new Set<LayoutRatio>([50, 60, 70, 80]);
const layoutHeights = new Set<LayoutHeight>(["compact", "medium", "large", "extra-large"]);
const heroLayouts = new Set<HeroLayout>(["full-image", "image-text", "main-two", "main-secondary", "text-led"]);
const bannerLayouts = new Set<BannerLayout>(["full-width", "two-up", "main-two", "image-text", "text-image"]);

export const emptyMediaSlots = (): MediaSlots => ({
  main: { imageUrl: "" },
  secondary: { imageUrl: "" },
  tertiary: { imageUrl: "" },
});

export const layoutHeightPixels: Record<LayoutHeight, number> = {
  compact: 280,
  medium: 380,
  large: 500,
  "extra-large": 620,
};

export function activeMediaSlots(layout: HeroLayout | BannerLayout): MediaSlotKey[] {
  if (layout === "main-two") return ["main", "secondary", "tertiary"];
  if (layout === "main-secondary" || layout === "two-up") return ["main", "secondary"];
  return ["main"];
}

function safeRatio(value: unknown, fallback: LayoutRatio = 50): LayoutRatio {
  const ratio = Number(value) as LayoutRatio;
  return layoutRatios.has(ratio) ? ratio : fallback;
}

function safeHeight(value: unknown, legacyHeight?: unknown): LayoutHeight {
  if (layoutHeights.has(value as LayoutHeight)) return value as LayoutHeight;
  const pixels = Number(legacyHeight || 0);
  if (pixels >= 560) return "extra-large";
  if (pixels >= 450) return "large";
  if (pixels > 0 && pixels <= 320) return "compact";
  return "medium";
}

function normalizedMediaSlots(value: unknown, legacyMain = ""): MediaSlots {
  const raw = value && typeof value === "object" ? value as Partial<MediaSlots> : {};
  return {
    main: { imageUrl: raw.main?.imageUrl || legacyMain || "", altText: raw.main?.altText || "" },
    secondary: { imageUrl: raw.secondary?.imageUrl || "", altText: raw.secondary?.altText || "" },
    tertiary: { imageUrl: raw.tertiary?.imageUrl || "", altText: raw.tertiary?.altText || "" },
  };
}

export const bannerDefaults = (legacyMain = ""): BannerLayoutConfig => ({
  layout: "image-text",
  direction: "media-left",
  ratio: 50,
  height: "medium",
  mediaSlots: normalizedMediaSlots(undefined, legacyMain),
});

export function bannerConfigForSection(section: SectionConfig): BannerLayoutConfig {
  const stored = section.banner || bannerDefaults(section.imageUrl || "");
  return {
    ...bannerDefaults(section.imageUrl || ""),
    ...stored,
    layout: bannerLayouts.has(stored.layout) ? stored.layout : "image-text",
    direction: stored.direction === "media-right" ? "media-right" : "media-left",
    ratio: safeRatio(stored.ratio),
    height: safeHeight(stored.height),
    mediaSlots: normalizedMediaSlots(stored.mediaSlots, section.imageUrl || ""),
  };
}

const fallbackHeroVisual = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#eef2ff"/>
      <stop offset="1" stop-color="#ddd6fe"/>
    </linearGradient>
    <linearGradient id="p" x1="0" x2="1">
      <stop offset="0" stop-color="#6d5dfc"/>
      <stop offset="1" stop-color="#8b5cf6"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="900" fill="url(#g)"/>
  <circle cx="980" cy="130" r="210" fill="#ffffff" opacity=".55"/>
  <circle cx="170" cy="760" r="240" fill="#ffffff" opacity=".38"/>
  <rect x="215" y="155" width="770" height="560" rx="54" fill="#ffffff" opacity=".94"/>
  <rect x="285" y="225" width="300" height="390" rx="34" fill="#f8fafc"/>
  <rect x="640" y="245" width="270" height="28" rx="14" fill="#cbd5e1"/>
  <rect x="640" y="300" width="210" height="22" rx="11" fill="#e2e8f0"/>
  <rect x="640" y="365" width="190" height="46" rx="23" fill="url(#p)"/>
  <rect x="640" y="445" width="245" height="18" rx="9" fill="#e2e8f0"/>
  <rect x="640" y="486" width="195" height="18" rx="9" fill="#e2e8f0"/>
  <rect x="640" y="545" width="230" height="62" rx="20" fill="#111827"/>
  <rect x="345" y="300" width="180" height="230" rx="32" fill="url(#p)" opacity=".94"/>
  <circle cx="435" cy="385" r="46" fill="#ffffff" opacity=".85"/>
  <rect x="385" y="458" width="100" height="18" rx="9" fill="#ffffff" opacity=".8"/>
</svg>`)} `;

export const defaultProductSettings: ProductSettings = {
  source: "featured",
  productIds: [],
  columnsDesktop: 4,
  columnsTablet: 3,
  columnsMobile: 2,
  imageRatio: "square",
  cardStyle: "vertical",
  showBrand: true,
  showPrice: true,
  showCompareAt: true,
  showStock: true,
  showPromotionBadge: true,
  showCartButton: true,
};

export const designDefaults: DesignConfig = {
  fontFamily: "Vazirmatn",
  primaryColor: "#6d5dfc",
  secondaryColor: "#f59e0b",
  textColor: "#0f172a",
  mutedTextColor: "#64748b",
  backgroundColor: "#f8fafc",
  surfaceColor: "#ffffff",
  containerWidth: 1240,
  sectionSpacing: 32,
  globalRadius: 20,
  cardRadius: 18,
  buttonRadius: 12,
  headingScale: 100,
  bodyScale: 100,
  cardShadowStrength: 10,
  borderStrength: 6,
};

export const headerDefaults: HeaderConfig = {
  logoUrl: "",
  storeName: "فروشگاه شما",
  showSearch: true,
  showAccount: true,
  showCart: true,
  sticky: false,
  height: 68,
  backgroundColor: "#ffffff",
  textColor: "#0f172a",
};

export const heroDefaults: HeroConfig = {
  enabled: true,
  layout: "image-text",
  direction: "media-left",
  ratio: 50,
  heightPreset: "medium",
  eyebrow: "پیشنهادهای منتخب این هفته",
  title: "خریدی ساده، سریع و مطمئن",
  subtitle: "محصولات منتخب را با تجربه‌ای حرفه‌ای، شفاف و سازگار با موبایل کشف کنید.",
  ctaLabel: "مشاهده محصولات",
  ctaHref: "#products",
  secondaryCtaLabel: "",
  secondaryCtaHref: "",
  imageUrl: fallbackHeroVisual,
  mediaSlots: {
    ...emptyMediaSlots(),
    main: { imageUrl: fallbackHeroVisual, altText: "تصویر اصلی کمپین" },
  },
  backgroundColor: "#0f172a",
  textColor: "#ffffff",
  overlayOpacity: 28,
  height: 340,
  alignment: "right",
};

export const commerceDefaults: CommerceConfig = {
  currency: "IRT",
  showCoupon: true,
  freeShippingThresholdMinor: 0,
  shippingLabel: "ارسال استاندارد",
  paymentMode: "MANUAL",
  orderSuccessTitle: "سفارش شما با موفقیت ثبت شد",
  cartButtonLabel: "افزودن به سبد خرید",
  checkoutButtonLabel: "ادامه و ثبت سفارش",
  productOverrides: {},
};

export const sectionDefaults: SectionConfig[] = [
  {
    id: "products-main",
    type: "products",
    enabled: true,
    title: "محصولات منتخب",
    subtitle: "انتخاب‌های پیشنهادی برای امروز",
    backgroundColor: "#f8fafc",
    textColor: "#0f172a",
    spacingTop: 28,
    spacingBottom: 36,
    productSettings: defaultProductSettings,
  },
  {
    id: "banner-main",
    type: "banner",
    enabled: true,
    title: "ارسال رایگان برای خریدهای ویژه",
    subtitle: "سفارش خود را امروز کامل کنید.",
    ctaLabel: "شروع خرید",
    ctaHref: "#products",
    banner: bannerDefaults(),
    backgroundColor: "#6d5dfc",
    textColor: "#ffffff",
    spacingTop: 28,
    spacingBottom: 28,
  },
  {
    id: "trust-main",
    type: "trust",
    enabled: true,
    title: "خرید مطمئن",
    subtitle: "پرداخت امن · پشتیبانی · ارسال قابل پیگیری",
    backgroundColor: "#ffffff",
    textColor: "#0f172a",
    spacingTop: 24,
    spacingBottom: 24,
  },
];

function legacySections(content: Record<string, any>): SectionConfig[] {
  const source = content.storeBuilderV15?.sections || content.storeBuilderV11?.sections;
  if (!Array.isArray(source) || !source.length) return sectionDefaults;
  return source.map((section: any, index: number) => {
    const type = section.type === "product-slider" ? "products" : section.type === "banner-grid" ? "banner" : section.type === "trust" ? "trust" : section.type;
    const safeType = ["products", "banner", "trust", "text", "spacer"].includes(type) ? type : "text";
    const imageUrl = typeof section.imageUrl === "string" ? section.imageUrl : "";
    const next = {
      id: String(section.id || `section-${index}`),
      type: safeType,
      enabled: section.enabled !== false,
      title: String(section.title || "بخش فروشگاه"),
      subtitle: String(section.subtitle || ""),
      eyebrow: typeof section.eyebrow === "string" ? section.eyebrow : "پیشنهاد فروشگاه",
      imageUrl,
      ctaLabel: typeof section.ctaLabel === "string" ? section.ctaLabel : "",
      ctaHref: typeof section.ctaHref === "string" ? section.ctaHref : "",
      backgroundColor: section.backgroundColor || designDefaults.backgroundColor,
      textColor: section.textColor || designDefaults.textColor,
      spacingTop: Number(section.spacingTop ?? designDefaults.sectionSpacing),
      spacingBottom: Number(section.spacingBottom ?? designDefaults.sectionSpacing),
      ...(safeType === "products" ? { productSettings: { ...defaultProductSettings, ...(section.productSettings || {}) } } : {}),
    } as SectionConfig;
    return safeType === "banner" ? { ...next, banner: bannerConfigForSection({ ...next, banner: section.banner }) } : next;
  });
}

function modernizeSections(sections: SectionConfig[]) {
  return sections.map((section) => ({
    ...section,
    spacingTop: Math.min(Number(section.spacingTop ?? 32), section.type === "products" ? 32 : 36),
    spacingBottom: Math.min(Number(section.spacingBottom ?? 32), 36),
    ...(section.type === "banner" ? { banner: bannerConfigForSection(section) } : {}),
    ...(section.type === "products"
      ? {
          productSettings: {
            ...defaultProductSettings,
            ...(section.productSettings || {}),
            columnsDesktop: Math.max(3, Math.min(4, Number(section.productSettings?.columnsDesktop || 4))),
          },
        }
      : {}),
  }));
}

export function restoreConfig(content: Record<string, any>): StudioConfig {
  const v11 = content.storeBuilderV11 || {};
  const v13 = content.storeBuilderV13 || {};
  const v14 = content.storeBuilderV14 || {};
  const v15 = content.storeBuilderV15 || {};
  const v16 = content.storeBuilderV16 || {};
  const oldDesign = v13.design || v15.design || {};
  const oldCommerce = v15.commerce || v14.commerce || {};
  const oldV11Design = v11.design || {};
  const restoredSections = Array.isArray(v16.sections) ? v16.sections : legacySections(content);
  const storedHero = v16.hero || {};
  const legacyHeroLayout = ({ split: "image-text", background: "full-image", centered: "text-led", minimal: "text-led" } as const)[storedHero.layout as "split" | "background" | "centered" | "minimal"];
  const candidateHeroLayout = (legacyHeroLayout || storedHero.layout || heroDefaults.layout) as HeroLayout;
  const heroLayout = heroLayouts.has(candidateHeroLayout) ? candidateHeroLayout : heroDefaults.layout;
  const heroMainImage = storedHero.mediaSlots?.main?.imageUrl || storedHero.imageUrl || heroDefaults.imageUrl;

  return {
    version: 16,
    activePage: ["storefront", "cart", "checkout", "success"].includes(v16.activePage) ? v16.activePage : (v15.previewMode || "storefront"),
    selectedElement: v16.selectedElement || { type: "hero", id: "hero" },
    design: {
      ...designDefaults,
      fontFamily: oldDesign.fontFamily || oldV11Design.font || designDefaults.fontFamily,
      primaryColor: oldDesign.primaryColor || oldV11Design.primary || designDefaults.primaryColor,
      textColor: oldDesign.textColor || oldV11Design.text || designDefaults.textColor,
      backgroundColor: oldDesign.backgroundColor || oldV11Design.surface || designDefaults.backgroundColor,
      globalRadius: oldDesign.borderRadius ?? oldV11Design.radius ?? designDefaults.globalRadius,
      cardRadius: oldDesign.borderRadius ?? oldV11Design.radius ?? designDefaults.cardRadius,
      sectionSpacing: oldDesign.sectionSpacing ?? oldV11Design.sectionGap ?? designDefaults.sectionSpacing,
      headingScale: oldDesign.typographyScale ?? oldV11Design.textScale ?? designDefaults.headingScale,
      bodyScale: oldDesign.typographyScale ?? oldV11Design.textScale ?? designDefaults.bodyScale,
      cardShadowStrength: oldDesign.cardShadowStrength ?? designDefaults.cardShadowStrength,
      ...v16.design,
      containerWidth: Math.max(1120, Number(v16.design?.containerWidth || designDefaults.containerWidth)),
    },
    header: {
      ...headerDefaults,
      ...v16.header,
      height: Math.min(Number(v16.header?.height || headerDefaults.height), 72),
    },
    hero: {
      ...heroDefaults,
      ...storedHero,
      layout: heroLayout,
      direction: storedHero.direction === "media-right" ? "media-right" : "media-left",
      ratio: safeRatio(storedHero.ratio),
      heightPreset: safeHeight(storedHero.heightPreset, storedHero.height),
      imageUrl: heroMainImage,
      mediaSlots: normalizedMediaSlots(storedHero.mediaSlots, heroMainImage),
      height: Number(storedHero.height || heroDefaults.height),
    },
    sections: modernizeSections(restoredSections),
    commerce: {
      ...commerceDefaults,
      ...oldCommerce,
      ...v16.commerce,
      productOverrides: {
        ...(oldCommerce.productOverrides || {}),
        ...(v16.commerce?.productOverrides || {}),
      },
    },
  };
}

export function productView(product: Product, config: StudioConfig): ProductView {
  const override = config.commerce.productOverrides[product.id] || {};
  return {
    title: override.title || product.name,
    imageUrl: override.imageUrl || productMainImage(product),
    regularPriceMinor: override.regularPriceMinor ?? product.basePriceMinor,
    compareAtPriceMinor: override.compareAtPriceMinor ?? product.compareAtPriceMinor ?? null,
    promotionBadge: override.promotionBadge ?? false,
    promotionBadgeText: override.promotionBadgeText || "فروش ویژه",
    showDiscountPercentage: override.showDiscountPercentage ?? true,
    showStock: override.showStock ?? true,
    ctaLabel: override.ctaLabel || config.commerce.cartButtonLabel,
    ctaStyle: override.ctaStyle || "solid",
    imageRatio: override.imageRatio || "square",
    textAlign: override.textAlign || "right",
    cardRadius: override.cardRadius ?? config.design.cardRadius,
    cardShadowStrength: override.cardShadowStrength ?? config.design.cardShadowStrength,
    borderStrength: override.borderStrength ?? config.design.borderStrength,
    cardPadding: override.cardPadding ?? 14,
  };
}

export function productsForSection(products: Product[], settings: ProductSettings) {
  if (settings.source === "manual") {
    const order = new Map(settings.productIds.map((id, index) => [id, index]));
    return products.filter((product) => order.has(product.id)).sort((a, b) => (order.get(a.id) || 0) - (order.get(b.id) || 0));
  }
  if (settings.source === "featured") return products.filter((product) => product.featured);
  if (settings.source === "discounted") return products.filter((product) => Number(product.compareAtPriceMinor || 0) > product.basePriceMinor);
  if (settings.source === "latest") return [...products].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  return products;
}

export function formatMoney(value: number, currency: string) {
  return `${new Intl.NumberFormat("fa-IR").format(Math.max(0, value) / 100)} ${currency === "IRT" ? "تومان" : currency}`;
}
