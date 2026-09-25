import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import StoreWebsiteStudioPageV16Core from "./StoreWebsiteStudioPageV16Core";
import { ensureSiteProject } from "../lib/activeSiteProject";

type GateState = "loading" | "ready" | "error";

// Direct entry: choosing "سایت شرکتی" opens the same V16 core with the
// corporate capability set. No Growth / Goal / Plan / Brain prerequisite.
export default function CorporateWebsiteStudioPage() {
  const [searchParams] = useSearchParams();
  const forceCreate = searchParams.get("new") === "1";
  const [state, setState] = useState<GateState>("loading");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    if (forceCreate) {
      setState("ready");
      setError("");
      return () => { active = false; };
    }
    setState("loading");
    setError("");
    void ensureSiteProject("BUSINESS")
      .then(() => { if (active) setState("ready"); })
      .catch((cause) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "آماده‌سازی پروژه سایت شرکتی ناموفق بود.");
        setState("error");
      });
    return () => { active = false; };
  }, [attempt, forceCreate]);

  if (state === "ready") return <StoreWebsiteStudioPageV16Core siteKind="BUSINESS" />;

  return (
    <main dir="rtl" className="grid min-h-screen place-items-center bg-[#070b12] p-6 text-white" data-corporate-project-gate={state}>
      <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0d1622] p-7 text-center shadow-2xl">
        {state === "loading" ? (
          <>
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-emerald-400/20 border-t-emerald-300" />
            <h1 className="mt-5 text-lg font-black">در حال آماده‌سازی سایت شرکتی…</h1>
          </>
        ) : (
          <>
            <h1 className="text-lg font-black text-rose-200">پروژه سایت شرکتی آماده نشد</h1>
            <p className="mt-3 rounded-2xl bg-rose-500/10 p-3 text-sm leading-7 text-rose-100">{error}</p>
            <button type="button" onClick={() => setAttempt((value) => value + 1)} className="mt-5 rounded-xl bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950">تلاش دوباره</button>
          </>
        )}
      </section>
    </main>
  );
}
