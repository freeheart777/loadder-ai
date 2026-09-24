import { defaultProductSettings } from "../config";
import type { WebsiteTemplate } from "./types";

/**
 * Loadder Commerce Modern V1 — the first commercial ecommerce template.
 * Plain data only: hero + trust + flash-sale + category-grid + product-grid
 * + brand, in the order a modern storefront reference (Stitch) lays them out.
 * saleEndsAt is left unset here — a template never carries a moving deadline;
 * the merchant sets one after creating their site from this seed.
 */
export const commerceModernV1: WebsiteTemplate = {
  id: "commerce-modern-v1",
  label: "Loadder Commerce Modern V1",
  description: "قالب فروشگاهی مدرن با فروش ویژه، دسته‌بندی، محصولات منتخب و برندها.",
  siteKind: "STORE",
  hero: {
    enabled: true,
    layout: "split",
    eyebrow: "فروشگاه آنلاین مدرن",
    title: "کالای مورد نظرتان را با بهترین قیمت پیدا کنید",
    subtitle: "ارسال سریع، پرداخت امن و ضمانت بازگشت روی تمام سفارش‌ها.",
    ctaLabel: "مشاهده محصولات",
    ctaHref: "#products-main",
    alignment: "right",
  },
  footer: {
    enabled: true,
    text: "© تمامی حقوق این فروشگاه محفوظ است.",
  },
  sections: [
    {
      id: "trust-main",
      type: "trust",
      enabled: true,
      title: "خرید مطمئن از این فروشگاه",
      subtitle: "پرداخت امن · ارسال سریع · ضمانت بازگشت کالا",
      backgroundColor: "#ffffff",
      textColor: "#0f172a",
      spacingTop: 20,
      spacingBottom: 20,
    },
    {
      id: "flash-sale-main",
      type: "products",
      enabled: true,
      title: "فروش شگفت‌انگیز",
      subtitle: "پیشنهادهای ویژه با تخفیف محدود",
      saleLabel: "فروش ویژه",
      backgroundColor: "#fff1f2",
      textColor: "#881337",
      spacingTop: 28,
      spacingBottom: 36,
      visibleProductCount: 8,
      productSettings: {
        ...defaultProductSettings,
        source: "discounted",
        columnsDesktop: 4,
        columnsTablet: 3,
        columnsMobile: 2,
        showCompareAt: true,
        showPromotionBadge: true,
        showCartButton: true,
      },
    },
    {
      id: "category-grid-main",
      type: "category-grid",
      enabled: true,
      title: "دسته‌بندی‌های پرطرفدار",
      subtitle: "مسیر سریع‌تر برای پیدا کردن کالای مورد نظر",
      backgroundColor: "#ffffff",
      textColor: "#0f172a",
      spacingTop: 28,
      spacingBottom: 28,
      items: [
        { id: "category-1", title: "پوشاک", imageUrl: "", href: "#products-main" },
        { id: "category-2", title: "لوازم دیجیتال", imageUrl: "", href: "#products-main" },
        { id: "category-3", title: "خانه و آشپزخانه", imageUrl: "", href: "#products-main" },
        { id: "category-4", title: "زیبایی و سلامت", imageUrl: "", href: "#products-main" },
      ],
    },
    {
      id: "products-main",
      type: "products",
      enabled: true,
      title: "محصولات منتخب",
      subtitle: "جدیدترین و پرفروش‌ترین کالاهای فروشگاه",
      backgroundColor: "#f8fafc",
      textColor: "#0f172a",
      spacingTop: 28,
      spacingBottom: 36,
      visibleProductCount: 8,
      productSettings: {
        ...defaultProductSettings,
        source: "featured",
        columnsDesktop: 4,
        columnsTablet: 3,
        columnsMobile: 2,
      },
    },
    {
      id: "brand-main",
      type: "brand",
      enabled: true,
      title: "برندهای معتبر همکار",
      subtitle: "",
      backgroundColor: "#ffffff",
      textColor: "#0f172a",
      spacingTop: 24,
      spacingBottom: 32,
      items: [
        { id: "brand-1", title: "برند یک", imageUrl: "", href: "#products-main" },
        { id: "brand-2", title: "برند دو", imageUrl: "", href: "#products-main" },
        { id: "brand-3", title: "برند سه", imageUrl: "", href: "#products-main" },
      ],
    },
  ],
};
