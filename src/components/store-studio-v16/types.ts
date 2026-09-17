export type DeviceMode = "desktop" | "tablet" | "mobile";
export type SiteKind = "STORE" | "BUSINESS";
export type PageMode = "storefront" | "collection" | "product" | "cart" | "checkout" | "success";
export type ElementType =
  | "header"
  | "footer"
  | "hero"
  | "section"
  | "product-card"
  | "banner"
  | "trust"
  | "collection"
  | "product"
  | "cart"
  | "checkout"
  | "success";

export type Selection = { type: ElementType; id: string | null };

export type Product = {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  brand?: string | null;
  category?: string | null;
  featured?: boolean;
  createdAt?: string;
  currency: string;
  basePriceMinor: number;
  compareAtPriceMinor?: number | null;
  metadata?: { gallery?: string[]; geoDescription?: string; contentMode?: "SEO" | "GEO" | "HYBRID"; [key: string]: unknown };
  variants?: Array<{ id?: string; sku?: string; title?: string; priceMinor?: number | null; inventoryQuantity: number; inventoryPolicy?: string; imageUrl?: string | null; purchasable?: boolean }>;
};

export type MediaAsset = { id: string; name: string; url: string; kind?: string };
export type ProductOverride = { title?: string; imageUrl?: string; regularPriceMinor?: number; compareAtPriceMinor?: number | null; promotionBadge?: boolean; promotionBadgeText?: string; showDiscountPercentage?: boolean; showStock?: boolean; ctaLabel?: string; ctaStyle?: "solid" | "outline" | "soft"; imageRatio?: "square" | "portrait" | "landscape" | "auto"; textAlign?: "right" | "center"; cardRadius?: number; cardShadowStrength?: number; borderStrength?: number; cardPadding?: number };
export type CommerceConfig = { currency: string; showCoupon: boolean; freeShippingThresholdMinor: number; shippingLabel: string; paymentMode: "MANUAL" | "ONLINE"; orderSuccessTitle: string; cartButtonLabel: string; checkoutButtonLabel: string; productOverrides: Record<string, ProductOverride> };
export type DesignConfig = { fontFamily: string; primaryColor: string; secondaryColor: string; textColor: string; mutedTextColor: string; backgroundColor: string; surfaceColor: string; containerWidth: number; sectionSpacing: number; globalRadius: number; cardRadius: number; buttonRadius: number; headingScale: number; bodyScale: number; cardShadowStrength: number; borderStrength: number };
export type HeaderConfig = { logoUrl: string; storeName: string; showSearch: boolean; showAccount: boolean; showCart: boolean; sticky: boolean; height: number; backgroundColor: string; textColor: string };
export type HeroConfig = { enabled: boolean; layout: "centered" | "split" | "background" | "minimal"; eyebrow: string; title: string; subtitle: string; ctaLabel: string; ctaHref: string; imageUrl: string; backgroundColor: string; textColor: string; overlayOpacity: number; height: number; alignment: "right" | "center" | "left" };
export type ProductSettings = { source: "featured" | "latest" | "bestselling" | "discounted" | "manual"; productIds: string[]; columnsDesktop: number; columnsTablet: number; columnsMobile: number; imageRatio: "square" | "portrait" | "landscape" | "auto"; cardStyle: "vertical" | "compact" | "horizontal" | "minimal"; showBrand: boolean; showPrice: boolean; showCompareAt: boolean; showStock: boolean; showPromotionBadge: boolean; showCartButton: boolean };
/** A repeatable entry inside a services / team / portfolio section. */
export type SectionItem = { id: string; title: string; subtitle?: string; body?: string; imageUrl?: string; meta?: string; href?: string };
export type ContactConfig = { formEnabled: boolean; submitLabel: string; successMessage: string; phone?: string; email?: string; address?: string; mapUrl?: string };
export type SeoConfig = { title: string; description: string };
/** A page owns its address, its sections, its SEO and its navigation visibility.
 *  Theme, header, footer and navigation identity stay site-wide. */
export type PageConfig = { id: string; title: string; slug: string; isHome: boolean; showInNav: boolean; navLabel: string; seo: SeoConfig; sections: SectionConfig[] };
export type FooterConfig = { enabled: boolean; text: string; backgroundColor: string; textColor: string };
export type NavConfig = { enabled: boolean; ctaLabel: string; ctaHref: string };
// visibleProductCount and productImageSize are deliberately siblings of
// productSettings, not fields inside it: productSettings is Commerce-adjacent
// protected truth in the V16 patch policy, so it can never be reached by a
// structured patch (Ask Loadder included). These two are the only
// patch-reachable presentation levers over a products section's display.
export type SectionConfig = { id: string; type: "products" | "banner" | "trust" | "text" | "spacer" | "about" | "services" | "portfolio" | "team" | "text-image" | "cta" | "contact"; enabled: boolean; title: string; subtitle: string; body?: string; imageUrl?: string; ctaLabel?: string; ctaHref?: string; anchor?: string; navLabel?: string; showInNav?: boolean; columns?: number; mediaPosition?: "start" | "end"; items?: SectionItem[]; contact?: ContactConfig; backgroundColor: string; textColor: string; spacingTop: number; spacingBottom: number; productSettings?: ProductSettings; visibleProductCount?: number; productImageSize?: "regular" | "large" };
export type StudioConfig = { version: 16; siteKind: SiteKind; activePage: PageMode; activePageId: string; selectedElement: Selection; design: DesignConfig; header: HeaderConfig; hero: HeroConfig; nav: NavConfig; footer: FooterConfig; seo: SeoConfig; sections: SectionConfig[]; pages: PageConfig[]; commerce: CommerceConfig };
export type ProductView = { title: string; imageUrl: string; regularPriceMinor: number; compareAtPriceMinor: number | null; promotionBadge: boolean; promotionBadgeText: string; showDiscountPercentage: boolean; showStock: boolean; ctaLabel: string; ctaStyle: "solid" | "outline" | "soft"; imageRatio: "square" | "portrait" | "landscape" | "auto"; textAlign: "right" | "center"; cardRadius: number; cardShadowStrength: number; borderStrength: number; cardPadding: number };
export type StudioActions = { select: (selection: Selection) => void; patchDesign: (patch: Partial<DesignConfig>) => void; patchHeader: (patch: Partial<HeaderConfig>) => void; patchHero: (patch: Partial<HeroConfig>) => void; patchSection: (id: string, patch: Partial<SectionConfig>) => void; patchProduct: (id: string, patch: Partial<ProductOverride>) => void; patchCommerce: (patch: Partial<CommerceConfig>) => void; patchSeo: (patch: Partial<SeoConfig>) => void; patchNav: (patch: Partial<NavConfig>) => void; patchFooter: (patch: Partial<FooterConfig>) => void; patchSectionItem: (sectionId: string, itemId: string, patch: Partial<SectionItem>) => void; selectPage: (pageId: string) => void; addPage: () => void; patchPage: (pageId: string, patch: Partial<PageConfig>) => void; deletePage: (pageId: string) => void; movePage: (pageId: string, delta: number) => void };
