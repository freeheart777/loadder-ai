import { restoreConfig } from "../config";
import type { StudioConfig } from "../types";
import { commerceModernV1 } from "./commerce-modern-v1";
import type { WebsiteTemplate } from "./types";

/** The full set of templates a new site can be created from. Adding a template means adding an entry here — no other file changes. */
export const TEMPLATES: readonly WebsiteTemplate[] = [commerceModernV1];

export const findTemplate = (id: string): WebsiteTemplate | undefined => TEMPLATES.find((template) => template.id === id);

/**
 * Applies a template to produce a brand-new, editable StudioConfig.
 * The template object itself is read-only input here — it is never mutated,
 * and the returned config is a fresh object built by feeding the template's
 * fields through the exact same restoreConfig() normalization a saved draft
 * already goes through, so a templated site behaves identically to a
 * hand-built one from the very first render.
 *
 * structuredClone() deep-copies every field (including nested arrays like a
 * section's `items`) before it ever reaches restoreConfig(), so no array or
 * object below the top level can end up shared with the template seed —
 * restoreConfig() itself only shallow-copies sections, which would otherwise
 * leave nested fields like `items` pointing at the template's own arrays.
 */
export function createConfigFromTemplate(template: WebsiteTemplate): StudioConfig {
  const content = structuredClone({
    storeBuilderV16: {
      design: template.design,
      header: template.header,
      hero: template.hero,
      nav: template.nav,
      footer: template.footer,
      seo: template.seo,
      commerce: template.commerce,
      sections: template.sections,
    },
  });
  return restoreConfig(content, template.siteKind);
}
