import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Browsers, Buildings, FileText, MagnifyingGlass, Sparkle } from "@phosphor-icons/react";

import type { OnboardingStatus } from "../components/onboarding/types";
import {
  BUSINESS_DIAGNOSIS_DESTINATION,
  BUSINESS_FOUNDATION_DESTINATION,
  destinationForIntent,
  DIRECT_SERVICE_DESTINATIONS,
} from "../lib/customerJourney";
import { fetchOnboardingStatus } from "../lib/onboarding";

export default function IntentSelectionPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void fetchOnboardingStatus(controller.signal)
      .then(setStatus)
      .catch((reason) => {
        if (reason.name !== "AbortError") setError("وضعیت شناخت کسب‌وکار در دسترس نیست.");
      });
    return () => controller.abort();
  }, []);

  const choose = (destination: string) => {
    if (!status) return;
    navigate(destinationForIntent(status, destination));
  };

  return <main dir="rtl" className="loadder-dashboard-bg min-h-screen px-4 py-8 text-white sm:px-6">
    <div className="mx-auto max-w-5xl">
      <header className="flex items-center gap-4">
        <Link to="/dashboard" aria-label="بازگشت به داشبورد" className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]"><ArrowRight size={19}/></Link>
        <div><p className="text-sm text-violet-300">انتخاب مسیر</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">امروز می‌خواهی لودر چه کاری برای کسب‌وکارت انجام دهد؟</h1></div>
      </header>

      {error && <p role="alert" className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-red-200">{error}</p>}

      <section className="mt-8 rounded-[28px] border border-violet-400/20 bg-violet-500/[0.06] p-5 sm:p-7">
        <div className="flex items-start gap-3"><Sparkle size={24} className="mt-1 text-violet-300"/><div><h2 className="text-xl font-bold">می‌دانم چه می‌خواهم</h2><p className="mt-1 text-sm leading-7 text-white/50">مستقیم سراغ سایت، لندینگ یا محتوا برو</p></div></div>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button type="button" disabled={!status} onClick={() => choose(DIRECT_SERVICE_DESTINATIONS.WEBSITE)} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 disabled:opacity-40"><Buildings size={20}/>ساخت سایت</button>
          <button type="button" disabled={!status} onClick={() => choose(DIRECT_SERVICE_DESTINATIONS.LANDING)} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 disabled:opacity-40"><Browsers size={20}/>ساخت صفحه فرود</button>
          <button type="button" disabled={!status} onClick={() => choose(DIRECT_SERVICE_DESTINATIONS.CONTENT)} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 disabled:opacity-40"><FileText size={20}/>تولید محتوا</button>
        </div>
      </section>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <button type="button" disabled={!status} onClick={() => choose(BUSINESS_DIAGNOSIS_DESTINATION)} className="min-h-40 rounded-[28px] border border-cyan-400/15 bg-cyan-500/[0.05] p-6 text-right disabled:opacity-40"><MagnifyingGlass size={25} className="text-cyan-300"/><h2 className="mt-4 text-xl font-bold">نمی‌دانم چه چیزی لازم دارم</h2><p className="mt-2 text-sm leading-7 text-white/50">وضعیت سایت، شبکه اجتماعی، محتوا، تبلیغات و CRM را با پاسخ‌های خودت بررسی کنیم</p><p className="mt-4 text-xs text-white/35">پیشنهادها فقط از پاسخ‌های ثبت‌شده ساخته می‌شوند؛ هیچ نیاز یا داده‌ای حدس زده نمی‌شود.</p></button>
        <button type="button" disabled={!status} onClick={() => choose(BUSINESS_FOUNDATION_DESTINATION)} className="min-h-40 rounded-[28px] border border-emerald-400/15 bg-emerald-500/[0.05] p-6 text-right disabled:opacity-40"><Buildings size={25} className="text-emerald-300"/><h2 className="mt-4 text-xl font-bold">می‌خواهم کسب‌وکارم را با لودر بسازم</h2><p className="mt-2 text-sm leading-7 text-white/50">از پایه، مرحله‌به‌مرحله کسب‌وکارت را شکل بده</p><p className="mt-4 text-xs text-white/35">از همان پروفایل، DNA، برند بوک و شناخت مشترک لودر استفاده می‌شود.</p></button>
      </div>
      <p className="mt-8 text-center text-xs leading-6 text-white/35">انتخاب مسیر هیچ صفحه، محتوا، انتشار یا اجرایی را خودکار ایجاد نمی‌کند.</p>
    </div>
  </main>;
}
