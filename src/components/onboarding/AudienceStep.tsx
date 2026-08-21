import type { BrandForm, DnaForm } from "./types";

const goals = ["افزایش آگاهی از برند", "جذب مشتری جدید", "افزایش فروش", "تعامل بیشتر", "آموزش مخاطب", "سایر"];
export function AudienceStep({ dna, brand, onDnaChange, onBrandChange, errors }: { dna: DnaForm; brand: BrandForm; onDnaChange: (v: DnaForm) => void; onBrandChange: (v: BrandForm) => void; errors: Record<string, string> }) {
  const toggle = (goal: string) => onDnaChange({ ...dna, goals: dna.goals.includes(goal) ? dna.goals.filter((item) => item !== goal) : dna.goals.length < 3 ? [...dna.goals, goal] : dna.goals });
  return <div className="space-y-6">
    <label className="block"><span>مشتری اصلی شما چه کسی است؟</span><textarea autoFocus value={dna.targetAudience} maxLength={1000} rows={4} onChange={(e) => onDnaChange({ ...dna, targetAudience: e.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 p-4 outline-none focus:border-violet-400" />{errors.targetAudience && <p role="alert" className="mt-1 text-sm text-red-300">{errors.targetAudience}</p>}</label>
    <label className="block"><span>چه مسئله‌ای را برای مشتری حل می‌کنید؟</span><textarea value={brand.audienceProblem} maxLength={1000} rows={4} onChange={(e) => onBrandChange({ ...brand, audienceProblem: e.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 p-4 outline-none focus:border-violet-400" />{errors.audienceProblem && <p role="alert" className="mt-1 text-sm text-red-300">{errors.audienceProblem}</p>}</label>
    <fieldset><legend className="mb-3">هدف بازاریابی (حداکثر ۳ مورد، اختیاری)</legend><div className="flex flex-wrap gap-2">{goals.map((goal) => <button key={goal} type="button" aria-pressed={dna.goals.includes(goal)} onClick={() => toggle(goal)} className={`min-h-11 rounded-xl border px-4 text-sm ${dna.goals.includes(goal) ? "border-violet-400 bg-violet-500/20" : "border-white/10"}`}>{goal}</button>)}</div></fieldset>
  </div>;
}
