import type { SectionConfig, SiteKind } from "./types";

// One V16 core serves every site type. A site type does not get its own
// builder, canvas, renderer or publish flow — it only declares which
// capabilities it loads and which sections it may compose. Adding a vertical
// means adding a registry entry, not a branch in the renderer.

export type SiteCapability = "commerce" | "catalog" | "lead" | "team" | "content" | "portfolio";

export type SiteTypeDefinition = {
  kind: SiteKind;
  label: string;
  capabilities: readonly SiteCapability[];
  sectionTypes: readonly SectionConfig["type"][];
  /** Sections a brand-new project of this type starts with, in order. */
  defaultSectionIds: readonly string[];
};

export const SITE_TYPES: Record<SiteKind, SiteTypeDefinition> = {
  STORE: {
    kind: "STORE",
    label: "فروشگاه اینترنتی",
    capabilities: ["commerce", "catalog"],
    sectionTypes: ["products", "banner", "trust", "text", "spacer"],
    defaultSectionIds: ["products-main", "banner-main", "trust-main"],
  },
  BUSINESS: {
    kind: "BUSINESS",
    label: "سایت شرکتی",
    capabilities: ["lead", "team", "content", "portfolio"],
    sectionTypes: ["about", "services", "portfolio", "team", "text-image", "cta", "contact", "text", "spacer"],
    defaultSectionIds: ["about-main", "services-main", "portfolio-main", "team-main", "cta-main", "contact-main"],
  },
};

export const siteTypeDefinition = (kind: SiteKind | undefined): SiteTypeDefinition =>
  SITE_TYPES[(kind || "STORE") as SiteKind] || SITE_TYPES.STORE;

export const hasCapability = (kind: SiteKind | undefined, capability: SiteCapability): boolean =>
  siteTypeDefinition(kind).capabilities.includes(capability);

/** A corporate site must never load Commerce concepts. */
export const isCommerceSite = (kind: SiteKind | undefined): boolean => hasCapability(kind, "commerce");

export const allowsSectionType = (kind: SiteKind | undefined, type: SectionConfig["type"]): boolean =>
  siteTypeDefinition(kind).sectionTypes.includes(type);

/** Anchor used for in-page navigation and CTA targets. */
export const sectionAnchor = (section: Pick<SectionConfig, "id" | "anchor">): string =>
  String(section.anchor || section.id).replace(/[^a-zA-Z0-9_-]/g, "-");
