import type { BrandForm, BusinessForm, DnaForm, StepId } from "./types";

export function ReviewStep({ business, dna, brand, onEdit }: { business: BusinessForm; dna: DnaForm; brand: BrandForm; onEdit: (step: Exclude<StepId, "COMPLETE">) => void }) {
  const section = (title: string, step: Exclude<StepId, "COMPLETE">, values: string[]) => <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><div className="flex justify-between gap-4"><h2 className="font-semibold">{title}</h2><button type="button" onClick={() => onEdit(step)} className="min-h-11 text-sm text-violet-300">ویرایش</button></div><ul className="mt-2 space-y-1 text-sm leading-7 text-white/60">{values.filter(Boolean).map((item, index) => <li key={index}>{item}</li>)}</ul></section>;
  return <div className="grid gap-4 sm:grid-cols-2">
    {section("کسب‌وکار", "BUSINESS", [business.name || "اطلاعات کسب‌وکار تکمیل شده", business.industry, business.description])}
    {section("محصولات و خدمات", "OFFERING", [...dna.offerings, dna.valueProposition, ...dna.differentiators])}
    {section("مشتریان", "AUDIENCE", [dna.targetAudience, brand.audienceProblem, ...dna.goals])}
    {section("لحن برند", "BRAND", [...brand.personality, brand.tone, ...brand.keyPhrases])}
  </div>;
}
