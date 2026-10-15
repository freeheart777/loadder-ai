import { withActivePageSections, activePageOf } from "./pages";
import type { SectionConfig, SectionItem, StudioConfig } from "./types";

// Editable field registry: the closed list of EXISTING document fields a customer may edit directly on the canvas.
// It describes the V16 document, it does not extend it. Every write produces exactly the document the Inspector's
// own update actions would produce (patchHero / patchHeader / patchFooter / patchSection / patchSectionItem), so the
// Inspector and inline editing stay two views of one state.
//
// Boundaries enforced here (a request outside them is rejected, never coerced):
//  - only fields listed below, so prices, stock, links, booking ids, media URLs and commerce settings are unreachable;
//  - only the ACTIVE page's sections, and the Hero only where the canvas renders it (Home on business sites);
//  - only enabled sections / enabled hero / enabled footer, because hidden content has no editing surface;
//  - plain text only: no markup is stored, control characters are dropped, Persian text and ZWNJ are preserved.

export type EditableFieldRef =
  | { scope: "hero"; field: "eyebrow" | "title" | "subtitle" | "ctaLabel" }
  | { scope: "header"; field: "storeName" }
  | { scope: "footer"; field: "text" }
  | { scope: "section"; sectionId: string; field: "title" | "subtitle" | "body" | "ctaLabel" }
  | { scope: "item"; sectionId: string; itemId: string; field: "title" | "subtitle" | "body" };

export type EditableFieldSpec = { multiline: boolean; maxLength: number };

const SINGLE = 200;
const MULTI = 2000;

type SectionType = SectionConfig["type"];
type SectionField = "title" | "subtitle" | "body" | "ctaLabel";

// What each section type actually renders on the canvas and on the published site.
const BUSINESS_SECTION_FIELDS: Partial<Record<SectionType, readonly SectionField[]>> = {
  about: ["title", "subtitle", "body"],
  "text-image": ["title", "subtitle", "body"],
  text: ["title", "subtitle", "body"],
  services: ["title", "subtitle"],
  team: ["title", "subtitle"],
  portfolio: ["title", "subtitle"],
  cta: ["title", "subtitle", "ctaLabel"],
  contact: ["title", "subtitle"],   // `body` is added below only while the contact form is switched off (the only time it renders)
};
const STORE_SECTION_FIELDS: Partial<Record<SectionType, readonly SectionField[]>> = {
  products: ["title", "subtitle"],
  banner: ["title", "subtitle"],
  trust: ["title", "subtitle"],
  text: ["title", "subtitle", "body"],
  "category-grid": ["title", "subtitle"],
  brand: ["title", "subtitle"],
};
const ITEM_TYPES: readonly SectionType[] = ["services", "team", "portfolio"];
const ITEM_FIELDS = ["title", "subtitle", "body"] as const;
const MULTILINE: ReadonlySet<string> = new Set(["body"]);

const isHome = (config: StudioConfig) => config.pages[0]?.id === config.activePageId;

/** Plain text normalisation. Keeps letters, digits, ZWNJ (U+200C), ZWJ (U+200D) and spaces; drops other control characters. */
export function normalizeFieldText(value: unknown, multiline: boolean, maxLength = multiline ? MULTI : SINGLE): string {
  let text = String(value ?? "").replace(/\r\n?/g, "\n");
  // Control characters (except tab and newline), bidi overrides/isolates and the BOM are never stored.
  text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩﻿]/g, "");
  text = multiline ? text.replace(/[ \t]*\n[ \t]*/g, "\n").replace(/\n{3,}/g, "\n\n") : text.replace(/[\n\t]+/g, " ");
  return text.slice(0, maxLength);
}

function sectionOf(config: StudioConfig, sectionId: string): SectionConfig | null {
  const page = activePageOf(config);
  return page?.sections.find((section) => section.id === sectionId) ?? null;
}

function sectionFields(config: StudioConfig, section: SectionConfig): readonly SectionField[] {
  const table = config.siteKind === "STORE" ? STORE_SECTION_FIELDS : BUSINESS_SECTION_FIELDS;
  const base = table[section.type] ?? [];
  if (config.siteKind !== "STORE" && section.type === "contact" && section.contact?.formEnabled === false) return [...base, "body"];
  return base;
}

/** The spec of an editable field, or null when the field is not editable in this document right now. */
export function describeField(config: StudioConfig, ref: EditableFieldRef): EditableFieldSpec | null {
  if (!config || !ref || typeof ref !== "object") return null;
  const spec = (field: string): EditableFieldSpec => ({ multiline: MULTILINE.has(field), maxLength: MULTILINE.has(field) ? MULTI : SINGLE });
  switch (ref.scope) {
    case "hero":
      if (!config.hero?.enabled || !["eyebrow", "title", "subtitle", "ctaLabel"].includes(ref.field)) return null;
      if (config.siteKind !== "STORE" && !isHome(config)) return null;   // the business canvas renders the Hero on Home only
      return spec(ref.field);
    case "header":
      return ref.field === "storeName" ? spec(ref.field) : null;
    case "footer":
      return config.siteKind !== "STORE" && config.footer?.enabled && ref.field === "text" ? spec(ref.field) : null;
    case "section": {
      const section = sectionOf(config, ref.sectionId);
      if (!section || !section.enabled) return null;
      return sectionFields(config, section).includes(ref.field) ? spec(ref.field) : null;
    }
    case "item": {
      const section = sectionOf(config, ref.sectionId);
      if (!section || !section.enabled || config.siteKind === "STORE" || !ITEM_TYPES.includes(section.type)) return null;
      if (!(ITEM_FIELDS as readonly string[]).includes(ref.field)) return null;
      return (section.items ?? []).some((item) => item.id === ref.itemId) ? spec(ref.field) : null;
    }
    default:
      return null;
  }
}

/** The current text of an editable field, or null when it is not editable. */
export function readField(config: StudioConfig, ref: EditableFieldRef): string | null {
  if (!describeField(config, ref)) return null;
  switch (ref.scope) {
    case "hero": return String(config.hero[ref.field] ?? "");
    case "header": return String(config.header[ref.field] ?? "");
    case "footer": return String(config.footer[ref.field] ?? "");
    case "section": return String(sectionOf(config, ref.sectionId)?.[ref.field] ?? "");
    case "item": return String(sectionOf(config, ref.sectionId)?.items?.find((item) => item.id === ref.itemId)?.[ref.field] ?? "");
    default: return null;
  }
}

/**
 * Apply an edit. Returns the next document, or null when the field is not editable (nothing changes then).
 * An unchanged value returns the SAME object so callers never create a history step or a dirty state.
 */
export function writeField(config: StudioConfig, ref: EditableFieldRef, value: string): StudioConfig | null {
  const spec = describeField(config, ref);
  if (!spec) return null;
  const text = normalizeFieldText(value, spec.multiline, spec.maxLength);
  if (readField(config, ref) === text) return config;
  switch (ref.scope) {
    case "hero": return { ...config, hero: { ...config.hero, [ref.field]: text } };
    case "header": return { ...config, header: { ...config.header, [ref.field]: text } };
    case "footer": return { ...config, footer: { ...config.footer, [ref.field]: text } };
    case "section":
      return withActivePageSections(config, activePageOf(config).sections.map((section) => (section.id === ref.sectionId ? { ...section, [ref.field]: text } : section)));
    case "item":
      return withActivePageSections(config, activePageOf(config).sections.map((section) => (section.id === ref.sectionId
        ? { ...section, items: (section.items || []).map((item: SectionItem) => (item.id === ref.itemId ? { ...item, [ref.field]: text } : item)) }
        : section)));
    default:
      return null;
  }
}

/** Every field editable on the active page right now, in document order. Used by tests and by "is anything editable here". */
export function listEditableFields(config: StudioConfig): EditableFieldRef[] {
  const out: EditableFieldRef[] = [];
  const push = (ref: EditableFieldRef) => { if (describeField(config, ref)) out.push(ref); };
  push({ scope: "header", field: "storeName" });
  for (const field of ["eyebrow", "title", "subtitle", "ctaLabel"] as const) push({ scope: "hero", field });
  for (const section of activePageOf(config)?.sections ?? []) {
    for (const field of ["title", "subtitle", "body", "ctaLabel"] as const) push({ scope: "section", sectionId: section.id, field });
    for (const item of section.items ?? []) for (const field of ITEM_FIELDS) push({ scope: "item", sectionId: section.id, itemId: item.id, field });
  }
  push({ scope: "footer", field: "text" });
  return out;
}
