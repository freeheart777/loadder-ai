import { useSearchParams } from "react-router-dom";
import { Day1, Diagnosis, Learning, MatureHome, Output, Permission, Plan, Replan, Result, Work } from "./screens";

/**
 * PROTOTYPE — Master Product Journey, visual only.
 *
 * Dev-only surface for design review. It renders fixture data, calls no
 * canonical API, mutates nothing, and does not replace the production
 * dashboard. The route is registered only when `import.meta.env.DEV` is true.
 *
 * `?screen=<id>` selects a screen; `?chrome=0` hides the switcher for capture.
 */

export const SCREENS = [
  { id: "day1", label: "۱ · روز اول", render: () => <Day1 /> },
  { id: "diagnosis", label: "۲ · تشخیص", render: () => <Diagnosis /> },
  { id: "plan", label: "۳ · برنامه", render: () => <Plan /> },
  { id: "permission", label: "۴ · اجازه", render: () => <Permission /> },
  { id: "work", label: "۵ · در حال کار", render: () => <Work /> },
  { id: "output", label: "۶ · خروجی", render: () => <Output /> },
  { id: "replan", label: "۷ · تغییر برنامه", render: () => <Replan /> },
  { id: "result", label: "۸ · نتیجه", render: () => <Result /> },
  { id: "learning", label: "۹ · یادگیری", render: () => <Learning /> },
  { id: "mature-full", label: "۱۰آ · خانه · همهٔ ابزارها", render: () => <MatureHome variant="full" /> },
  { id: "mature-shortlist", label: "۱۰ب · خانه · فهرست کوتاه", render: () => <MatureHome variant="shortlist" /> },
] as const;

export default function MasterHomePrototype() {
  const [params, setParams] = useSearchParams();
  const requested = params.get("screen") ?? "day1";
  const active = SCREENS.find((s) => s.id === requested) ?? SCREENS[0];
  const chrome = params.get("chrome") !== "0";

  return (
    <div className="min-h-screen bg-[#07070B]">
      {chrome && (
        <nav dir="rtl" className="sticky top-0 z-50 flex flex-wrap gap-1.5 border-b border-white/[0.07] bg-[#07070B]/95 px-4 py-3 backdrop-blur">
          {SCREENS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setParams({ screen: s.id })}
              className={`min-h-9 rounded-xl px-3 text-[12px] transition ${s.id === active.id ? "bg-white/[0.10] text-white" : "text-white/40 hover:text-white/70"}`}
            >
              {s.label}
            </button>
          ))}
          <span className="mr-auto self-center px-2 text-[11px] text-white/20">نمونهٔ طراحی · دادهٔ نمایشی</span>
        </nav>
      )}
      {active.render()}
    </div>
  );
}
