import type { CommerceConfig, DesignConfig, FooterConfig, HeaderConfig, HeroConfig, NavConfig, SectionConfig, SeoConfig, SiteKind } from "../types";

/**
 * An immutable seed for a new site's StudioConfig. A template is plain data —
 * no logic, no AI call, no reference to any existing project's content.
 * Applying a template produces an editable StudioConfig through the exact
 * same restoreConfig() path a saved draft already goes through; the template
 * object itself is never mutated by that process.
 */
export type WebsiteTemplate = {
  id: string;
  label: string;
  description: string;
  siteKind: SiteKind;
  design?: Partial<DesignConfig>;
  header?: Partial<HeaderConfig>;
  hero?: Partial<HeroConfig>;
  nav?: Partial<NavConfig>;
  footer?: Partial<FooterConfig>;
  seo?: Partial<SeoConfig>;
  commerce?: Partial<CommerceConfig>;
  sections: SectionConfig[];
};
