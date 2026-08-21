import { BoundedListEditor } from "./BoundedListEditor";
import type { DnaForm, StepProps } from "./types";

export function OfferingStep({ value, onChange, errors }: StepProps<DnaForm>) {
  return <div className="space-y-6">
    <BoundedListEditor label="محصولات یا خدمات" values={value.offerings} onChange={(offerings) => onChange({ ...value, offerings })} maxItems={10} maxLength={200} error={errors.offerings} />
    <label className="block"><span>ارزش اصلی که برای مشتری ایجاد می‌کنید</span><textarea autoFocus value={value.valueProposition} maxLength={500} rows={4} onChange={(e) => onChange({ ...value, valueProposition: e.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 p-4 outline-none focus:border-violet-400" />{errors.valueProposition && <p role="alert" className="mt-1 text-sm text-red-300">{errors.valueProposition}</p>}</label>
    <BoundedListEditor label="دلیل انتخاب شما" values={value.differentiators} onChange={(differentiators) => onChange({ ...value, differentiators })} maxItems={5} maxLength={300} error={errors.differentiators} />
  </div>;
}
