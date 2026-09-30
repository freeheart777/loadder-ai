import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";

type Service = { id: string; name: string; duration_minutes: number; active: boolean };
type Provider = { id: string; name: string; active: boolean };
type Association = { providerId: string; serviceId: string; createdAt: string };
type Availability = { id: string; provider_id: string; weekday: number; starts_at: string; ends_at: string };
type Appointment = { id: string; service_id: string; provider_id: string; customer_name: string; starts_at: string; status: string };
type BookingData = { services: Service[]; providers: Provider[]; associations: Association[]; availability: Availability[]; appointments: Appointment[] };

const initial: BookingData = { services: [], providers: [], associations: [], availability: [], appointments: [] };
const weekdays = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];

async function read(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.message || "عملیات نوبت‌دهی ناموفق بود.") as Error & { code?: string };
    error.code = body.code;
    throw error;
  }
  return body;
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-white/15 bg-white/[.02] p-3 text-sm leading-6 text-white/55">{children}</p>;
}

export default function BookingStudioPage() {
  const [data, setData] = useState<BookingData>(initial);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [capabilityDenied, setCapabilityDenied] = useState(false);
  const [serviceName, setServiceName] = useState("");
  const [duration, setDuration] = useState("30");
  const [providerName, setProviderName] = useState("");
  const [providerId, setProviderId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [weekday, setWeekday] = useState("0");
  const [startsAt, setStartsAt] = useState("09:00");
  const [endsAt, setEndsAt] = useState("17:00");
  const [customerName, setCustomerName] = useState("");
  const [appointmentAt, setAppointmentAt] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(""); setCapabilityDenied(false);
    try { const body = await read(await apiFetch("/api/booking")); setData({ ...initial, ...body }); }
    catch (cause) {
      if (cause instanceof Error && (cause as Error & { code?: string }).code === "BOOKING_CAPABILITY_REQUIRED") setCapabilityDenied(true);
      else setError(cause instanceof Error ? cause.message : "دریافت اطلاعات نوبت‌دهی ناموفق بود.");
    }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!providerId && data.providers[0]) setProviderId(data.providers[0].id); }, [data.providers, providerId]);
  useEffect(() => { if (!serviceId && data.services[0]) setServiceId(data.services[0].id); }, [data.services, serviceId]);

  const providerNames = useMemo(() => new Map(data.providers.map((provider) => [provider.id, provider.name])), [data.providers]);
  const serviceNames = useMemo(() => new Map(data.services.map((service) => [service.id, service.name])), [data.services]);
  const associated = useMemo(() => new Set(data.associations.map((row) => `${row.providerId}:${row.serviceId}`)), [data.associations]);
  const post = async (path: string, body?: unknown) => {
    setBusy(true); setError(""); setMessage("");
    try { await read(await apiFetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) })); await load(); setMessage("تغییرات با موفقیت ذخیره شد."); return true; }
    catch (cause) { setError(cause instanceof Error ? cause.message : "ذخیره‌سازی ناموفق بود."); return false; }
    finally { setBusy(false); }
  };
  const submitService = async (event: FormEvent) => { event.preventDefault(); if (await post("/api/booking/services", { name: serviceName, durationMinutes: Number(duration) })) setServiceName(""); };
  const submitProvider = async (event: FormEvent) => { event.preventDefault(); if (await post("/api/booking/providers", { name: providerName })) setProviderName(""); };
  const submitAssociation = async (event: FormEvent) => { event.preventDefault(); if (providerId && serviceId) await post(`/api/booking/providers/${providerId}/services/${serviceId}`); };
  const submitAvailability = async (event: FormEvent) => { event.preventDefault(); if (providerId) await post("/api/booking/availability", { providerId, weekday: Number(weekday), startsAt, endsAt }); };
  const submitAppointment = async (event: FormEvent) => { event.preventDefault(); if (providerId && serviceId && customerName && appointmentAt && associated.has(`${providerId}:${serviceId}`) && await post("/api/booking/appointments", { providerId, serviceId, customerName, startsAt: new Date(appointmentAt).toISOString() })) { setCustomerName(""); setAppointmentAt(""); } };

  return <main dir="rtl" className="min-h-screen overflow-x-hidden bg-[#090b10] p-3 text-white sm:p-6">
    <div className="mx-auto max-w-7xl">
      <header className="mb-5 flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-xs tracking-[.18em] text-white/40">LOADDER BOOKING STUDIO</p><h1 className="mt-2 text-2xl font-black sm:text-3xl">مدیریت نوبت‌دهی</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">خدمات، ارائه‌دهندگان، زمان‌های در دسترس و نوبت‌ها در دامنه عملیاتی نوبت‌دهی نگه‌داری می‌شوند.</p></div>
        <Link to="/dashboard" className="w-full rounded-xl border border-white/15 px-4 py-3 text-center text-sm font-semibold sm:w-auto">بازگشت به داشبورد</Link>
      </header>
      {error && <p role="alert" className="mb-4 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">{error}</p>}
      {message && <p role="status" className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">{message}</p>}
      {loading ? <p className="text-sm text-white/55">در حال دریافت اطلاعات نوبت‌دهی…</p> : capabilityDenied ? <section data-booking-capability-denied className="rounded-2xl border border-amber-300/25 bg-amber-300/[.06] p-5 text-sm leading-7 text-amber-50"><h2 className="font-black">نوبت‌دهی برای این Workspace فعال نیست</h2><p className="mt-2 text-amber-100/75">برای مدیریت خدمات، ارائه‌دهندگان یا نوبت‌ها، ابتدا یک Site Project با قابلیت نوبت‌دهی فعال کنید.</p><Link to="/dashboard/websites" className="mt-4 inline-flex rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-950">رفتن به سایت‌های من</Link></section> : <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="خدمات" description="تعریف خدماتی که قابل رزرو هستند."><form onSubmit={submitService} className="grid gap-2 sm:grid-cols-[1fr_8rem_auto]"><Input label="نام خدمت" value={serviceName} set={setServiceName} required/><Input label="مدت (دقیقه)" value={duration} set={setDuration} type="number" required/><Button>افزودن خدمت</Button></form><List empty="هنوز خدمتی ثبت نشده است.">{data.services.map((item) => <Row key={item.id} title={item.name} detail={`${item.duration_minutes} دقیقه`}/>)}</List></Panel>
        <Panel title="ارائه‌دهندگان" description="افرادی که خدمات را ارائه می‌کنند."><form onSubmit={submitProvider} className="grid gap-2 sm:grid-cols-[1fr_auto]"><Input label="نام ارائه‌دهنده" value={providerName} set={setProviderName} required/><Button>افزودن</Button></form><List empty="هنوز ارائه‌دهنده‌ای ثبت نشده است.">{data.providers.map((item) => <Row key={item.id} title={item.name} detail="فعال"/>)}</List></Panel>
        <Panel title="ارتباط خدمت و ارائه‌دهنده" description="فقط یک ارائه‌دهنده متصل می‌تواند برای آن خدمت نوبت بگیرد."><form onSubmit={submitAssociation} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><Select label="ارائه‌دهنده" value={providerId} set={setProviderId} options={data.providers}/><Select label="خدمت" value={serviceId} set={setServiceId} options={data.services}/><Button disabled={!providerId || !serviceId || associated.has(`${providerId}:${serviceId}`)}>{associated.has(`${providerId}:${serviceId}`) ? "متصل است" : "اتصال"}</Button></form><List empty="هنوز ارتباطی ثبت نشده است.">{data.associations.map((item) => <Row key={`${item.providerId}:${item.serviceId}`} title={`${providerNames.get(item.providerId) || "ارائه‌دهنده حذف‌شده"} ← ${serviceNames.get(item.serviceId) || "خدمت حذف‌شده"}`} detail="متصل"/>)}</List></Panel>
        <Panel title="برنامهٔ در دسترس" description="بازه‌های هفتگی حضور هر ارائه‌دهنده."><form onSubmit={submitAvailability} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><Select label="ارائه‌دهنده" value={providerId} set={setProviderId} options={data.providers}/><label className="grid gap-1 text-xs text-white/60">روز<select value={weekday} onChange={e => setWeekday(e.target.value)} className="field">{weekdays.map((name, index) => <option key={name} value={index}>{name}</option>)}</select></label><Input label="از" value={startsAt} set={setStartsAt} type="time" required/><Input label="تا" value={endsAt} set={setEndsAt} type="time" required/><Button disabled={!providerId}>ذخیره بازه</Button></form><List empty="هنوز بازهٔ در دسترسی ثبت نشده است.">{data.availability.map((item) => <Row key={item.id} title={`${providerNames.get(item.provider_id) || "ارائه‌دهنده"} · ${weekdays[item.weekday] || "روز نامعتبر"}`} detail={`${item.starts_at} تا ${item.ends_at}`}/>)}</List></Panel>
        <Panel title="ثبت نوبت" description="برای ثبت نوبت، خدمت و ارائه‌دهنده باید پیش‌تر به هم متصل شده باشند."><form onSubmit={submitAppointment} className="grid gap-2 sm:grid-cols-2"><Select label="ارائه‌دهنده" value={providerId} set={setProviderId} options={data.providers}/><Select label="خدمت" value={serviceId} set={setServiceId} options={data.services}/><Input label="نام مشتری" value={customerName} set={setCustomerName} required/><Input label="زمان نوبت" value={appointmentAt} set={setAppointmentAt} type="datetime-local" required/><Button disabled={!providerId || !serviceId || !associated.has(`${providerId}:${serviceId}`)}>ثبت نوبت</Button></form><List empty="هنوز نوبتی ثبت نشده است.">{data.appointments.map((item) => <Row key={item.id} title={`${item.customer_name} · ${serviceNames.get(item.service_id) || "خدمت"}`} detail={`${providerNames.get(item.provider_id) || "ارائه‌دهنده"} · ${new Date(item.starts_at).toLocaleString("fa-IR")} · ${item.status}`}/>)}</List></Panel>
      </div>}
    </div>
  </main>;
}

function Panel({ title, description, children }: { title: string; description: string; children: ReactNode }) { return <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[.025] p-4"><h2 className="text-lg font-bold">{title}</h2><p className="mt-1 text-xs leading-5 text-white/45">{description}</p><div className="mt-4">{children}</div></section>; }
function List({ empty, children }: { empty: string; children: ReactNode }) { const rows = Array.isArray(children) ? children : [children]; return <div className="mt-4 space-y-2">{rows.length ? rows : <Empty>{empty}</Empty>}</div>; }
function Row({ title, detail }: { title: string; detail: string }) { return <div className="min-w-0 rounded-xl bg-black/20 p-3"><p className="truncate text-sm font-semibold">{title}</p><p className="mt-1 truncate text-xs text-white/50">{detail}</p></div>; }
const fieldClass = "w-full min-w-0 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-300 disabled:cursor-not-allowed disabled:opacity-40";
function Input({ label, value, set, type = "text", required = false }: { label: string; value: string; set: (value: string) => void; type?: string; required?: boolean }) { return <label className="grid min-w-0 gap-1 text-xs text-white/60">{label}<input className={fieldClass} type={type} value={value} onChange={e => set(e.target.value)} required={required}/></label>; }
function Select({ label, value, set, options }: { label: string; value: string; set: (value: string) => void; options: Array<{ id: string; name: string }> }) { return <label className="grid min-w-0 gap-1 text-xs text-white/60">{label}<select className={fieldClass} value={value} onChange={e => set(e.target.value)} disabled={!options.length}><option value="">{options.length ? "انتخاب کنید" : "موردی ثبت نشده"}</option>{options.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>; }
function Button({ children, disabled = false }: { children: ReactNode; disabled?: boolean }) { return <button disabled={disabled} className="self-end rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{children}</button>; }
