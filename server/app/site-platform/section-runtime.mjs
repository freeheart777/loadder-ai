import { siteRegistry } from "./capabilities.mjs";
import { readPages } from "../services/site-page-model.mjs";

// ADR-004 section runtime model (PR 4A). Read-only: mirrors how the current
// renderers walk a published document, without producing HTML and without
// rewriting or cloning stored content. Not used by renderers or routes yet.

/** Renderer limits (store-public-presentation.mjs projectSections / projectPages). */
export const MAX_SECTIONS_PER_PAGE = 100;
export const MAX_PAGES = 50;

/** corporate-site-html.mjs CORPORATE_TYPES (kept in sync by an agreement test). */
const CORPORATE_TYPES = new Set(["about", "services", "portfolio", "team", "text-image", "cta", "contact"]);

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const siteTypeOf = (project) => String(project?.siteType || "").toUpperCase();

/** Which renderer renderPublishedSite would pick (isCorporateV16, then isStoreV16, else legacy). */
export function sectionWalkMode(project, content) {
  const v16 = content?.storeBuilderV16;
  if (siteTypeOf(project) === "BUSINESS" && v16 && typeof v16 === "object") {
    const every = [
      ...(Array.isArray(v16.sections) ? v16.sections : []),
      ...(Array.isArray(v16.pages) ? v16.pages.flatMap((page) => (Array.isArray(page?.sections) ? page.sections : [])) : []),
    ];
    if (every.some((section) => CORPORATE_TYPES.has(section?.type))) return "corporate";
  }
  if (siteTypeOf(project) === "STORE" && v16 && typeof v16 === "object" && Array.isArray(v16.sections) && v16.sections.length > 0) return "store";
  return "legacy";
}

function runtimeSection(source, index, page) {
  const fields = isObject(source) ? source : {};
  const legacyType = fields.type ?? null;
  const type = siteRegistry.resolveSectionType(legacyType);
  return Object.freeze({
    pageId: page.id,
    pageSlug: page.slug,
    index,
    id: typeof fields.id === "string" ? fields.id : null,
    legacyType,
    type,
    capability: type ? siteRegistry.capabilityOf(type) : null,
    known: type !== null,
    enabled: fields.enabled !== false,
    source,
  });
}

const limitSections = (sections) => (Array.isArray(sections) ? sections.slice(0, MAX_SECTIONS_PER_PAGE) : []);

/** Pages as the renderer sees them; section arrays hold the stored objects by reference. */
function pagesFor(mode, v16) {
  if (mode === "store") return [{ id: "page-home", slug: "", isHome: true, sections: limitSections(v16.sections) }];
  if (mode !== "corporate") return [];
  // Same shape the corporate renderer passes to readPages: the projection keeps no
  // stored page id, so page ids come out as readPages assigns them.
  const pages = Array.isArray(v16.pages)
    ? v16.pages.slice(0, MAX_PAGES).map((page, index) => {
      const fields = isObject(page) ? page : {};
      return { title: fields.title, slug: index === 0 ? "" : fields.slug, showInNav: fields.showInNav, navLabel: fields.navLabel, sections: limitSections(fields.sections) };
    })
    : undefined;
  return readPages({ seo: v16.seo, sections: limitSections(v16.sections), pages })
    .map((page) => ({ id: page.id, slug: page.slug, isHome: page.isHome, sections: page.sections }));
}

/**
 * Normalize a site's sections into the runtime model.
 * Disabled and unknown sections are returned (flagged), never dropped.
 * @returns {{ mode: "store" | "corporate" | "legacy", pages: { id, slug, isHome, sections: object[] }[], sectionTypes: string[], unknownSectionTypes: string[] }}
 */
export function normalizeSiteSections(project, content) {
  const mode = sectionWalkMode(project, content);
  const pages = pagesFor(mode, content?.storeBuilderV16).map((page) => Object.freeze({
    id: page.id,
    slug: page.slug,
    isHome: page.isHome,
    sections: Object.freeze(page.sections.map((source, index) => runtimeSection(source, index, page))),
  }));
  const rendered = pages.flatMap((page) => page.sections.filter((section) => section.enabled));
  return Object.freeze({
    mode,
    pages: Object.freeze(pages),
    sectionTypes: [...new Set(rendered.filter((section) => section.known).map((section) => section.type))].sort(),
    unknownSectionTypes: [...new Set(rendered.filter((section) => !section.known && typeof section.legacyType === "string" && section.legacyType).map((section) => section.legacyType))].sort(),
  });
}

/** Sections a renderer would actually output for one page (enabled, in order). */
export const renderedSections = (page) => (page?.sections || []).filter((section) => section.enabled);
