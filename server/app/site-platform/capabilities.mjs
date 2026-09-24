import { createRegistry, defineCapability } from "./registry.mjs";

// Initial capability metadata (ADR-004, WEBSITE_COMPONENT_ARCHITECTURE.md).
// Every section type the V16 builder renders today is registered here through
// its legacy alias. Metadata only: the existing renderers stay authoritative.

const COMMON = ["title", "subtitle", "backgroundColor", "textColor", "spacingTop", "spacingBottom"];

export const coreCapability = defineCapability({
  key: "core",
  label: "هسته سایت",
  sections: [
    { type: "core.about", label: "درباره ما", aliases: ["about"], fields: [...COMMON, "body", "imageUrl", "mediaPosition"] },
    { type: "core.services", label: "خدمات", aliases: ["services"], variants: ["cards"], fields: [...COMMON, "columns", "items"] },
    { type: "core.portfolio", label: "نمونه‌کارها", aliases: ["portfolio"], variants: ["cards"], fields: [...COMMON, "columns", "items"] },
    { type: "core.textImage", label: "متن و تصویر", aliases: ["text-image"], variants: ["mediaStart", "mediaEnd"], fields: [...COMMON, "body", "imageUrl", "mediaPosition"] },
    { type: "core.cta", label: "دعوت به اقدام", aliases: ["cta"], fields: [...COMMON, "ctaLabel", "ctaHref"] },
    { type: "core.contact", label: "تماس", aliases: ["contact"], fields: [...COMMON, "contact"], interactive: true },
    { type: "core.richText", label: "متن", aliases: ["text"], fields: COMMON },
    { type: "core.spacer", label: "فاصله", aliases: ["spacer"], fields: ["spacingTop", "spacingBottom"] },
    { type: "core.bannerGroup", label: "بنر", aliases: ["banner"], fields: [...COMMON, "imageUrl", "ctaLabel", "ctaHref"] },
    { type: "core.trust", label: "اعتماد و ضمانت", aliases: ["trust"], fields: COMMON },
    { type: "core.categoryGrid", label: "دسته‌بندی‌ها", aliases: ["category-grid"], variants: ["tiles"], fields: [...COMMON, "items"] },
    { type: "core.logoWall", label: "برندها", aliases: ["brand"], variants: ["tiles"], fields: [...COMMON, "items"] },
  ],
});

// Required so the existing corporate "team" section keeps a registered home.
// BUSINESS and LEGAL sites already resolve the people capability (legacy "team").
export const peopleCapability = defineCapability({
  key: "people",
  label: "افراد و تیم",
  sections: [
    { type: "people.profileGrid", label: "تیم", aliases: ["team"], variants: ["cards"], fields: [...COMMON, "columns", "items"] },
  ],
});

export const paymentsCapability = defineCapability({
  key: "payments",
  label: "پرداخت",
  status: "internal",
});

export const commerceCapability = defineCapability({
  key: "commerce",
  label: "فروشگاه",
  dependencies: ["payments"],
  sections: [
    {
      type: "commerce.productShelf",
      label: "محصولات",
      aliases: ["products"],
      variants: ["grid"],
      fields: [...COMMON, "productSettings", "visibleProductCount", "productImageSize", "saleLabel", "saleEndsAt"],
      seo: { structuredData: "ItemList" },
    },
  ],
});

export const INITIAL_CAPABILITIES = Object.freeze([coreCapability, peopleCapability, paymentsCapability, commerceCapability]);

export const siteRegistry = createRegistry(INITIAL_CAPABILITIES);
