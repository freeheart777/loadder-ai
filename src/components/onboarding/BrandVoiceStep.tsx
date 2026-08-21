import { BoundedListEditor } from "./BoundedListEditor";
import type { BrandForm, StepProps } from "./types";

const personalities = ["حرفه‌ای", "صمیمی", "جسور", "ممتاز", "آموزشی", "ساده", "پرانرژی", "قابل‌اعتماد"];
const tones = ["حرفه‌ای و صمیمی", "ساده و روشن", "گرم و قابل‌اعتماد", "جسور و پرانرژی", "آموزشی و دقیق"];
export function BrandVoiceStep({ value, onChange, errors }: StepProps<BrandForm>) {
  const toggle = (item: string) => onChange({ ...value, personality: value.personality.includes(item) ? value.personality.filter((entry) => entry !== item) : value.personality.length < 4 ? [...value.personality, item] : value.personality });
  return <div className="space-y-6">
    <fieldset><legend className="mb-3">شخصیت برند (۲ تا ۴ مورد)</legend><div className="flex flex-wrap gap-2">{personalities.map((item) => <button key={item} type="button" aria-pressed={value.personality.includes(item)} onClick={() => toggle(item)} className={`min-h-11 rounded-xl border px-4 ${value.personality.includes(item) ? "border-violet-400 bg-violet-500/20" : "border-white/10"}`}>{item}</button>)}</div>{errors.personality && <p role="alert" className="mt-2 text-sm text-red-300">{errors.personality}</p>}</fieldset>
    <label className="block"><span>لحن و سبک بیان برند</span><input autoFocus value={value.tone} maxLength={300} list="tone-presets" onChange={(e) => onChange({ ...value, tone: e.target.value })} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/25 px-4 outline-none focus:border-violet-400" /><datalist id="tone-presets">{tones.map((tone) => <option key={tone} value={tone} />)}</datalist>{errors.tone && <p role="alert" className="mt-1 text-sm text-red-300">{errors.tone}</p>}</label>
    <BoundedListEditor optional label="عبارت‌های پیشنهادی" values={value.keyPhrases} onChange={(keyPhrases) => onChange({ ...value, keyPhrases })} maxItems={10} maxLength={500} error={errors.keyPhrases} />
    <BoundedListEditor optional label="لودر هرگز چه ادعایی درباره کسب‌وکارتان نکند؟" values={value.prohibitedPatterns} onChange={(prohibitedPatterns) => onChange({ ...value, prohibitedPatterns })} maxItems={10} maxLength={300} error={errors.prohibitedPatterns} />
  </div>;
}
