export type DeviceMode = "desktop" | "tablet" | "mobile";
export type PageMode = "storefront" | "collection" | "product" | "cart" | "checkout" | "success";
export type ElementType =
  | "header"
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
  variants?: Array<{ id?: string; title?: string; inventoryQuantity: number; imageUrl?: string | null }>;
};

export type MediaAsset = { id: string; name: string; url: string; kind?: string };
export type ProductOverride = { title?: string; imageUrl?: string; regularPriceMinor?: number; compareAtPriceMinor?: number | null; promotionBadge?: boolean; promotionBadgeText?: string; showDiscountPercentage?: boolean; showStock?: boolean; ctaLabel?: string; ctaStyle?: "solid" | "outline" | "soft"; imageRatio?: "square" | "portrait" | "landscape" | "auto"; textAlign?: "right" | "center"; cardRadius?: number; cardShadowStrength?: number; borderStrength?: number; cardPadding?: number };
export type CommerceConfig = { currency: string; showCoupon: boolean; freeShippingThresholdMinor: number; shippingLabel: string; paymentMode: "MANUAL" | "ONLINE"; orderSuccessTitle: string; cartButtonLabel: string; checkoutButtonLabel: string; productOverrides: Record<string, ProductOverride> };
export type DesignConfig = { fontFamily: string; primaryColor: string; secondaryColor: string; textColor: string; mutedTextColor: string; backgroundColor: string; surfaceColor: string; containerWidth: number; sectionSpacing: number; globalRadius: number; cardRadius: number; buttonRadius: number; headingScale: number; bodyScale: number; cardShadowStrength: number; borderStrength: number };
export type HeaderConfig = { logoUrl: string; storeName: string; showSearch: boolean; showAccount: boolean; showCart: boolean; sticky: boolean; height: number; backgroundColor: string; textColor: string };
export type HeroConfig = { enabled: boolean; layout: "centered" | "split" | "background" | "minimal"; eyebrow: string; title: string; subtitle: string; ctaLabel: string; ctaHref: string; imageUrl: string; backgroundColor: string; textColor: string; overlayOpacity: number; height: number; alignment: "right" | "center" | "left" };
export type ProductSettings = { source: "featured" | "latest" | "bestselling" | "discounted" | "manual"; productIds: string[]; columnsDesktop: number; columnsTablet: number; columnsMobile: number; imageRatio: "square" | "portrait" | "landscape" | "auto"; cardStyle: "vertical" | "compact" | "horizontal" | "minimal"; showBrand: boolean; showPrice: boolean; showCompareAt: boolean; showStock: boolean; showPromotionBadge: boolean; showCartButton: boolean };
export type SectionConfig = { id: string; type: "products" | "banner" | "trust" | "text" | "spacer"; enabled: boolean; title: string; subtitle: string; imageUrl?: string; ctaLabel?: string; backgroundColor: string; textColor: string; spacingTop: number; spacingBottom: number; productSettings?: ProductSettings };
export type StudioConfig = { version: 16; activePage: PageMode; selectedElement: Selection; design: DesignConfig; header: HeaderConfig; hero: HeroConfig; sections: SectionConfig[]; commerce: CommerceConfig };
export type ProductView = { title: string; imageUrl: string; regularPriceMinor: number; compareAtPriceMinor: number | null; promotionBadge: boolean; promotionBadgeText: string; showDiscountPercentage: boolean; showStock: boolean; ctaLabel: string; ctaStyle: "solid" | "outline" | "soft"; imageRatio: "square" | "portrait" | "landscape" | "auto"; textAlign: "right" | "center"; cardRadius: number; cardShadowStrength: number; borderStrength: number; cardPadding: number };
export type StudioActions = { select: (selection: Selection) => void; patchDesign: (patch: Partial<DesignConfig>) => void; patchHeader: (patch: Partial<HeaderConfig>) => void; patchHero: (patch: Partial<HeroConfig>) => void; patchSection: (id: string, patch: Partial<SectionConfig>) => void; patchProduct: (id: string, patch: Partial<ProductOverride>) => void; patchCommerce: (patch: Partial<CommerceConfig>) => void };
