import React from "react";
type CatalogItem = {
  componentId: string;
  componentVersion: number;
  displayName: string;
  description: string;
  allowedProps: Record<string, string[]>;
  defaults: Record<string, string>;
  allowedSectionTypes: string[];
};
type Selection = {
  componentId: string;
  componentVersion: number;
  props: Record<string, string>;
} | null;
const labels: Record<string, string> = {
  AURORA: "شفق",
  HALO: "هاله",
  HORIZONTAL: "افقی",
  DIAGONAL: "مورب",
  DIAMONDS: "لوزی",
  CHEVRON: "شکسته",
  SPARSE: "خلوت",
  MEDIUM: "متوسط",
  DENSE: "متراکم",
  SUBTLE: "ملایم",
  BALANCED: "متعادل",
  STRONG: "قوی",
  PRIMARY: "رنگ اصلی",
  SECONDARY: "رنگ دوم",
  MUTED: "رنگ خنثی",
};
const fieldLabels: Record<string, string> = {
  variant: "حالت",
  orientation: "جهت",
  pattern: "الگو",
  density: "تراکم",
  intensity: "شدت",
  accentToken: "رنگ برند",
};
export default function VisualStyleSelector({
  catalog,
  sectionType,
  current,
  suggested,
  busy,
  onApply,
  onRemove,
}: {
  catalog: CatalogItem[];
  sectionType: string;
  current: Selection;
  suggested?: Selection;
  busy: boolean;
  onApply: (
    item: CatalogItem,
    props: Record<string, string>,
    replace: boolean,
  ) => void;
  onRemove: () => void;
}) {
  const choices = catalog.filter((item) =>
      item.allowedSectionTypes.includes(sectionType),
    ),
    selected =
      choices.find((item) => item.componentId === suggested?.componentId) ||
      choices.find((item) => item.componentId === current?.componentId) ||
      choices[0] ||
      null;
  const initial = selected
    ? {
        ...selected.defaults,
        ...(suggested?.componentId === selected.componentId
          ? suggested.props
          : current?.componentId === selected.componentId
            ? current.props
            : {}),
      }
    : {};
  const [componentId, setComponentId] = React.useState(
      selected?.componentId || "",
    ),
    [props, setProps] = React.useState<Record<string, string>>(initial);
  const item = choices.find((x) => x.componentId === componentId) || null;
  if (!choices.length)
    return (
      <section
        aria-label="سبک بصری"
        className="rounded-2xl border border-white/10 p-4 text-sm text-white/50"
      >
        برای این نوع بخش، سبک بصری قابل انتخاب نیست.
      </section>
    );
  return (
    <section
      aria-label="سبک بصری"
      className="space-y-3 rounded-2xl border border-white/10 p-4"
    >
      <div>
        <h3 className="text-sm font-semibold">سبک بصری</h3>
        <p className="mt-1 text-xs text-white/45">
          یک پس‌زمینه کنترل‌شده انتخاب کنید؛ تغییر فقط با اعمال صریح ذخیره
          می‌شود.
        </p>
      </div>
      <div
        role="radiogroup"
        aria-label="انتخاب سبک"
        className="grid gap-2 sm:grid-cols-3"
      >
        {choices.map((choice) => (
          <button
            key={choice.componentId}
            type="button"
            role="radio"
            aria-checked={componentId === choice.componentId}
            onClick={() => {
              setComponentId(choice.componentId);
              setProps({ ...choice.defaults });
            }}
            className={`min-h-20 rounded-xl border p-3 text-right focus:outline-none focus:ring-2 focus:ring-violet-400 ${componentId === choice.componentId ? "border-violet-400 bg-violet-500/15" : "border-white/10 bg-white/[.03]"}`}
          >
            <span className="block text-sm font-medium">
              {choice.displayName}
            </span>
            <span className="mt-1 block text-[11px] text-white/45">
              {choice.description}
            </span>
          </button>
        ))}
      </div>
      {item && (
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(item.allowedProps).map(([key, values]) => (
            <label key={key} className="text-xs">
              {fieldLabels[key] || key}
              <select
                value={props[key] || item.defaults[key] || values[0]}
                onChange={(e) =>
                  setProps((x) => ({ ...x, [key]: e.target.value }))
                }
                className="mt-1 min-h-11 w-full rounded-xl bg-[#0a0d1a] p-2"
              >
                {values.map((value) => (
                  <option key={value} value={value}>
                    {labels[value] || value}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !item}
          onClick={() => item && onApply(item, props, Boolean(current))}
          className="min-h-11 rounded-xl bg-violet-600 px-4 disabled:opacity-40"
        >
          {current ? "جایگزینی سبک" : "اعمال سبک"}
        </button>
        {current && (
          <button
            type="button"
            disabled={busy}
            onClick={onRemove}
            className="min-h-11 rounded-xl border border-red-400/30 px-4 text-red-200"
          >
            حذف سبک
          </button>
        )}
      </div>
    </section>
  );
}
