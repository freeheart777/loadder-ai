export type WebsiteArchetype =
  | "store"
  | "corporate"
  | "catalog"
  | "doctor"
  | "lawyer"
  | "custom";

export type WebsiteCapability =
  | "commerce"
  | "catalog"
  | "booking"
  | "lead"
  | "team"
  | "content"
  | "location"
  | "forms"
  | "analytics"
  | "ads"
  | "landing";

export type WebsitePageKind =
  | "standard"
  | "product"
  | "collection"
  | "catalog"
  | "booking"
  | "contact"
  | "landing";

export type BrandContextProvenance =
  | "brand-book"
  | "business-proposal"
  | "business-dna"
  | "website-intake"
  | "catalog"
  | "upload"
  | "user-edit"
  | "ai-generated";

export type WebsiteAttribution = {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
  clickId?: string;
};

export type WebsiteConversionGoal = {
  id: string;
  name: string;
  event: WebsiteAnalyticsEventName;
  destination?: string;
};

export type WebsiteLandingConfig = {
  campaignId?: string;
  offer?: string;
  audience?: string;
  minimalNavigation: boolean;
  preserveAttribution: boolean;
  conversionGoalIds: string[];
  variantKey?: string;
};

export type WebsitePageDefinition = {
  id: string;
  slug: string;
  title: string;
  kind: WebsitePageKind;
  enabled: boolean;
  landing?: WebsiteLandingConfig;
};

export type WebsiteAnalyticsProvider = "google-analytics" | "loadder" | "custom";
export type WebsiteAdsProvider = "google-ads" | "custom";

export type GoogleAnalyticsConfig = {
  provider: "google-analytics";
  enabled: boolean;
  measurementId: string;
  trackPreview: boolean;
};

export type WebsiteAnalyticsIntegration =
  | GoogleAnalyticsConfig
  | {
      provider: "loadder" | "custom";
      enabled: boolean;
      publicKey?: string;
      trackPreview: boolean;
    };

export type GoogleAdsConfig = {
  provider: "google-ads";
  enabled: boolean;
  conversionId?: string;
  conversionLabel?: string;
};

export type WebsiteAdsIntegration =
  | GoogleAdsConfig
  | {
      provider: "custom";
      enabled: boolean;
      publicKey?: string;
    };

export type WebsiteIntegrationConfig = {
  analytics: WebsiteAnalyticsIntegration[];
  ads: WebsiteAdsIntegration[];
};

export type WebsiteAnalyticsEventName =
  | "page_view"
  | "lead_submit"
  | "booking_start"
  | "booking_complete"
  | "view_item"
  | "add_to_cart"
  | "begin_checkout"
  | "purchase"
  | "cta_click";

export type WebsiteAnalyticsEvent = {
  name: WebsiteAnalyticsEventName;
  pageId?: string;
  valueMinor?: number;
  currency?: string;
  attribution?: WebsiteAttribution;
  metadata?: Record<string, string | number | boolean | null>;
};

export type WebsiteBrandContext = {
  businessName?: string;
  positioning?: string;
  audience?: string[];
  valueProposition?: string;
  offers?: string[];
  toneOfVoice?: string;
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
  provenance: BrandContextProvenance[];
  version?: string;
};

export type WebsitePlatformDefinition = {
  schemaVersion: 1;
  archetype: WebsiteArchetype;
  capabilities: WebsiteCapability[];
  brandContext?: WebsiteBrandContext;
  pages: WebsitePageDefinition[];
  integrations: WebsiteIntegrationConfig;
  conversionGoals: WebsiteConversionGoal[];
};

export const defaultCapabilitiesByArchetype: Record<WebsiteArchetype, WebsiteCapability[]> = {
  store: ["commerce", "catalog", "forms", "analytics", "ads", "landing"],
  corporate: ["lead", "team", "content", "forms", "analytics", "ads", "landing"],
  catalog: ["catalog", "lead", "forms", "analytics", "ads", "landing"],
  doctor: ["booking", "lead", "location", "content", "forms", "analytics", "ads", "landing"],
  lawyer: ["booking", "lead", "team", "content", "forms", "analytics", "ads", "landing"],
  custom: ["forms", "analytics", "landing"],
};

export function createLandingPageDefinition(input: {
  id: string;
  slug: string;
  title: string;
  campaignId?: string;
  offer?: string;
  audience?: string;
  conversionGoalIds?: string[];
}): WebsitePageDefinition {
  return {
    id: input.id,
    slug: input.slug,
    title: input.title,
    kind: "landing",
    enabled: true,
    landing: {
      campaignId: input.campaignId,
      offer: input.offer,
      audience: input.audience,
      minimalNavigation: true,
      preserveAttribution: true,
      conversionGoalIds: input.conversionGoalIds ?? [],
    },
  };
}

export function shouldTrackWebsitePreview(integration: WebsiteAnalyticsIntegration) {
  return integration.enabled && integration.trackPreview;
}
