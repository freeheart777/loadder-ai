import { expect, test } from "@playwright/test";
import { restoreConfig } from "../../src/components/store-studio-v16/config";
import { createConfigFromTemplate, TEMPLATES } from "../../src/components/store-studio-v16/templates/registry";
import type { SectionConfig, StudioConfig } from "../../src/components/store-studio-v16/types";
import { EDITOR_ONLY } from "../support/editor-only-copy";

// Batch A (customer readiness). Pure unit tests, no browser: what a NEWLY created starter website publishes.
// A starter is published as-is until the customer edits it, so its enabled content must read like a website,
// not like instructions to the editor, and optional sections that hold no real content must not be published.
const BUSINESS = ["medical-practice-v1", "legal-firm-v1", "education-center-v1", "corporate-company-v1", "hybrid-business-v1"] as const;
const byId = (id: string) => TEMPLATES.find((template) => template.id === id)!;
const configFor = (id: string): StudioConfig => createConfigFromTemplate(byId(id));


// Top-level sections plus every page's sections. A single-page document mirrors its sections into the home page,
// so the list is de-duplicated by section id (the first occurrence wins).
const sectionsOf = (config: StudioConfig): SectionConfig[] => {
  const seen = new Set<string>();
  return [...config.sections, ...(config.pages ?? []).flatMap((page) => page.sections)].filter((section) => !seen.has(section.id) && Boolean(seen.add(section.id)));
};
const strings = (value: unknown, out: string[] = []): string[] => {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((entry) => strings(entry, out));
  else if (value && typeof value === "object") Object.values(value).forEach((entry) => strings(entry, out));
  return out;
};
// Everything a visitor can read: hero, header, footer, SEO, navigation and every ENABLED section.
const visitorText = (config: StudioConfig): string[] => [
  ...strings(config.hero), ...strings(config.header), ...strings(config.footer), ...strings(config.nav), ...strings(config.seo),
  ...strings((config.pages ?? []).map((page) => ({ title: page.title, navLabel: page.navLabel, seo: page.seo }))),
  ...strings(sectionsOf(config).filter((section) => section.enabled)),
];

for (const id of BUSINESS) {
  test(`${id}: a newly created starter exposes no editor-only instruction to visitors`, () => {
    const text = visitorText(configFor(id));
    expect(text.length).toBeGreaterThan(10);
    for (const [label, pattern] of EDITOR_ONLY) {
      const hits = text.filter((entry) => pattern.test(entry));
      expect(hits, `${id} publishes a ${label}`).toEqual([]);
    }
  });

  test(`${id}: the starter keeps meaningful, populated content`, () => {
    const config = configFor(id);
    const enabled = sectionsOf(config).filter((section) => section.enabled);
    expect(config.hero.title.trim().length).toBeGreaterThan(8);
    expect(config.hero.subtitle.trim().length).toBeGreaterThan(20);
    expect(config.hero.ctaLabel.trim().length).toBeGreaterThan(0);
    expect(enabled.length).toBeGreaterThanOrEqual(4);
    // At least one card section with several fully written entries.
    const cardSections = enabled.filter((section) => (section.items?.length ?? 0) >= 2);
    expect(cardSections.length).toBeGreaterThanOrEqual(1);
    for (const section of cardSections) {
      for (const item of section.items ?? []) {
        expect(item.title.trim(), `${section.id} item title`).not.toBe("");
        expect((item.body ?? "").trim().length, `${section.id}/${item.id} body`).toBeGreaterThan(15);
      }
      // No two entries in one section are verbatim copies of each other (that is filler, not content).
      const keys = (section.items ?? []).map((item) => [item.title, item.subtitle, item.body].join("|"));
      expect(new Set(keys).size, `${section.id} has duplicated entries`).toBe(keys.length);
    }
    // Every enabled section says something: a title plus a body, items, a call to action or a form.
    for (const section of enabled) {
      const hasContent = Boolean(section.body?.trim()) || (section.items?.length ?? 0) > 0 || Boolean(section.ctaLabel?.trim()) || Boolean(section.contact?.formEnabled) || Boolean(section.subtitle?.trim());
      expect(hasContent, `${section.id} is enabled but empty`).toBe(true);
      expect(section.title.trim(), `${section.id} title`).not.toBe("");
    }
    // The visitor can always reach the business: the starter ends in a working contact form.
    expect(enabled.some((section) => section.type === "contact" && section.contact?.formEnabled)).toBe(true);
  });
}

test("optional sections that hold only an instruction start disabled, everything else stays enabled", () => {
  const disabledOf = (id: string) => sectionsOf(configFor(id)).filter((section) => !section.enabled).map((section) => section.id).sort();
  expect(disabledOf("medical-practice-v1")).toEqual(["testimonials-main"]);
  // Education is multi-page: its home page replaces the top-level sections, so the (also disabled) top-level testimonials never reach a created site.
  expect(disabledOf("education-center-v1")).toEqual([]);
  expect(disabledOf("corporate-company-v1")).toEqual(["clients-main"]);
  expect(disabledOf("legal-firm-v1")).toEqual([]);
  expect(disabledOf("hybrid-business-v1")).toEqual([]);
  // They are still part of the document (nothing is deleted): the customer turns them on in the Studio.
  expect(sectionsOf(configFor("medical-practice-v1")).some((section) => section.id === "testimonials-main")).toBe(true);
});

test("populated starter sections stay enabled and in the menu", () => {
  const medical = configFor("medical-practice-v1");
  const ids = medical.sections.filter((section) => section.enabled).map((section) => section.id);
  expect(ids).toEqual(expect.arrayContaining(["doctor-main", "services-main", "treatments-main", "booking-cta", "contact-main"]));
  // The disabled testimonials entry must not leave a dead link in the menu: navigation is derived from enabled sections.
  expect(medical.sections.find((section) => section.id === "testimonials-main")!.enabled).toBe(false);
  const legal = configFor("legal-firm-v1");
  expect(legal.sections.filter((section) => section.enabled).map((section) => section.id)).toEqual(expect.arrayContaining(["attorneys-main", "practice-main", "cases-main", "articles-main", "contact-main"]));
  const hybrid = configFor("hybrid-business-v1");
  expect(hybrid.sections.filter((section) => section.enabled).map((section) => section.id)).toEqual(expect.arrayContaining(["services-main", "products-main", "about-main", "projects-main", "inquiry-cta", "contact-main"]));
});

test("existing saved websites are restored untouched, including their own copy and enabled sections", () => {
  // A site created BEFORE this change keeps the old starter wording the customer may never have edited, plus content
  // the customer wrote. Restoring it must not drop, hide or rewrite any of that.
  const saved = {
    storeBuilderV16: {
      version: 16,
      sections: [
        { id: "doctor-main", type: "team", enabled: true, title: "پزشکان ما", subtitle: "برای شروع آماده و قابل ویرایش است.", showInNav: true, navLabel: "پزشکان", items: [{ id: "d1", title: "پزشک متخصص", subtitle: "حوزه تخصص پزشک", body: "معرفی کوتاه پزشک و روزهای حضور در کلینیک را اینجا بنویسید.", imageUrl: "", meta: "" }] },
        { id: "testimonials-main", type: "text", enabled: true, title: "تجربه مراجعان", subtitle: "نظر شما", showInNav: true, navLabel: "نظرات", body: "متن نوشته‌شده توسط مشتری درباره تجربه درمان." },
        { id: "clients-main", type: "text", enabled: true, title: "مشتریان", subtitle: "", showInNav: true, navLabel: "مشتریان", body: "تجربه مشتریان خود را پس از دریافت بازخورد در این بخش منتشر کنید." },
      ],
    },
  };
  const restored = restoreConfig(structuredClone(saved), "BUSINESS");
  const byIdMap = new Map(restored.sections.map((section) => [section.id, section]));
  expect(byIdMap.get("doctor-main")!.subtitle).toBe("برای شروع آماده و قابل ویرایش است.");
  expect(byIdMap.get("doctor-main")!.items![0].body).toBe("معرفی کوتاه پزشک و روزهای حضور در کلینیک را اینجا بنویسید.");
  expect(byIdMap.get("testimonials-main")!.enabled).toBe(true);
  expect(byIdMap.get("testimonials-main")!.body).toBe("متن نوشته‌شده توسط مشتری درباره تجربه درمان.");
  expect(byIdMap.get("clients-main")!.enabled).toBe(true);
});

test("creating a starter never mutates the shared template", () => {
  for (const id of BUSINESS) {
    const before = JSON.stringify(byId(id));
    const config = configFor(id);
    sectionsOf(config).forEach((section) => { section.title = "changed"; section.items?.forEach((item) => { item.title = "changed"; }); });
    expect(JSON.stringify(byId(id)), `${id} template was mutated`).toBe(before);
    expect(JSON.stringify(configFor(id))).toBe(JSON.stringify(configFor(id)));
  }
});

test("capability boundaries are unchanged: Commerce stays Store-only, no template gained or lost one", () => {
  expect(byId("hybrid-business-v1").siteType).toBe("HYBRID");
  expect(byId("hybrid-business-v1").commerce).toBeUndefined();
  expect(byId("medical-practice-v1").siteType).toBe("MEDICAL");
  expect(byId("medical-practice-v1").nav).toMatchObject({ ctaHref: "/booking" });
  expect(byId("medical-practice-v1").hero).toMatchObject({ ctaHref: "/booking" });
  expect(byId("education-center-v1").hero).toMatchObject({ ctaHref: "/booking" });
  expect(byId("legal-firm-v1").hero).toMatchObject({ ctaHref: "#contact-main" });
  expect(byId("commerce-modern-v1").siteKind).toBe("STORE");
});

test("re-enabling a disabled starter section keeps it intact: same content, enabled, round-trips through save and restore", () => {
  for (const [templateId, sectionId, title] of [["medical-practice-v1", "testimonials-main", "تجربه مراجعان"], ["corporate-company-v1", "clients-main", "مشتریان و شرکای ما"]] as const) {
    const config = configFor(templateId);
    const section = config.sections.find((candidate) => candidate.id === sectionId)!;
    expect(section.enabled, `${sectionId} starts disabled`).toBe(false);
    const before = JSON.stringify({ ...section, enabled: true });
    // What the Studio does when the customer ticks the section on, then saves and reopens the document.
    section.enabled = true;
    const saved = JSON.parse(JSON.stringify({ storeBuilderV16: config }));
    const reopened = restoreConfig(saved, "BUSINESS").sections.find((candidate) => candidate.id === sectionId)!;
    expect(reopened.enabled).toBe(true);
    expect(reopened.title).toBe(title);
    expect(reopened.showInNav).not.toBe(false);
    expect(JSON.stringify(reopened)).toBe(before);
  }
});
