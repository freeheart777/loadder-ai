export type VisualCandidate = {
  componentId: string;
  componentVersion: number;
  displayName: string;
  props: Record<string, string>;
  fitPosture: string;
  reasonCodes: string[];
};
export type VisualRecommendation = {
  baseRevisionId: string;
  sectionId: string;
  action: "ADD" | "KEEP" | "REPLACE" | "REMOVE" | "NO_RECOMMENDATION";
  candidate: VisualCandidate | null;
  alternatives: VisualCandidate[];
  reasonCodes: string[];
  uncertainty: string;
};
const reasons: Record<string, string> = {
  PAGE_VISUAL_DENSITY_LOW: "صفحه هنوز از نظر جلوه‌های بصری خلوت است.",
  PAGE_VISUAL_DENSITY_BALANCED: "تعداد جلوه‌های صفحه در محدوده متعادل است.",
  CURRENT_VISUAL_ALREADY_SUITABLE: "انتخاب فعلی برای این بخش مناسب است.",
  CURRENT_VISUAL_WEAK_FIT: "گزینه پیشنهادی تناسب روشن‌تری با این بخش دارد.",
  PAGE_BUDGET_AT_LIMIT: "ظرفیت جلوه‌های بصری این صفحه تکمیل است.",
  STATIC_LOW_RUNTIME_COST: "این سبک بدون اجرای جاوااسکریپت منتشر می‌شود.",
  TOKEN_AVAILABLE: "رنگ از توکن‌های تاییدشده برند استفاده می‌کند.",
  NO_ELIGIBLE_CANDIDATE: "برای این بخش گزینه قابل اتکایی در دسترس نیست.",
  REMOVE_TO_REDUCE_VISUAL_DENSITY: "حذف جلوه، تراکم بصری صفحه را کاهش می‌دهد.",
};
const propLabels: Record<string, string> = {
  HALO: "هاله‌ای",
  AURORA: "شفق",
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
export default function VisualRecommendationCard({
  recommendation,
  busy,
  onAccept,
  onAlternative,
  onIgnore,
}: {
  recommendation: VisualRecommendation | null;
  busy: boolean;
  onAccept: () => void;
  onAlternative: (candidate: VisualCandidate) => void;
  onIgnore: () => void;
}) {
  if (!recommendation) return null;
  if (recommendation.action === "NO_RECOMMENDATION")
    return (
      <section
        aria-label="پیشنهاد طراحی"
        className="rounded-2xl border border-white/10 p-4"
      >
        <h3 className="text-sm font-semibold">پیشنهاد طراحی</h3>
        <p className="mt-2 text-xs text-white/55">
          برای این بخش پیشنهاد مشخصی نداریم؛ انتخاب دستی همچنان در دسترس است.
        </p>
      </section>
    );
  const keep = recommendation.action === "KEEP";
  return (
    <section
      aria-label="پیشنهاد طراحی"
      className="space-y-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[.04] p-4"
    >
      <div>
        <h3 className="text-sm font-semibold">پیشنهاد طراحی</h3>
        <p className="mt-1 text-sm">
          {keep
            ? "انتخاب فعلی مناسب است."
            : recommendation.action === "REMOVE"
              ? "کاهش جلوه بصری این بخش پیشنهاد می‌شود."
              : recommendation.candidate?.displayName}
        </p>
        {recommendation.candidate && (
          <p className="mt-1 text-xs text-white/45">
            {Object.values(recommendation.candidate.props)
              .map((value) => propLabels[value] || value)
              .join(" · ")}
          </p>
        )}
      </div>
      <ul className="space-y-1 text-xs text-white/60">
        {recommendation.reasonCodes.slice(0, 3).map((code) => (
          <li key={code}>
            •{" "}
            {reasons[code] ||
              "تناسب این گزینه با سیاست فعلی بخش بررسی شده است."}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        {!["KEEP", "NO_RECOMMENDATION"].includes(recommendation.action) && (
          <button
            type="button"
            disabled={busy}
            onClick={onAccept}
            className={`min-h-11 rounded-xl px-4 focus:outline-none focus:ring-2 focus:ring-emerald-300 ${recommendation.action === "REMOVE" ? "border border-red-400/30 text-red-200" : "bg-emerald-400 font-semibold text-black"}`}
          >
            {recommendation.action === "REMOVE"
              ? "حذف با تأیید من"
              : "اعمال پیشنهاد"}
          </button>
        )}
        <button
          type="button"
          onClick={onIgnore}
          className="min-h-11 rounded-xl border border-white/10 px-4"
        >
          نادیده گرفتن
        </button>
      </div>
      {recommendation.alternatives.length > 0 && (
        <div>
          <p className="text-xs text-white/45">گزینه‌های دیگر</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {recommendation.alternatives.map((item) => (
              <button
                key={item.componentId}
                type="button"
                onClick={() => onAlternative(item)}
                className="min-h-11 rounded-xl border border-white/10 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-violet-400"
              >
                {item.displayName}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
