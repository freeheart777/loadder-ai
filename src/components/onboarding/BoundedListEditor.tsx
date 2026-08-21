export function BoundedListEditor({
  label, values, onChange, maxItems, maxLength, error, optional = false,
}: {
  label: string; values: string[]; onChange: (values: string[]) => void;
  maxItems: number; maxLength: number; error?: string; optional?: boolean;
}) {
  const update = (index: number, value: string) => onChange(values.map((item, itemIndex) => itemIndex === index ? value : item));
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-white/75">{label}{optional ? " (اختیاری)" : ""}</legend>
      {values.map((value, index) => (
        <div key={index} className="flex gap-2">
          <input aria-label={`${label} ${index + 1}`} value={value} maxLength={maxLength}
            onChange={(event) => update(index, event.target.value)}
            className="min-h-11 flex-1 rounded-xl border border-white/10 bg-black/25 px-4 text-white outline-none focus:border-violet-400" />
          {values.length > (optional ? 0 : 1) && <button type="button" aria-label={`حذف ${label} ${index + 1}`}
            onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}
            className="min-h-11 rounded-xl border border-white/10 px-4 text-white/60">حذف</button>}
        </div>
      ))}
      {values.length < maxItems && <button type="button" onClick={() => onChange([...values, ""])}
        className="min-h-11 rounded-xl border border-violet-400/25 px-4 text-sm text-violet-200">افزودن مورد</button>}
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    </fieldset>
  );
}
