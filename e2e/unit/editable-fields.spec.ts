import { expect, test } from "@playwright/test";
import { describeField, listEditableFields, normalizeFieldText, readField, writeField, type EditableFieldRef } from "../../src/components/store-studio-v16/editable-fields";
import { activePageOf, withActivePageSections, withPages } from "../../src/components/store-studio-v16/pages";
import { createConfigFromTemplate, TEMPLATES } from "../../src/components/store-studio-v16/templates/registry";
import type { StudioConfig } from "../../src/components/store-studio-v16/types";

// Pure unit tests (no browser): the editable-field registry against every shipped template.
const byId = (id: string) => TEMPLATES.find((template) => template.id === id)!;
const configFor = (id: string) => createConfigFromTemplate(byId(id));
const BUSINESS = ["medical-practice-v1", "corporate-company-v1", "legal-firm-v1", "education-center-v1", "hybrid-business-v1", "nava-medical-v1"];

for (const id of BUSINESS) {
  test(`${id}: every listed field reads, writes and round-trips like the Inspector would`, () => {
    const config = configFor(id);
    const fields = listEditableFields(config);
    expect(fields.length, "something is editable on Home").toBeGreaterThan(3);
    for (const ref of fields) {
      const before = readField(config, ref);
      expect(before, JSON.stringify(ref)).not.toBeNull();
      const next = writeField(config, ref, "متن‌ تازه ۱۲۳ ab");
      expect(next, JSON.stringify(ref)).not.toBeNull();
      expect(readField(next!, ref)).toBe("متن‌ تازه ۱۲۳ ab");
      expect(config, "input is never mutated").toEqual(configFor(id));
    }
  });
}

test("hero write equals the Inspector's patchHero result; section and item writes equal patchSection / patchSectionItem", () => {
  const config = configFor("medical-practice-v1");
  expect(writeField(config, { scope: "hero", field: "title" }, "عنوان جدید")).toEqual({ ...config, hero: { ...config.hero, title: "عنوان جدید" } });
  expect(writeField(config, { scope: "header", field: "storeName" }, "کلینیک من")).toEqual({ ...config, header: { ...config.header, storeName: "کلینیک من" } });
  expect(writeField(config, { scope: "footer", field: "text" }, "پانوشت")).toEqual({ ...config, footer: { ...config.footer, text: "پانوشت" } });
  const section = activePageOf(config).sections.find((s) => (s.items ?? []).length > 0)!;
  const item = section.items![0];
  const viaPatch = withActivePageSections(config, activePageOf(config).sections.map((s) => s.id === section.id ? { ...s, items: (s.items || []).map((e) => e.id === item.id ? { ...e, title: "خدمت جدید" } : e) } : s));
  expect(writeField(config, { scope: "item", sectionId: section.id, itemId: item.id, field: "title" }, "خدمت جدید")).toEqual(viaPatch);
  const viaSection = withActivePageSections(config, activePageOf(config).sections.map((s) => s.id === section.id ? { ...s, title: "عنوان بخش" } : s));
  expect(writeField(config, { scope: "section", sectionId: section.id, field: "title" }, "عنوان بخش")).toEqual(viaSection);
});

test("Persian text and ZWNJ are preserved; control and bidi-override characters are dropped; plain text only", () => {
  const config = configFor("corporate-company-v1");
  const ref: EditableFieldRef = { scope: "hero", field: "title" };
  const persian = "می‌خواهم خانه‌ام را ببینم ‌۱۲۳";
  expect(readField(writeField(config, ref, persian)!, ref)).toBe(persian);
  expect(normalizeFieldText("a\u0000b‮c⁦d﻿e", false)).toBe("abcde");
  expect(normalizeFieldText("سطر اول\n\n\n\nسطر دوم  \n  سوم", true)).toBe("سطر اول\n\nسطر دوم\nسوم");
  expect(normalizeFieldText("یک\nدو", false)).toBe("یک دو");
  // Markup is text, never interpreted or stripped into structure.
  expect(readField(writeField(config, ref, "<b>x</b>")!, ref)).toBe("<b>x</b>");
  expect(readField(writeField(config, ref, "x".repeat(5000))!, ref)!.length).toBe(200);
});

test("unchanged value returns the same document (no history step, no dirty state)", () => {
  const config = configFor("medical-practice-v1");
  const ref: EditableFieldRef = { scope: "hero", field: "title" };
  expect(writeField(config, ref, readField(config, ref)!)).toBe(config);
});

test("unknown fields, unknown ids and unsupported scopes are rejected", () => {
  const config = configFor("medical-practice-v1");
  const section = activePageOf(config).sections[0];
  const bad: unknown[] = [
    { scope: "hero", field: "imageUrl" }, { scope: "hero", field: "ctaHref" }, { scope: "header", field: "logoUrl" },
    { scope: "section", sectionId: section.id, field: "imageUrl" }, { scope: "section", sectionId: section.id, field: "ctaHref" },
    { scope: "section", sectionId: "nope", field: "title" }, { scope: "item", sectionId: section.id, itemId: "nope", field: "title" },
    { scope: "item", sectionId: section.id, itemId: "x", field: "bookingServiceId" }, { scope: "design", field: "primaryColor" },
    { scope: "section", sectionId: section.id, field: "__proto__" }, null, undefined, "title", 5,
  ];
  for (const ref of bad) {
    expect(describeField(config, ref as EditableFieldRef), JSON.stringify(ref)).toBeNull();
    expect(writeField(config, ref as EditableFieldRef, "x"), JSON.stringify(ref)).toBeNull();
    expect(readField(config, ref as EditableFieldRef)).toBeNull();
  }
  // items only exist in services / team / portfolio
  const aboutLike = activePageOf(config).sections.find((s) => s.type === "about");
  if (aboutLike) expect(describeField(config, { scope: "item", sectionId: aboutLike.id, itemId: "x", field: "title" })).toBeNull();
});

test("active-page boundary: a section or the Hero of another page is not editable", () => {
  let config = configFor("corporate-company-v1");
  const home = config.pages[0];
  const homeSection = home.sections[0];
  config = withPages(config, [...config.pages, { id: "page-b", title: "درباره", slug: "about", isHome: false, showInNav: true, navLabel: "", seo: { title: "", description: "" }, sections: [{ ...homeSection, id: "b-sec", title: "بخش صفحه دوم" }] }]);
  const onB: StudioConfig = { ...config, activePageId: "page-b" };
  expect(describeField(onB, { scope: "hero", field: "title" }), "business Hero belongs to Home").toBeNull();
  expect(describeField(onB, { scope: "section", sectionId: homeSection.id, field: "title" }), "Home section from page B").toBeNull();
  expect(writeField(onB, { scope: "section", sectionId: homeSection.id, field: "title" }, "x")).toBeNull();
  expect(describeField(onB, { scope: "section", sectionId: "b-sec", field: "title" })).not.toBeNull();
  expect(describeField(config, { scope: "section", sectionId: "b-sec", field: "title" }), "page B section from Home").toBeNull();
  const edited = writeField(onB, { scope: "section", sectionId: "b-sec", field: "title" }, "تازه")!;
  expect(edited.pages[0].sections, "Home sections untouched").toEqual(config.pages[0].sections);
  expect(edited.pages[1].sections[0].title).toBe("تازه");
});

test("disabled sections, a disabled hero and a disabled footer have no editing surface", () => {
  const config = configFor("legal-firm-v1");
  const section = activePageOf(config).sections[0];
  const hiddenSection = withActivePageSections(config, activePageOf(config).sections.map((s) => s.id === section.id ? { ...s, enabled: false } : s));
  expect(describeField(hiddenSection, { scope: "section", sectionId: section.id, field: "title" })).toBeNull();
  expect(describeField({ ...config, hero: { ...config.hero, enabled: false } }, { scope: "hero", field: "title" })).toBeNull();
  expect(describeField({ ...config, footer: { ...config.footer, enabled: false } }, { scope: "footer", field: "text" })).toBeNull();
});

test("contact body is editable only while the contact form is off (the only time it renders)", () => {
  const config = configFor("corporate-company-v1");
  const contact = activePageOf(config).sections.find((s) => s.type === "contact");
  test.skip(!contact, "template has no contact section");
  const ref: EditableFieldRef = { scope: "section", sectionId: contact!.id, field: "body" };
  const formOn = withActivePageSections(config, activePageOf(config).sections.map((s) => s.id === contact!.id ? { ...s, contact: { ...(s.contact as object), formEnabled: true } as never } : s));
  const formOff = withActivePageSections(config, activePageOf(config).sections.map((s) => s.id === contact!.id ? { ...s, contact: { ...(s.contact as object), formEnabled: false } as never } : s));
  expect(describeField(formOn, ref)).toBeNull();
  expect(describeField(formOff, ref)).not.toBeNull();
});

test("Store: hero, header and section headings are editable; products, prices and commerce settings are not reachable", () => {
  const config = configFor("commerce-modern-v1");
  expect(config.siteKind).toBe("STORE");
  const fields = listEditableFields(config);
  expect(fields.some((f) => f.scope === "hero" && f.field === "title")).toBe(true);
  expect(fields.some((f) => f.scope === "header")).toBe(true);
  expect(fields.every((f) => f.scope !== "item" && f.scope !== "footer"), "no items or footer text on the store").toBe(true);
  const sections = activePageOf(config).sections;
  const products = sections.find((s) => s.type === "products");
  expect(products).toBeTruthy();
  for (const field of ["productSettings", "visibleProductCount", "saleEndsAt", "saleLabel", "ctaHref", "imageUrl", "items"]) {
    expect(writeField(config, { scope: "section", sectionId: products!.id, field } as never, "x"), field).toBeNull();
  }
  for (const field of ["currency", "paymentMode", "shippingLabel", "freeShippingThresholdMinor", "productOverrides"]) {
    expect(describeField(config, { scope: "commerce", field } as never), field).toBeNull();
  }
  const edited = writeField(config, { scope: "section", sectionId: products!.id, field: "title" }, "پرفروش‌ها")!;
  expect(edited.commerce).toEqual(config.commerce);
  expect(edited.pages[0].sections.find((s) => s.id === products!.id)!.productSettings).toEqual(products!.productSettings);
});

test("Home mirror stays in sync: editing a Home section updates config.sections as the Inspector does", () => {
  const config = configFor("medical-practice-v1");
  const section = config.pages[0].sections[0];
  const edited = writeField(config, { scope: "section", sectionId: section.id, field: "title" }, "جدید")!;
  expect(edited.sections).toBe(edited.pages[0].sections);
  expect(edited.sections[0].title).toBe("جدید");
});
