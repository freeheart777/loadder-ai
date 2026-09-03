import { useEffect, useState } from "react";
import StoreCommerceManagerPageCore from "./StoreCommerceManagerPageCore";
import { ensureActiveStoreProject } from "../lib/activeStoreProject";

type GateState = "loading" | "ready" | "error";

export default function StoreCommerceManagerPage() {
  const [state, setState] = useState<GateState>("loading");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState("loading");
    setError("");
    void ensureActiveStoreProject()
      .then(() => { if (active) setState("ready"); })
      .catch((cause) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "آماده‌سازی پروژه فروشگاه ناموفق بود.");
        setState("error");
      });
    return () => { active = false; };
  }, [attempt]);

  if (state === "ready") return <StoreCommerceManagerPageCore />;

  return (
    <main dir="rtl" className="grid min-h-screen place-items-center bg-[#090d17] p-6 text-white" data-store-project-gate={state}>
      <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0d1320] p-7 text-center">
        {state === "loading" ? (
          <><div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-violet-400/20 border-t-violet-300" /><h1 className="mt-5 text-lg font-black">در حال آماده‌سازی کاتالوگ فروشگاه…</h1></>
        ) : (
          <><h1 className="text-lg font-black text-rose-200">پروژه فروشگاه آماده نشد</h1><p className="mt-3 rounded-2xl bg-rose-500/10 p-3 text-sm leading-7 text-rose-100">{error}</p><button type="button" onClick={() => setAttempt((value) => value + 1)} className="mt-5 rounded-xl bg-violet-500 px-5 py-3 text-sm font-black">تلاش دوباره</button></>
        )}
      </section>
    </main>
  );
}
