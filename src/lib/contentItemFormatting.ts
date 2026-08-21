type Content = Record<string, unknown>;
const lines = (values: unknown[]) => values.filter((value) => value !== undefined && value !== null && value !== "").map(String);
const list = (value: unknown) => Array.isArray(value) ? value.map(String) : [];

export function contentItemText(contractId: string, value: Content) {
  if (contractId === "social_post") return lines([value.hook, value.body, value.cta, ...list(value.hashtags)]).join("\n\n");
  if (contractId === "ad_copy") return [`تیترها:\n${list(value.headlines).join("\n")}`, `توضیحات:\n${list(value.descriptions).join("\n")}`, `CTA: ${String(value.ctaLabel || "")}`].join("\n\n");
  if (contractId === "marketing_email") return lines([`موضوع: ${String(value.subject || "")}`, `پیش‌نمایش: ${String(value.previewText || "")}`, value.greeting, ...list(value.bodySections), value.cta, value.signoff]).join("\n\n");
  if (contractId === "blog_outline") return lines([value.title, `SEO: ${String(value.seoTitle || "")}`, value.metaDescription, `کلیدواژه: ${String(value.primaryKeyword || "")}`, `Slug: ${String(value.slug || "")}`, ...(Array.isArray(value.sections) ? value.sections.flatMap((section) => { const item = section as Content; return [item.heading, ...list(item.keyPoints)]; }) : [])]).join("\n\n");
  if (contractId === "landing_page_copy") { const hero = (value.hero || {}) as Content; return lines([hero.headline, hero.subheadline, hero.cta, ...list(value.benefits), ...(Array.isArray(value.sections) ? value.sections.flatMap((section) => { const item = section as Content; return [item.heading, item.body]; }) : []), ...list(value.proofPoints), ...(Array.isArray(value.faq) ? value.faq.flatMap((entry) => { const item = entry as Content; return [item.question, item.answer]; }) : []), value.finalCta]).join("\n\n"); }
  return JSON.stringify(value, null, 2);
}

const md = (value: unknown) => [...String(value ?? "")].map((character) => "\\`*_{}[]<>#+.!|-".includes(character) ? `\\${character}` : character).join("");
export function contentItemMarkdown(title: string, contractId: string, value: Content) {
  return `# ${md(title)}\n\n${contentItemText(contractId, value).split("\n\n").map(md).join("\n\n")}`;
}

export function downloadContent(filename: string, content: string, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
}
