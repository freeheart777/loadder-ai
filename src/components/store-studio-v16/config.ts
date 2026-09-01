import { productMainImage } from "../../lib/productMedia";
import type {
  CommerceConfig,
  DesignConfig,
  HeaderConfig,
  HeroConfig,
  Product,
  ProductSettings,
  ProductView,
  SectionConfig,
  StudioConfig,
} from "./types";

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
  textColor: "#111827",
  mutedTextColor: "#64748b",
  backgroundColor: "#f8fafc",
  surfaceColor: "#ffffff",
  containerWidth: 1180,
  sectionSpacing: 48,
  globalRadius: 24,
  cardRadius: 20,
  buttonRadius: 14,
  headingScale: 100,
  bodyScale: 100,
  cardShadowStrength: 14,
  borderStrength: 8,
};

export const headerDefaults: HeaderConfig = {
  logoUrl: "",
  storeName: "فروشگاه شما",
  showSearch: true,
  showAccount: true,
  showCart: true,
  sticky: false,
  height: 72,
  backgroundColor: "#ffffff",
  textColor: "#111827",
};

export const heroDefaults: HeroConfig = {
  enabled: true,
  layout: "split",
  eyebrow: "انتخاب تازه این هفته",
  title: "خریدی ساده، سریع و مطمئن",
  subtitle: "محصولات منتخب را با تجربه‌ای حرفه‌ای و سازگار با موبایل کشف کنید.",
  ctaLabel: "مشاهده محصولات",
  ctaHref: "#products",
  imageUrl: "",
  backgroundColor: "#111827",
  textColor: "#ffffff",
  overlayOpacity: 34,
  height: 460,
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
    subtitle: "انتخاب‌هایی برای امروز",
    backgroundColor: "#f8fafc",
    textColor: "#111827",
    spacingTop: 48,
    spacingBottom: 48,
    productSettings: defaultProductSettings,
  },
  {
    id: "banner-main",
    type: "banner",
    enabled: true,
    title: "ارسال رایگان برای خریدهای ویژه",
    subtitle: "سفارش خود را امروز کامل کنید.",
    ctaLabel: "شروع خرید",
    backgroundColor: "#6d5dfc",
    textColor: "#ffffff",
    spacingTop: 36,
    spacingBottom: 36,
  },
  {
    id: "trust-main",
    type: "trust",
    enabled: true,
    title: "خرید مطمئن",
    subtitle: "پرداخت امن · پشتیبانی · ارسال قابل پیگیری",
    backgroundColor: "#ffffff",
    textColor: "#111827",
    spacingTop: 32,
    spacingBottom: 32,
  },
];

function legacySections(content: Record<string, any>): SectionConfig[] {
  const source = content.storeBuilderV15?.sections || content.storeBuilderV11?.sections;
  if (!Array.isArray(source) || !source.length) return sectionDefaults;
  return source.map((section: any, index: number) => {
    const type = section.type === "product-slider" ? "products" : section.type === "banner-grid" ? "banner" : section.type === "trust" ? "trust" : section.type;
    const safeType = ["products", "banner", "trust", "text", "spacer"].includes(type) ? type : "text";
    return {
      id: String(section.id || `section-${index}`),
      type: safeType,
      enabled: section.enabled !== false,
      title: String(section.title || "بخش فروشگاه"),
      subtitle: String(section.subtitle || ""),
      imageUrl: typeof section.imageUrl === "string" ? section.imageUrl : "",
      ctaLabel: typeof section.ctaLabel === "string" ? section.ctaLabel : "",
      backgroundColor: section.backgroundColor || designDefaults.backgroundColor,
      textColor: section.textColor || designDefaults.textColor,
      spacingTop: Number(section.spacingTop ?? designDefaults.sectionSpacing),
      spacingBottom: Number(section.spacingBottom ?? designDefaults.sectionSpacing),
      ...(safeType === "products" ? { productSettings: { ...defaultProductSettings, ...(section.productSettings || {}) } } : {}),
    } as SectionConfig;
  });
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
    },
    header: { ...headerDefaults, ...v16.header },
    hero: { ...heroDefaults, ...v16.hero },
    sections: Array.isArray(v16.sections) ? v16.sections : legacySections(content),
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
