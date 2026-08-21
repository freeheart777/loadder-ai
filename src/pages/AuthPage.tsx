import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { useAuth } from "../lib/auth";

import {
  ArrowLeft,
  ArrowRight,
  DeviceMobile,
  User,
  Sparkle,
  CheckCircle,
} from "@phosphor-icons/react";

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: sessionLoading, refreshSession } = useAuth();

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [developmentOtp, setDevelopmentOtp] = useState("");

  useEffect(() => {
    if (!sessionLoading && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate, sessionLoading, user]);

  const sendCode = async () => {
    setError("");

    if (name.trim().length < 2) {
      setError("لطفاً نام خود را وارد کنید.");
      return;
    }

    const cleanMobile = mobile.replace(/\s/g, "");

    if (!/^09\d{9}$/.test(cleanMobile)) {
      setError("شماره موبایل معتبر وارد کنید.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await apiFetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), mobile: cleanMobile }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "ارسال کد تأیید انجام نشد.");
      }

      setDevelopmentOtp(data.developmentOtp || "");
      setStep(2);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "ارتباط با سرور برقرار نشد."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const enterPlatform = async () => {
    setError("");

    if (!/^\d{5}$/.test(code)) {
      setError("کد تأیید پنج‌رقمی را وارد کنید.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await apiFetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mobile: mobile.replace(/\s/g, ""),
          code,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "کد تأیید معتبر نیست.");
      }

      const authenticated = await refreshSession();
      if (!authenticated) {
        throw new Error("نشست کاربری ایجاد نشد.");
      }

      const requestedPath =
        typeof location.state?.from === "string"
          ? location.state.from
          : "/dashboard";
      navigate(requestedPath, { replace: true });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "ورود انجام نشد."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      dir="rtl"
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#03040b] px-5 text-white"
    >
      <div className="pointer-events-none absolute -right-32 top-10 h-[480px] w-[480px] rounded-full bg-violet-600/15 blur-[150px]" />
      <div className="pointer-events-none absolute -bottom-40 left-10 h-[450px] w-[450px] rounded-full bg-cyan-500/10 blur-[160px]" />

      <Link
        to="/"
        className="absolute right-7 top-7 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/60 transition hover:bg-white/[0.08] hover:text-white"
      >
        <ArrowRight size={17} />
        بازگشت
      </Link>

      <div className="relative z-10 grid w-full max-w-[1100px] overflow-hidden rounded-[34px] border border-white/[0.08] bg-[#090b13]/90 shadow-2xl backdrop-blur-2xl lg:grid-cols-[0.85fr_1.15fr]">
        <section className="relative overflow-hidden border-b border-white/[0.07] p-8 lg:border-b-0 lg:border-l lg:p-10">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/[0.12] via-transparent to-cyan-500/[0.05]" />

          <div className="relative">
            <img
              src="/loadder-logo.png"
              alt="Loadder"
              className="w-[190px] object-contain"
            />

            <div className="mt-14 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/10 px-4 py-2">
              <Sparkle
                size={15}
                weight="fill"
                className="text-violet-300"
              />

              <span className="text-sm text-violet-200">
                پلتفرم هوشمند رشد کسب‌وکار
              </span>
            </div>

            <h1 className="mt-6 text-3xl font-bold leading-[1.6]">
              کسب‌وکارت را به
              <span className="text-violet-300"> Loadder </span>
              متصل کن.
            </h1>

            <p className="mt-4 max-w-md text-base leading-8 text-white/50">
              حساب کاربری خود را بساز و تمام ابزارهای رشد کسب‌وکارت را
              در یک فضای کاری هوشمند و یکپارچه مدیریت کن.
            </p>
          </div>
        </section>

        <section className="p-8 lg:p-12">
          {step === 1 ? (
            <>
              <div className="text-sm text-violet-300">
                به لودر خوش آمدی
              </div>

              <h2 className="mt-2 text-2xl font-bold">
                حساب کاربری خود را بساز
              </h2>

              <p className="mt-2 text-sm text-white/45">
                کمتر از یک دقیقه زمان می‌برد.
              </p>

              <div className="mt-8 space-y-5">
                <div>
                  <label className="mb-2 block text-sm text-white/60">
                    نام و نام خانوادگی
                  </label>

                  <div className="relative">
                    <User
                      size={19}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30"
                    />

                    <input
                      value={name}
                      onChange={(event) =>
                        setName(event.target.value)
                      }
                      placeholder="مثلاً علی رضایی"
                      className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.035] py-4 pl-4 pr-12 text-base outline-none transition focus:border-violet-400/40 focus:bg-white/[0.05]"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm text-white/60">
                    شماره موبایل
                  </label>

                  <div className="relative">
                    <DeviceMobile
                      size={19}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30"
                    />

                    <input
                      dir="ltr"
                      value={mobile}
                      onChange={(event) =>
                        setMobile(event.target.value)
                      }
                      placeholder="09123456789"
                      className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.035] py-4 pl-4 pr-12 text-left text-base outline-none transition focus:border-violet-400/40 focus:bg-white/[0.05]"
                    />
                  </div>
                </div>
              </div>

              {error && (
                <p className="mt-4 text-sm text-red-300">
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={sendCode}
                disabled={submitting}
                className="mt-7 flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-l from-blue-500 via-violet-500 to-fuchsia-500 py-4 text-base font-semibold transition hover:scale-[1.01]"
              >
                {submitting ? "در حال ارسال…" : "ادامه"}
                <ArrowLeft size={18} />
              </button>
            </>
          ) : (
            <>
              <CheckCircle
                size={38}
                weight="duotone"
                className="text-emerald-300"
              />

              <h2 className="mt-5 text-2xl font-bold">
                تأیید شماره موبایل
              </h2>

              <p className="mt-3 text-sm leading-7 text-white/45">
                کد تأیید برای
                <span dir="ltr" className="mx-1 text-white/80">
                  {mobile}
                </span>
                ارسال می‌شود.
              </p>

              <div className="mt-8">
                <label className="mb-2 block text-sm text-white/60">
                  کد تأیید
                </label>

                <input
                  dir="ltr"
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value)
                  }
                  placeholder="•••••"
                  maxLength={5}
                  className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.035] px-5 py-4 text-center text-xl tracking-[0.5em] outline-none transition focus:border-violet-400/40"
                />
              </div>

              {developmentOtp && (
                <p className="mt-3 text-xs text-amber-300/70">
                  کد محیط توسعه: {developmentOtp}
                </p>
              )}

              {error && (
                <p className="mt-4 text-sm text-red-300">
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={enterPlatform}
                disabled={submitting}
                className="mt-7 flex w-full items-center justify-center gap-3 rounded-2xl bg-white py-4 text-base font-semibold text-black transition hover:scale-[1.01]"
              >
                {submitting ? "در حال ورود…" : "ورود به پنل"}
                <ArrowLeft size={18} />
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setCode("");
                  setError("");
                  setDevelopmentOtp("");
                }}
                className="mt-3 w-full py-3 text-sm text-white/40 transition hover:text-white"
              >
                اصلاح اطلاعات
              </button>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
