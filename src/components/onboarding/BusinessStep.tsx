import type { BusinessForm, StepProps } from "./types";

const industries = ["فروشگاه اینترنتی", "خدمات حرفه‌ای", "آموزش", "فناوری", "سلامت و زیبایی", "غذا و رستوران", "سایر"];
const fieldClass = "mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-white outline-none focus:border-violet-400";

export function BusinessStep({ value, onChange, errors }: StepProps<BusinessForm>) {
  const set = (field: keyof BusinessForm, next: string) => onChange({ ...value, [field]: next });
  return <div className="grid gap-5">
    <label><span>نام کسب‌وکار</span><input autoFocus value={value.name} maxLength={120} onChange={(e) => set("name", e.target.value)} className={fieldClass} aria-describedby={errors.name ? "business-name-error" : undefined} />{errors.name && <p id="business-name-error" role="alert" className="mt-1 text-sm text-red-300">{errors.name}</p>}</label>
    <label><span>حوزه فعالیت</span><input value={value.industry} maxLength={120} list="industry-presets" onChange={(e) => set("industry", e.target.value)} className={fieldClass} /><datalist id="industry-presets">{industries.map((item) => <option key={item} value={item} />)}</datalist>{errors.industry && <p role="alert" className="mt-1 text-sm text-red-300">{errors.industry}</p>}</label>
    <label><span>معرفی کوتاه کسب‌وکار</span><textarea value={value.description} maxLength={1000} rows={4} onChange={(e) => set("description", e.target.value)} className={`${fieldClass} py-3`} />{errors.description && <p role="alert" className="mt-1 text-sm text-red-300">{errors.description}</p>}</label>
    <div className="grid gap-5 sm:grid-cols-2">
      <label><span>وب‌سایت (اختیاری)</span><input dir="ltr" value={value.website} maxLength={500} placeholder="https://example.com" onChange={(e) => set("website", e.target.value)} className={fieldClass} />{errors.website && <p role="alert" className="mt-1 text-sm text-red-300">{errors.website}</p>}</label>
      <label><span>بازار یا کشور (اختیاری)</span><input value={value.country} maxLength={100} onChange={(e) => set("country", e.target.value)} className={fieldClass} /></label>
    </div>
    <label><span>زبان اصلی محتوا (اختیاری)</span><input value={value.primaryLanguage} maxLength={40} onChange={(e) => set("primaryLanguage", e.target.value)} className={fieldClass} /></label>
  </div>;
}
