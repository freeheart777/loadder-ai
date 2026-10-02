import { useCallback, useEffect, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { clearPatientSession, patientHeaders, readPatientSession, savePatientSession, type PatientSession } from "../lib/patientSession";

type Phase = "loading" | "disabled" | "mobile" | "code" | "signed-in" | "error";

const field = "min-h-12 w-full rounded-xl border border-[#2b2a27]/20 bg-white px-4 text-base text-[#2b2a27] outline-none focus:border-[#5f7560]";
const primary = "min-h-12 w-full rounded-xl bg-[#5f7560] px-6 text-sm font-black text-white disabled:opacity-50";

// Patient sign-in: mobile number + one-time code on the existing app-user
// identity. There are no passwords. Messages stay truthful: when SMS delivery is
// not configured the page says so instead of pretending a code was sent.
export default function PatientSignInPage() {
  const { siteProjectId = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const base = `/api/auth/site/${encodeURIComponent(siteProjectId)}/patient`;
  const [phase, setPhase] = useState<Phase>("loading");
  const [session, setSession] = useState<PatientSession | null>(null);
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [devCode, setDevCode] = useState("");
  const next = (() => { const raw = params.get("next") || ""; return raw.startsWith(`/site/${siteProjectId}/`) && !raw.startsWith("//") && !raw.includes("..") ? raw : `/site/${siteProjectId}/patient/portal`; })();

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await apiFetch(`${base}/config`, { signal: controller.signal });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) { setMessage("این سایت در دسترس نیست."); setPhase("error"); return; }
        if (!data.enabled) { setPhase("disabled"); return; }
        const existing = readPatientSession(siteProjectId);
        if (existing) {
          const me = await apiFetch(`${base}/me`, { signal: controller.signal, headers: patientHeaders(existing) });
          if (me.ok) { setSession(existing); setPhase("signed-in"); return; }
          clearPatientSession(siteProjectId);
        }
        setPhase("mobile");
      } catch (error) { if ((error as Error).name !== "AbortError") { setMessage("ارتباط با سرور برقرار نشد."); setPhase("error"); } }
    })();
    return () => controller.abort();
  }, [base, siteProjectId]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const requestCode = useCallback(async () => {
    setBusy(true); setMessage("");
    try {
      const response = await apiFetch(`${base}/otp`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mobile }) });
      const data = await response.json().catch(() => ({}));
      if (response.ok) { setPhase("code"); setResendIn(Number(data.resendAfterSeconds) || 60); setDevCode(typeof data.developmentOtp === "string" ? data.developmentOtp : ""); setCode(""); return; }
      if (data.code === "OTP_DELIVERY_NOT_CONFIGURED") setMessage("ارسال پیامک در این محیط پیکربندی نشده است؛ ورود فعلاً ممکن نیست.");
      else if (data.code === "PATIENT_OTP_RATE_LIMITED") { setResendIn(Number(data.retryAfterSeconds) || 60); setMessage("درخواست‌های زیادی ثبت شده است. کمی بعد دوباره تلاش کنید."); }
      else if (data.code === "PATIENT_MOBILE_INVALID") setMessage("شمارهٔ موبایل معتبر نیست.");
      else if (data.code === "OTP_DELIVERY_FAILED") setMessage("ارسال پیامک ناموفق بود. کمی بعد دوباره تلاش کنید.");
      else setMessage("ارسال کد انجام نشد.");
    } catch { setMessage("ارتباط با سرور برقرار نشد."); }
    finally { setBusy(false); }
  }, [base, mobile]);

  async function submitMobile(event: FormEvent) { event.preventDefault(); await requestCode(); }

  async function submitCode(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await apiFetch(`${base}/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mobile, code, name: name.trim() || undefined }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.session?.token) { setMessage(data.code === "PATIENT_OTP_ATTEMPTS_EXCEEDED" ? "تلاش‌های ناموفق زیاد بود. کد جدید بگیرید." : "کد معتبر نیست یا منقضی شده است."); return; }
      const saved: PatientSession = { token: data.session.token, authProjectId: data.authProjectId, expiresAt: data.session.expiresAt, displayName: data.patient?.displayName ?? null };
      savePatientSession(siteProjectId, saved); setSession(saved); setPhase("signed-in");
      if (params.get("next")) navigate(next, { replace: true });
    } catch { setMessage("ارتباط با سرور برقرار نشد."); }
    finally { setBusy(false); }
  }

  async function signOut() {
    try { await apiFetch(`${base}/logout`, { method: "POST", headers: patientHeaders(session) }); } catch { /* the local session is cleared regardless */ }
    clearPatientSession(siteProjectId); setSession(null); setMobile(""); setCode(""); setPhase("mobile");
  }

  return <main dir="rtl" data-patient-sign-in data-light-form style={{ "--form-accent": "#5f7560" } as CSSProperties} className="min-h-screen bg-[#f7f3ea] px-4 py-8 text-[#2b2a27] sm:p-12">
    <section className="mx-auto max-w-md">
      <Link to={`/site/${siteProjectId}`} className="text-sm font-bold text-[#5f7560]">بازگشت به سایت</Link>
      <div className="mt-6 rounded-[2rem] border border-[#2b2a27]/10 bg-[#fffdf8] p-6 sm:p-9">
        <p className="text-sm font-bold text-[#a98242]">ورود بیماران</p>
        <h1 className="mt-2 text-2xl font-black">ورود با شمارهٔ موبایل</h1>
        <p className="mt-3 text-sm leading-7 opacity-70">با کد یک‌بارمصرف وارد شوید؛ رمز عبور لازم نیست.</p>
        {phase === "loading" && <p className="mt-6 text-sm opacity-60">در حال بارگذاری…</p>}
        {phase === "error" && <p role="alert" className="mt-6 rounded-2xl bg-rose-50 p-4 text-sm text-rose-800">{message}</p>}
        {phase === "disabled" && <p data-sign-in-state="disabled" className="mt-6 rounded-2xl border border-dashed border-[#2b2a27]/25 p-4 text-sm leading-7">ورود بیماران برای این مرکز هنوز فعال نشده است.</p>}
        {phase === "mobile" && <form onSubmit={submitMobile} className="mt-6 grid gap-3">
          <label className="grid gap-2 text-sm font-bold">شمارهٔ موبایل<input aria-label="شمارهٔ موبایل" className={field} dir="ltr" inputMode="tel" autoComplete="tel" placeholder="09123456789" value={mobile} onChange={(event) => setMobile(event.target.value)} /></label>
          <button disabled={busy || !mobile.trim() || resendIn > 0} className={primary}>{resendIn > 0 ? `ارسال کد (${resendIn.toLocaleString("fa-IR")})` : "ارسال کد"}</button>
        </form>}
        {phase === "code" && <form onSubmit={submitCode} className="mt-6 grid gap-3">
          <p className="text-sm">کد ۶ رقمی برای <bdi dir="ltr">{mobile}</bdi> ارسال شد.</p>
          {devCode && <p data-dev-otp className="rounded-xl bg-[#efe9db] p-3 text-xs">محیط آزمایشی — کد: <bdi dir="ltr" className="font-black">{devCode}</bdi></p>}
          <label className="grid gap-2 text-sm font-bold">کد تأیید<input aria-label="کد تأیید" className={field} dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} /></label>
          <label className="grid gap-2 text-sm font-bold">نام (برای حساب جدید، اختیاری)<input aria-label="نام" className={field} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} /></label>
          <button disabled={busy || code.length !== 6} className={primary}>تأیید و ورود</button>
          <button type="button" disabled={busy || resendIn > 0} onClick={requestCode} className="min-h-11 rounded-xl border border-[#2b2a27]/20 text-sm font-bold disabled:opacity-50">{resendIn > 0 ? `ارسال مجدد (${resendIn.toLocaleString("fa-IR")})` : "ارسال مجدد کد"}</button>
          <button type="button" onClick={() => { setPhase("mobile"); setMessage(""); }} className="text-xs underline">تغییر شماره</button>
        </form>}
        {phase === "signed-in" && session && <div data-sign-in-state="signed-in" className="mt-6 grid gap-3">
          <p className="text-sm">{session.displayName ? `${session.displayName}، ` : ""}با موفقیت وارد شده‌اید.</p>
          <Link data-sign-in-portal to={`/site/${siteProjectId}/patient/portal`} className={`${primary} grid place-items-center`}>نوبت‌های من</Link>
          <Link to={`/site/${siteProjectId}/booking`} className="min-h-11 rounded-xl border border-[#2b2a27]/20 text-sm font-bold grid place-items-center">رزرو نوبت</Link>
          <button type="button" onClick={signOut} className="min-h-11 rounded-xl border border-[#2b2a27]/20 text-sm font-bold">خروج</button>
        </div>}
        {message && phase !== "error" && <p role="alert" className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm text-rose-800">{message}</p>}
      </div>
    </section>
  </main>;
}
