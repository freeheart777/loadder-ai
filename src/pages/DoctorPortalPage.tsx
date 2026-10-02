import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";

type Session = { token: string; expiresAt: string; displayName: string | null };
type Appointment = { id: string; reference: string | null; status: string; startsAt: string; modality: string | null; patient: { name: string; contact: string | null; linked: boolean }; service: { name: string; durationMinutes: number } | null };
type Slot = { id: string; weekday: number; startsAt: string; endsAt: string; capacity: number; status: string };

const STATUS: Record<string, string> = { PENDING: "در انتظار تأیید", CONFIRMED: "تأییدشده", CANCELLED: "لغوشده", COMPLETED: "انجام‌شده" };
const MODE: Record<string, string> = { IN_PERSON: "حضوری", VIDEO: "ویدئویی", AUDIO: "صوتی", TEXT: "متنی", ONLINE: "آنلاین" };
const DAYS = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];
const when = (iso: string) => new Intl.DateTimeFormat("fa-IR", { dateStyle: "full", timeStyle: "short", timeZone: "UTC" }).format(new Date(iso));
const field = "min-h-11 w-full rounded-xl border border-[#2b2a27]/20 bg-white px-3 text-sm text-[#2b2a27]";
const primary = "min-h-11 rounded-xl bg-[#5f7560] px-5 text-sm font-black text-white disabled:opacity-50";

// Minimum doctor portal: the signed-in doctor's own appointments and schedule.
export default function DoctorPortalPage() {
  const { siteProjectId = "" } = useParams();
  const base = `/api/auth/site/${encodeURIComponent(siteProjectId)}/doctor`;
  const storeKey = `loadder-doctor:${siteProjectId}`;
  const readSession = (): Session | null => { try { const s = JSON.parse(sessionStorage.getItem(storeKey) || "null") as Session | null; return s && Date.parse(s.expiresAt) > Date.now() ? s : null; } catch { return null; } };
  const [session, setSession] = useState<Session | null>(readSession);
  const [mobile, setMobile] = useState(""), [code, setCode] = useState(""), [step, setStep] = useState<"mobile" | "code">("mobile");
  const [message, setMessage] = useState(""), [busy, setBusy] = useState(false), [devCode, setDevCode] = useState("");
  const [data, setData] = useState<{ upcoming: Appointment[]; past: Appointment[] }>({ upcoming: [], past: [] });
  const [slots, setSlots] = useState<Slot[]>([]);
  const [draft, setDraft] = useState({ weekday: "1", startsAt: "09:00", endsAt: "10:00", capacity: "1" });
  const headers = useCallback((): Record<string, string> => (session ? { "X-Loadder-App-Token": session.token } : {}), [session]);

  const load = useCallback(async () => {
    if (!session) return;
    const [a, s] = await Promise.all([apiFetch(`${base}/appointments`, { headers: headers() }), apiFetch(`${base}/availability`, { headers: headers() })]);
    if (a.status === 401 || s.status === 401) { try { sessionStorage.removeItem(storeKey); } catch { /* ignore */ } setSession(null); return; }
    const appointments = await a.json().catch(() => ({})), availability = await s.json().catch(() => ({}));
    if (Array.isArray(appointments.upcoming)) setData({ upcoming: appointments.upcoming, past: appointments.past || [] });
    if (Array.isArray(availability.availability)) setSlots(availability.availability);
  }, [base, headers, session, storeKey]);
  useEffect(() => { void load(); }, [load]);

  async function requestCode(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await apiFetch(`${base}/otp`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mobile }) });
      const body = await response.json().catch(() => ({}));
      if (response.ok) { setStep("code"); setDevCode(typeof body.developmentOtp === "string" ? body.developmentOtp : ""); }
      else setMessage(body.code === "OTP_DELIVERY_NOT_CONFIGURED" ? "ارسال پیامک در این محیط پیکربندی نشده است." : "درخواست انجام نشد. کمی بعد دوباره تلاش کنید.");
    } catch { setMessage("ارتباط با سرور برقرار نشد."); } finally { setBusy(false); }
  }
  async function verify(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await apiFetch(`${base}/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mobile, code }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.session?.token) { setMessage("کد معتبر نیست یا منقضی شده است."); return; }
      const next: Session = { token: body.session.token, expiresAt: body.session.expiresAt, displayName: body.doctor?.displayName ?? null };
      try { sessionStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* storage unavailable */ }
      setSession(next);
    } catch { setMessage("ارتباط با سرور برقرار نشد."); } finally { setBusy(false); }
  }
  async function signOut() {
    try { await apiFetch(`${base}/logout`, { method: "POST", headers: headers() }); } catch { /* cleared locally */ }
    try { sessionStorage.removeItem(storeKey); } catch { /* ignore */ }
    setSession(null); setStep("mobile"); setCode(""); setData({ upcoming: [], past: [] }); setSlots([]);
  }
  async function act(path: string, method: string, body: object) {
    setMessage("");
    const response = await apiFetch(`${base}${path}`, { method, headers: { "Content-Type": "application/json", ...headers() }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) setMessage(result.code === "BOOKING_APPOINTMENT_NOT_STARTED" ? "نوبت هنوز شروع نشده و قابل ثبت به‌عنوان انجام‌شده نیست." : "عملیات انجام نشد.");
    await load();
  }
  const addSlot = (event: FormEvent) => { event.preventDefault(); void act("/availability", "POST", { weekday: Number(draft.weekday), startsAt: draft.startsAt, endsAt: draft.endsAt, capacity: Number(draft.capacity) }); };
  const started = (item: Appointment) => Date.parse(item.startsAt) <= Date.now();

  return <main dir="rtl" data-doctor-portal className="min-h-screen bg-[#f7f3ea] px-4 py-8 text-[#2b2a27] sm:p-12">
    <section className="mx-auto max-w-3xl">
      <Link to={`/site/${siteProjectId}`} className="text-sm font-bold text-[#5f7560]">بازگشت به سایت</Link>
      {!session && <div className="mt-6 rounded-[2rem] border border-[#2b2a27]/10 bg-[#fffdf8] p-6 sm:p-9">
        <p className="text-sm font-bold text-[#a98242]">پرتال پزشک</p><h1 className="mt-2 text-2xl font-black">ورود پزشک</h1>
        {step === "mobile" ? <form onSubmit={requestCode} className="mt-6 grid gap-3"><input aria-label="شمارهٔ موبایل پزشک" className={field} dir="ltr" inputMode="tel" placeholder="09123456789" value={mobile} onChange={(event) => setMobile(event.target.value)} /><button disabled={busy || !mobile.trim()} className={primary}>ارسال کد</button></form>
          : <form onSubmit={verify} className="mt-6 grid gap-3">{devCode && <p data-dev-otp className="rounded-xl bg-[#efe9db] p-3 text-xs">محیط آزمایشی — کد: <bdi dir="ltr" className="font-black">{devCode}</bdi></p>}<input aria-label="کد تأیید پزشک" className={field} dir="ltr" inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} /><button disabled={busy || code.length !== 6} className={primary}>تأیید و ورود</button></form>}
        {message && <p role="alert" className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm text-rose-800">{message}</p>}
      </div>}
      {session && <>
        <header className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[2rem] border border-[#2b2a27]/10 bg-[#fffdf8] p-6"><div><p className="text-sm font-bold text-[#a98242]">پرتال پزشک</p><h1 className="mt-1 text-2xl font-black">{session.displayName || "نوبت‌های شما"}</h1></div><button type="button" onClick={signOut} className="min-h-11 rounded-xl border border-[#2b2a27]/20 px-4 text-sm font-bold">خروج</button></header>
        {message && <p role="alert" className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm text-rose-800">{message}</p>}
        <section className="mt-8"><h2 className="text-sm font-black text-[#a98242]">نوبت‌های پیش‌رو</h2>
          {!data.upcoming.length && <p data-doctor-empty className="mt-2 rounded-2xl border border-dashed border-[#2b2a27]/25 p-4 text-sm">نوبت پیش‌رویی برای شما ثبت نشده است.</p>}
          <ul className="mt-2 space-y-2">{data.upcoming.map((item) => <li key={item.id} data-appointment="upcoming" className="rounded-2xl border border-[#2b2a27]/10 bg-[#fffdf8] p-4"><p className="break-words font-black">{item.patient.name}{item.patient.contact ? <bdi dir="ltr" className="mr-2 text-xs font-normal opacity-70">{item.patient.contact}</bdi> : null}</p><p className="mt-1 text-sm">{item.service?.name} · {when(item.startsAt)}</p><p className="mt-1 text-xs opacity-70">{[item.modality && (MODE[item.modality] || item.modality), STATUS[item.status] || item.status, item.reference].filter(Boolean).join(" · ")}</p>
            <div className="mt-3 flex gap-2">{item.status === "PENDING" && <button type="button" onClick={() => act(`/appointments/${item.id}/status`, "POST", { status: "CONFIRMED" })} className={primary}>تأیید نوبت</button>}{item.status === "CONFIRMED" && started(item) && <button type="button" onClick={() => act(`/appointments/${item.id}/status`, "POST", { status: "COMPLETED" })} className={primary}>ثبت انجام</button>}</div></li>)}</ul></section>
        {data.past.length > 0 && <section className="mt-8"><h2 className="text-sm font-black text-[#a98242]">سابقه</h2><ul className="mt-2 space-y-2">{data.past.map((item) => <li key={item.id} data-appointment="past" className="rounded-2xl border border-[#2b2a27]/10 p-4 text-sm"><b>{item.patient.name}</b> · {when(item.startsAt)} · {STATUS[item.status] || item.status}</li>)}</ul></section>}
        <section className="mt-8"><h2 className="text-sm font-black text-[#a98242]">برنامهٔ هفتگی من</h2>
          {!slots.length && <p className="mt-2 rounded-2xl border border-dashed border-[#2b2a27]/25 p-4 text-sm">زمان در دسترسی ثبت نشده است.</p>}
          <ul className="mt-2 space-y-2">{slots.map((slot) => <li key={slot.id} data-slot={slot.status} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#2b2a27]/10 bg-[#fffdf8] p-4 text-sm"><span>{DAYS[slot.weekday]} · <bdi dir="ltr">{slot.startsAt}–{slot.endsAt}</bdi> · ظرفیت {slot.capacity.toLocaleString("fa-IR")} · {slot.status === "ACTIVE" ? "فعال" : "لغوشده"}</span><button type="button" onClick={() => act(`/availability/${slot.id}`, "PATCH", { status: slot.status === "ACTIVE" ? "CANCELLED" : "ACTIVE" })} className="min-h-11 rounded-xl border border-[#2b2a27]/20 px-4 text-xs font-bold">{slot.status === "ACTIVE" ? "لغو" : "فعال‌سازی"}</button></li>)}</ul>
          <form onSubmit={addSlot} className="mt-4 grid gap-2 rounded-2xl border border-[#2b2a27]/10 bg-[#fffdf8] p-4 sm:grid-cols-5"><select aria-label="روز هفته" className={field} value={draft.weekday} onChange={(event) => setDraft({ ...draft, weekday: event.target.value })}>{DAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}</select><input aria-label="از ساعت" type="time" className={field} value={draft.startsAt} onChange={(event) => setDraft({ ...draft, startsAt: event.target.value })} /><input aria-label="تا ساعت" type="time" className={field} value={draft.endsAt} onChange={(event) => setDraft({ ...draft, endsAt: event.target.value })} /><input aria-label="ظرفیت" type="number" min={1} max={50} className={field} value={draft.capacity} onChange={(event) => setDraft({ ...draft, capacity: event.target.value })} /><button className={primary}>افزودن زمان</button></form></section>
      </>}
    </section>
  </main>;
}
