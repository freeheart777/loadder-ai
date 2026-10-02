import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";
import AppointmentDocuments from "../components/medical/AppointmentDocuments";
import ConsultationPanel from "../components/medical/ConsultationPanel";
import { clearPatientSession, patientHeaders, readPatientSession } from "../lib/patientSession";

type Appointment = { id: string; reference: string | null; status: string; startsAt: string; modality: string | null; service: { name: string; durationMinutes: number } | null; provider: { name: string } | null };

const STATUS: Record<string, string> = { PENDING: "در انتظار تأیید", CONFIRMED: "تأییدشده", CANCELLED: "لغوشده", COMPLETED: "انجام‌شده" };
const MODE: Record<string, string> = { IN_PERSON: "حضوری", VIDEO: "ویدئویی", AUDIO: "صوتی", TEXT: "متنی", ONLINE: "آنلاین" };
const when = (iso: string) => new Intl.DateTimeFormat("fa-IR", { dateStyle: "full", timeStyle: "short", timeZone: "UTC" }).format(new Date(iso));

// Patient Portal: the signed-in patient's own appointments, nothing else. Payments,
// messages, documents and cancel/reschedule are deliberately absent: no canonical
// contract backs them yet, so none is shown.
export default function PatientPortalPage() {
  const { siteProjectId = "" } = useParams();
  const navigate = useNavigate();
  const session = readPatientSession(siteProjectId);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [data, setData] = useState<{ upcoming: Appointment[]; past: Appointment[] }>({ upcoming: [], past: [] });

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await apiFetch(`/api/auth/site/${encodeURIComponent(siteProjectId)}/patient/appointments`, { signal: controller.signal, headers: patientHeaders(session) });
        if (response.status === 401) { clearPatientSession(siteProjectId); navigate(`/site/${siteProjectId}/patient?next=${encodeURIComponent(`/site/${siteProjectId}/patient/portal`)}`, { replace: true }); return; }
        const body = await response.json().catch(() => ({}));
        if (!response.ok || !Array.isArray(body.upcoming) || !Array.isArray(body.past)) throw new Error("load");
        setData({ upcoming: body.upcoming, past: body.past }); setState("ready");
      } catch (error) { if ((error as Error).name !== "AbortError") setState("error"); }
    })();
    return () => controller.abort();
  }, [siteProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!session) return <Navigate to={`/site/${siteProjectId}/patient?next=${encodeURIComponent(`/site/${siteProjectId}/patient/portal`)}`} replace />;

  const meta = (item: Appointment) => [item.provider?.name && `دکتر/ارائه‌دهنده: ${item.provider.name}`, item.modality && (MODE[item.modality] || item.modality), STATUS[item.status] || item.status].filter(Boolean).join(" · ");
  const [next, ...later] = data.upcoming;

  async function signOut() {
    try { await apiFetch(`/api/auth/site/${encodeURIComponent(siteProjectId)}/patient/logout`, { method: "POST", headers: patientHeaders(session) }); } catch { /* cleared locally regardless */ }
    clearPatientSession(siteProjectId); navigate(`/site/${siteProjectId}/patient`, { replace: true });
  }

  return <main dir="rtl" data-patient-portal className="min-h-screen bg-[#f7f3ea] px-4 py-8 text-[#2b2a27] sm:p-12">
    <section className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3"><Link to={`/site/${siteProjectId}`} className="text-sm font-bold text-[#5f7560]">بازگشت به سایت</Link><button type="button" onClick={signOut} className="min-h-11 rounded-xl border border-[#2b2a27]/20 px-4 text-sm font-bold">خروج</button></div>
      <header className="mt-6 rounded-[2rem] border border-[#2b2a27]/10 bg-[#fffdf8] p-6 sm:p-9">
        <p className="text-sm font-bold text-[#a98242]">پرتال بیمار</p>
        <h1 className="mt-2 text-2xl font-black sm:text-3xl">{session.displayName ? `${session.displayName}، خوش آمدید` : "نوبت‌های شما"}</h1>
        <Link data-portal-new-booking to={`/site/${siteProjectId}/booking`} className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-[#5f7560] px-6 text-sm font-black text-white">رزرو نوبت جدید</Link>
      </header>
      {state === "loading" && <p className="mt-8 text-sm opacity-60">در حال دریافت نوبت‌ها…</p>}
      {state === "error" && <p role="alert" className="mt-8 rounded-2xl bg-rose-50 p-4 text-sm text-rose-800">دریافت نوبت‌ها ممکن نشد. کمی بعد دوباره تلاش کنید.</p>}
      {state === "ready" && !data.upcoming.length && !data.past.length && <p data-portal-empty className="mt-8 rounded-3xl border border-dashed border-[#2b2a27]/25 p-6 text-sm leading-7">هنوز نوبتی با حساب شما ثبت نشده است. نوبت‌هایی که پیش‌تر بدون ورود ثبت شده‌اند به‌طور خودکار به حساب شما اضافه نمی‌شوند.</p>}
      {next && <section className="mt-8"><h2 className="text-sm font-black text-[#a98242]">نوبت بعدی</h2>
        <article data-appointment="next" className="mt-2 rounded-3xl bg-[#5f7560] p-6 text-white"><p className="break-words text-xl font-black">{next.service?.name || "نوبت"}</p><p className="mt-2 text-sm">{when(next.startsAt)}</p><p className="mt-1 text-xs opacity-90">{meta(next)}</p>{next.reference && <p className="mt-3 text-xs">کد پیگیری: <bdi dir="ltr" className="font-black">{next.reference}</bdi></p>}{["VIDEO", "AUDIO"].includes(next.modality || "") && next.status === "CONFIRMED" && <ConsultationPanel siteProjectId={siteProjectId} appointmentId={next.id} token={session.token} mode="patient" />}<AppointmentDocuments siteProjectId={siteProjectId} appointmentId={next.id} token={session.token} mode="patient" /></article></section>}
      {later.length > 0 && <section className="mt-8"><h2 className="text-sm font-black text-[#a98242]">نوبت‌های پیش‌رو</h2><ul className="mt-2 space-y-2">{later.map((item) => <li key={item.id} data-appointment="upcoming" className="rounded-2xl border border-[#2b2a27]/10 bg-[#fffdf8] p-4"><p className="break-words font-black">{item.service?.name || "نوبت"}</p><p className="mt-1 text-sm">{when(item.startsAt)}</p><p className="mt-1 text-xs opacity-70">{meta(item)}</p>{["VIDEO", "AUDIO"].includes(item.modality || "") && item.status === "CONFIRMED" && <ConsultationPanel siteProjectId={siteProjectId} appointmentId={item.id} token={session.token} mode="patient" />}<AppointmentDocuments siteProjectId={siteProjectId} appointmentId={item.id} token={session.token} mode="patient" /></li>)}</ul></section>}
      {data.past.length > 0 && <section className="mt-8"><h2 className="text-sm font-black text-[#a98242]">سابقهٔ نوبت‌ها</h2><ul className="mt-2 space-y-2">{data.past.map((item) => <li key={item.id} data-appointment="past" className="rounded-2xl border border-[#2b2a27]/10 p-4"><p className="break-words font-bold">{item.service?.name || "نوبت"}</p><p className="mt-1 text-xs opacity-70">{when(item.startsAt)} · {meta(item)}</p>{item.status !== "CANCELLED" && <AppointmentDocuments siteProjectId={siteProjectId} appointmentId={item.id} token={session.token} mode="patient" />}</li>)}</ul></section>}
    </section>
  </main>;
}
