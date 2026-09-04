import { useEffect, useState } from "react";
import StoreWebsiteStudioPageV16Core from "./StoreWebsiteStudioPageV16Core";
import { loadActiveStoreProject } from "../lib/activeStoreProject";
import "../direct-media.css";

type GateState = "loading" | "ready" | "error";

export default function StoreWebsiteStudioPageV16() {
  const [state, setState] = useState<GateState>("loading");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState("loading");
    setError("");
    void loadActiveStoreProject()
      .then(() => { if (active) setState("ready"); })
      .catch((cause) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "آماده‌سازی پروژه فروشگاه ناموفق بود.");
        setState("error");
      });
    return () => { active = false; };
  }, [attempt]);

  if (state === "ready") return (
    <>
      <StoreWebsiteStudioPageV16Core />
      <div data-loadder-runtime="direct-media-v1" className="pointer-events-none fixed bottom-3 right-3 z-[9999] rounded-full border border-emerald-300/30 bg-slate-950/90 px-3 py-1.5 text-[9px] font-black tracking-wide text-emerald-300 shadow-xl">
        DIRECT MEDIA · 2026.09.04
      </div>
    </>
  );

  return (
    <main dir="rtl" className="grid min-h-screen place-items-center bg-[#070b12] p-6 text-white" data-store-project-gate={state}>
      <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0d1622] p-7 text-center shadow-2xl">
        {state === "loading" ? (
          <>
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-emerald-400/20 border-t-emerald-300" />
            <h1 className="mt-5 text-lg font-black">در حال آماده‌سازی پروژه فروشگاه…</h1>
            <p className="mt-2 text-sm leading-7 text-white/45">ویرایش تا زمانی که پروژه واقعی، قابل خواندن و قابل ذخیره آماده نشده باشد فعال نمی‌شود.</p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-black text-rose-200">پروژه فروشگاه آماده نشد</h1>
            <p className="mt-3 rounded-2xl bg-rose-500/10 p-3 text-sm leading-7 text-rose-100">{error}</p>
            <p className="mt-3 text-xs leading-6 text-white/45">برای جلوگیری از ویرایش روی یک Canvas غیرواقعی، Studio متوقف شده است.</p>
            <button type="button" onClick={() => setAttempt((value) => value + 1)} className="mt-5 rounded-xl bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950">تلاش دوباره</button>
          </>
        )}
      </section>
    </main>
  );
}
