const labels: Record<string, string> = { hook: "هوک", body: "بدنه", cta: "دعوت به اقدام", hashtags: "هشتگ‌ها", headlines: "تیترها", descriptions: "توضیحات", ctaLabel: "برچسب CTA", subject: "موضوع", previewText: "متن پیش‌نمایش", greeting: "سلام", bodySections: "بخش‌های بدنه", signoff: "امضا", title: "عنوان مقاله", seoTitle: "عنوان سئو", metaDescription: "توضیح متا", primaryKeyword: "کلیدواژه اصلی", slug: "Slug", benefits: "مزایا", proofPoints: "شواهد", finalCta: "CTA پایانی", hero: "بخش اصلی", sections: "بخش‌ها", faq: "پرسش‌های متداول", headline: "تیتر", subheadline: "زیرتیتر", heading: "عنوان بخش", keyPoints: "نکات کلیدی", question: "پرسش", answer: "پاسخ" };

export default function ContractContentEditor({ value, onChange }: { value: Record<string, unknown>; onChange: (value: Record<string, unknown>) => void }) {
  const set = (field: string, next: unknown) => onChange({ ...value, [field]: next });
  return <div className="grid gap-4">{Object.entries(value).map(([field, current]) => <div key={field}><label className="mb-2 block text-sm text-white/55">{labels[field] || field}</label><ValueEditor field={field} value={current} onChange={(next) => set(field, next)}/></div>)}</div>;
}

function ValueEditor({ field, value, onChange }: { field: string; value: unknown; onChange: (value: unknown) => void }) {
  if (typeof value === "string") return <textarea dir={field === "slug" ? "ltr" : "rtl"} value={value} onChange={(event) => onChange(event.target.value)} rows={field === "body" ? 6 : 3} className="w-full rounded-xl border border-white/10 bg-black/20 p-3"/>;
  if (Array.isArray(value) && value.every((entry) => typeof entry === "string")) return <textarea value={value.join("\n")} onChange={(event) => onChange(event.target.value.split("\n"))} rows={Math.max(3, value.length)} className="w-full rounded-xl border border-white/10 bg-black/20 p-3"/>;
  if (Array.isArray(value)) return <div className="space-y-3">{value.map((entry, index) => <div key={index} className="rounded-xl border border-white/10 p-3"><ValueEditor field={`${field}-${index}`} value={entry} onChange={(next) => onChange(value.map((item, itemIndex) => itemIndex === index ? next : item))}/></div>)}</div>;
  if (value && typeof value === "object") return <div className="grid gap-3">{Object.entries(value as Record<string, unknown>).map(([child, current]) => <div key={child}><label className="mb-1 block text-xs text-white/40">{labels[child] || child}</label><ValueEditor field={child} value={current} onChange={(next) => onChange({ ...(value as Record<string, unknown>), [child]: next })}/></div>)}</div>;
  return null;
}
