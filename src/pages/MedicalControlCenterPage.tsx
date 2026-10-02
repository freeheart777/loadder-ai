import { useCallback, useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Query<T> = { data: T | null; error: string; loading: boolean; reload: () => Promise<void> };

const TABS = [["dashboard", "نمای کلی"], ["patients", "بیماران"], ["doctors", "پزشکان"], ["services", "خدمات"], ["schedules", "برنامهٔ پزشکان"], ["appointments", "نوبت‌ها"], ["content", "محتوا"], ["files", "فایل‌ها"], ["settings", "تنظیمات"]] as const;
type Tab = (typeof TABS)[number][0];
const DAYS = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];
const MODES: [string, string][] = [["IN_PERSON", "حضوری"], ["VIDEO", "ویدئویی"], ["AUDIO", "صوتی"], ["TEXT", "متنی"]];
const modeLabel = (mode: string) => MODES.find(([key]) => key === mode)?.[1] || mode;
const STATUS: Record<string, string> = { PENDING: "در انتظار تأیید", CONFIRMED: "تأییدشده", CANCELLED: "لغوشده", COMPLETED: "انجام‌شده" };
const when = (iso: string) => new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(iso));
const fa = (value: number) => value.toLocaleString("fa-IR");
const input = "min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-[#2b2a27]";
const button = "min-h-11 rounded-xl bg-[#2b2a27] px-4 text-sm font-bold text-white disabled:opacity-40";
const ghost = "min-h-11 rounded-xl border border-stone-300 px-4 text-sm font-bold";

function useQuery<T>(path: string | null): Query<T> {
  const [data, setData] = useState<T | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(Boolean(path));
  const reload = useCallback(async () => {
    if (!path) return;
    try {
      const response = await apiFetch(path);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setError(response.status === 403 ? "این بخش فقط برای مالک یا مدیر Workspace در دسترس است." : body.message || "بارگذاری ناموفق بود."); setData(null); }
      else { setData(body as T); setError(""); }
    } catch { setError("ارتباط با سرور برقرار نشد."); } finally { setLoading(false); }
  }, [path]);
  useEffect(() => { void reload(); }, [reload]);
  return { data, error, loading, reload };
}

const Panel = ({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) => <section className="min-w-0 rounded-3xl border border-[#d9bc83]/40 bg-white p-5"><h2 className="text-lg font-black">{title}</h2>{hint && <p className="mt-1 text-xs leading-6 text-stone-500">{hint}</p>}<div className="mt-4">{children}</div></section>;
const Empty = ({ children }: { children: ReactNode }) => <p data-empty className="rounded-2xl border border-dashed border-[#d9bc83]/60 p-4 text-sm leading-7 text-stone-600">{children}</p>;
const Problem = ({ children }: { children: ReactNode }) => children ? <p role="alert" className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800">{children}</p> : null;
const Stat = ({ label, value }: { label: string; value: number | string }) => <div data-stat={label} className="rounded-2xl bg-[#f7f3ea] p-4"><p className="text-xs text-stone-500">{label}</p><p className="mt-1 text-2xl font-black">{typeof value === "number" ? fa(value) : value}</p></div>;
const Row = ({ children }: { children: ReactNode }) => <article className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#f7f3ea] p-4 text-sm">{children}</article>;

export default function MedicalControlCenterPage() {
  const { siteProjectId = "" } = useParams();
  const id = encodeURIComponent(siteProjectId);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const site = useQuery<{ project?: { name?: string; siteType?: string; status?: string } }>(`/api/site-projects/${id}`);
  const summary = useQuery<{ summary: Json }>(`/api/site-projects/${id}/medical/summary`);
  const booking = useQuery<{ services: Json[]; providers: Json[]; associations: Json[]; availability: Json[]; appointments: Json[] }>(`/api/booking?siteProjectId=${id}`);
  const doctors = useQuery<{ doctors: Json[] }>(`/api/site-projects/${id}/doctor-identities`);
  const patients = useQuery<{ patients: Json[] }>(tab === "patients" ? `/api/site-projects/${id}/medical/patients` : null);
  const files = useQuery<{ documents: Json[] }>(tab === "files" ? `/api/site-projects/${id}/medical-documents` : null);
  const settings = useQuery<{ settings: Json }>(tab === "settings" ? `/api/site-projects/${id}/medical/settings` : null);

  const refreshAll = useCallback(async () => { await Promise.all([summary.reload(), booking.reload(), doctors.reload(), patients.reload(), files.reload(), settings.reload()]); }, [summary, booking, doctors, patients, files, settings]);
  async function act(path: string, method: string, body?: object, ok = "انجام شد.") {
    setNotice(null);
    const response = await apiFetch(path, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify({ siteProjectId, ...body }) : undefined });
    const result = await response.json().catch(() => ({}));
    setNotice(response.ok ? { tone: "ok", text: ok } : { tone: "error", text: result.message || "عملیات انجام نشد." });
    await refreshAll();
    return response.ok;
  }

  const providers = booking.data?.providers || [], services = booking.data?.services || [], associations = booking.data?.associations || [];
  const identityOf = (providerId: string) => doctors.data?.doctors.find((entry) => entry.providerId === providerId);
  const notMedical = site.data?.project && String(site.data.project.siteType).toUpperCase() !== "MEDICAL";

  return <main dir="rtl" data-medical-control-center className="min-h-screen bg-[#f7f3ea] px-4 py-6 text-[#2b2a27] sm:p-10">
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="rounded-3xl bg-[#2b2a27] p-6 text-[#f7f3ea] sm:p-8">
        <Link to="/dashboard/websites" className="text-xs font-bold text-[#d9bc83]">سایت‌های من</Link>
        <p className="mt-5 text-xs text-[#d9bc83]">مرکز مدیریت درمانی</p>
        <h1 className="mt-1 break-words text-2xl font-black sm:text-3xl">{site.data?.project?.name || "مرکز درمانی"}</h1>
      </header>
      {site.error && <Problem>{site.error}</Problem>}
      {notMedical && <Problem>این سایت از نوع درمانی نیست.</Problem>}
      {notice && <p role={notice.tone === "error" ? "alert" : "status"} className={`rounded-2xl border p-4 text-sm ${notice.tone === "error" ? "border-rose-300 bg-rose-50 text-rose-800" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}>{notice.text}</p>}
      {!notMedical && <>
        <nav aria-label="بخش‌ها" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">{TABS.map(([key, label]) => <button key={key} type="button" data-tab={key} aria-current={tab === key} onClick={() => setTab(key)} className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-bold ${tab === key ? "bg-[#5f7560] text-white" : "border border-stone-300 bg-white"}`}>{label}</button>)}</nav>

        {tab === "dashboard" && <Panel title="نمای کلی" hint="فقط شمارش رکوردهای واقعی همین مرکز؛ هیچ شاخص برآوردی نمایش داده نمی‌شود.">
          <Problem>{summary.error}</Problem>
          {summary.data && <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="بیماران" value={summary.data.summary.patients} /><Stat label="پزشکان" value={summary.data.summary.providers} /><Stat label="پزشکان دارای ورود" value={summary.data.summary.doctorIdentities} /><Stat label="خدمات" value={summary.data.summary.services} />
            <Stat label="نوبت‌های پیش‌رو" value={summary.data.summary.upcoming} /><Stat label="در انتظار تأیید" value={summary.data.summary.appointments.PENDING} /><Stat label="تأییدشده" value={summary.data.summary.appointments.CONFIRMED} /><Stat label="مدارک فعال" value={summary.data.summary.documents} />
          </div>}
          {summary.data && summary.data.summary.appointments.total === 0 && <div className="mt-4"><Empty>هنوز نوبتی ثبت نشده است. پس از تعریف خدمت، پزشک و زمان در دسترس، نوبت‌ها اینجا شمارش می‌شوند.</Empty></div>}
        </Panel>}

        {tab === "patients" && <Panel title="بیماران" hint="کاربران واقعی که با شمارهٔ موبایل وارد این مرکز شده‌اند. شماره‌ها پنهان نمایش داده می‌شود.">
          <Problem>{patients.error}</Problem>
          {patients.data && !patients.data.patients.length && <Empty>هنوز بیماری وارد نشده است.</Empty>}
          <div className="space-y-2">{patients.data?.patients.map((patient) => <Row key={patient.id}><span data-patient className="min-w-0 break-words"><b>{patient.displayName || "بدون نام"}</b> <bdi dir="ltr" className="text-xs text-stone-500">{patient.mobile}</bdi></span><span className="text-xs text-stone-500">{fa(patient.appointments)} نوبت · {patient.status === "active" ? "فعال" : "غیرفعال"}</span></Row>)}</div>
        </Panel>}

        {tab === "doctors" && <DoctorsTab providers={providers} identityOf={identityOf} act={act} error={booking.error || doctors.error} />}
        {tab === "services" && <ServicesTab services={services} providers={providers} associations={associations} act={act} error={booking.error} />}
        {tab === "schedules" && <SchedulesTab providers={providers} availability={booking.data?.availability || []} act={act} />}
        {tab === "appointments" && <AppointmentsTab appointments={booking.data?.appointments || []} services={services} providers={providers} act={act} error={booking.error} />}

        {tab === "content" && <Panel title="محتوا" hint="صفحات سایت در ویرایشگر یکسان وب‌سایت‌ساز ویرایش و منتشر می‌شود؛ محتوای جداگانه‌ای برای بخش درمان وجود ندارد.">
          <Row><span>وضعیت انتشار: <b data-site-status>{site.data?.project?.status === "PUBLISHED" ? "منتشرشده" : site.data?.project?.status === "DRAFT" ? "پیش‌نویس" : site.data?.project?.status || "—"}</b></span><Link to={`/dashboard/websites/corporate?project=${id}`} className={`${ghost} inline-flex items-center`}>باز کردن ویرایشگر</Link></Row>
        </Panel>}

        {tab === "files" && <FilesTab files={files} siteId={id} setNotice={setNotice} />}

        {tab === "settings" && <Panel title="تنظیمات و آمادگی" hint="وضعیت واقعی پیکربندی؛ هر مانع تولید صریح نمایش داده می‌شود.">
          <Problem>{settings.error}</Problem>
          {settings.data && <div className="space-y-2" data-settings>
            <Row><span>ورود بیماران با موبایل: <b>{settings.data.settings.patientIdentity.enabled ? "فعال" : "غیرفعال"}</b></span>{!settings.data.settings.patientIdentity.enabled && <button type="button" onClick={() => act(`/api/site-projects/${id}/patient-identity`, "POST", undefined, "ورود بیماران فعال شد.")} className={button}>فعال‌سازی</button>}</Row>
            <Row><span>ارسال پیامک کد ورود: <b data-otp-state>{settings.data.settings.otpDelivery.configured ? (settings.data.settings.otpDelivery.simulator ? "شبیه‌ساز (فقط آزمایشی)" : "پیکربندی‌شده") : "پیکربندی نشده"}</b></span></Row>
            {settings.data.settings.environment === "production" && !settings.data.settings.otpDelivery.configured && <Problem>در تولید، بدون ارائه‌دهندهٔ پیامک واقعی ورود بیماران کار نمی‌کند.</Problem>}
            <Row><span>مدارک خصوصی: <b data-documents-state>{settings.data.settings.documents.productionReady ? "آمادهٔ تولید" : "آمادهٔ تولید نیست"}</b></span><span className="text-xs text-stone-500">اسکنر: {settings.data.settings.documents.scannerConfigured ? "پیکربندی‌شده" : "پیکربندی نشده"} · ذخیره‌سازی: {settings.data.settings.documents.storage}</span></Row>
          </div>}
        </Panel>}
      </>}
    </div>
  </main>;
}

type Act = (path: string, method: string, body?: object, ok?: string) => Promise<boolean>;

function DoctorsTab({ providers, identityOf, act, error }: { providers: Json[]; identityOf: (id: string) => Json | undefined; act: Act; error: string }) {
  const [name, setName] = useState(""); const [mobiles, setMobiles] = useState<Record<string, string>>({});
  const add = async (event: FormEvent) => { event.preventDefault(); if (await act("/api/booking/providers", "POST", { name }, "پزشک افزوده شد.")) setName(""); };
  return <Panel title="پزشکان" hint="پزشکان همان ارائه‌دهندگان نوبت‌دهی همین مرکزند؛ ورود پزشک با موبایل فقط توسط مالک یا مدیر تعریف می‌شود.">
    <Problem>{error}</Problem>
    <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row"><input aria-label="نام پزشک" value={name} onChange={(e) => setName(e.target.value)} placeholder="نام پزشک" className={input} /><button disabled={!name.trim()} className={button}>افزودن پزشک</button></form>
    <div className="mt-4 space-y-2">{!providers.length && <Empty>هنوز پزشکی تعریف نشده است.</Empty>}
      {providers.map((provider) => { const identity = identityOf(provider.id); const active = identity?.status === "active"; return <Row key={provider.id}>
        <span data-doctor className="min-w-0 break-words"><b>{provider.name}</b><span className="mr-2 text-xs text-stone-500">{active ? `ورود فعال · ${identity!.mobile}` : identity ? "ورود لغوشده" : "بدون ورود"}</span></span>
        {active ? <button type="button" onClick={() => act(`/api/site-projects/${encodeURIComponent(provider.site_project_id)}/doctor-identities/${encodeURIComponent(provider.id)}`, "DELETE", undefined, "دسترسی پزشک لغو شد.")} className={`${ghost} text-rose-700`}>لغو دسترسی</button>
          : !identity && <form className="flex gap-2" onSubmit={async (event) => { event.preventDefault(); await act(`/api/site-projects/${encodeURIComponent(provider.site_project_id)}/doctor-identities`, "POST", { providerId: provider.id, mobile: mobiles[provider.id] || "", displayName: provider.name }, "ورود پزشک تعریف شد."); }}><input aria-label={`موبایل ${provider.name}`} dir="ltr" value={mobiles[provider.id] || ""} onChange={(e) => setMobiles({ ...mobiles, [provider.id]: e.target.value })} placeholder="09123456789" className={`${input} w-40`} /><button className={button}>تعریف ورود</button></form>}
      </Row>; })}</div>
  </Panel>;
}

function ServicesTab({ services, providers, associations, act, error }: { services: Json[]; providers: Json[]; associations: Json[]; act: Act; error: string }) {
  const [form, setForm] = useState({ name: "", duration: "30", price: "", modes: ["IN_PERSON"] as string[] });
  const [link, setLink] = useState({ providerId: "", serviceId: "" });
  const create = async (event: FormEvent) => { event.preventDefault(); const price = form.price.trim(); if (await act("/api/booking/services", "POST", { name: form.name, durationMinutes: Number(form.duration), modalities: form.modes, ...(price ? { priceAmount: Number(price), priceCurrency: "IRT" } : {}) }, "خدمت افزوده شد.")) setForm({ name: "", duration: "30", price: "", modes: ["IN_PERSON"] }); };
  const toggle = (mode: string) => setForm({ ...form, modes: form.modes.includes(mode) ? form.modes.filter((m) => m !== mode) : [...form.modes, mode] });
  const restrict = (providerId: string, serviceId: string, modalities: string[] | null) => act(`/api/booking/providers/${encodeURIComponent(providerId)}/services/${encodeURIComponent(serviceId)}/modalities`, "PUT", { modalities }, "شیوه‌های مراجعهٔ پزشک ذخیره شد.");
  return <Panel title="خدمات" hint="مدت، شیوه‌های مراجعه و هزینه همان داده‌ای است که در سایت و رزرو نمایش داده می‌شود. شیوهٔ «متنی» هنوز قابل رزرو عمومی نیست.">
    <Problem>{error}</Problem>
    <form onSubmit={create} className="grid gap-2 sm:grid-cols-2">
      <input aria-label="نام خدمت" className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="نام خدمت" />
      <input aria-label="مدت (دقیقه)" type="number" min={5} className={input} value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
      <input aria-label="هزینه (تومان، اختیاری)" type="number" min={0} className={input} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="هزینه (اختیاری)" />
      <div className="flex flex-wrap items-center gap-3 text-sm">{MODES.map(([key, label]) => <label key={key} className="flex items-center gap-1"><input type="checkbox" checked={form.modes.includes(key)} onChange={() => toggle(key)} />{label}</label>)}</div>
      <button disabled={!form.name.trim()} className={`${button} sm:col-span-2`}>افزودن خدمت</button>
    </form>
    <div className="mt-4 space-y-2">{!services.length && <Empty>هنوز خدمتی تعریف نشده است.</Empty>}
      {services.map((service) => { const modes: string[] = JSON.parse(service.modalities_json || "[]"); const links = associations.filter((a) => a.serviceId === service.id); return <article key={service.id} data-service className="rounded-2xl bg-[#f7f3ea] p-4 text-sm">
        <b className="break-words">{service.name}</b><span className="mr-2 text-xs text-stone-500">{fa(service.duration_minutes)} دقیقه · {modes.length ? modes.map(modeLabel).join("، ") : "بدون شیوهٔ مشخص"}{service.price_amount != null ? ` · ${fa(service.price_amount)} ${service.price_currency || ""}` : ""}</span>
        <div className="mt-2 space-y-1">{links.map((l) => { const provider = providers.find((p) => p.id === l.providerId); const current: string[] | null = l.modalities; return <div key={l.providerId} className="flex flex-wrap items-center gap-2 text-xs"><span>{provider?.name}:</span>{modes.map((mode) => <label key={mode} className="flex items-center gap-1"><input type="checkbox" checked={!current || current.includes(mode)} onChange={() => { const base = current ?? modes; const next = base.includes(mode) ? base.filter((m) => m !== mode) : [...base, mode]; void restrict(l.providerId, service.id, next.length === modes.length ? null : next); }} />{modeLabel(mode)}</label>)}</div>; })}</div></article>; })}</div>
    <form className="mt-4 grid gap-2 sm:grid-cols-3" onSubmit={async (event) => { event.preventDefault(); if (await act(`/api/booking/providers/${encodeURIComponent(link.providerId)}/services/${encodeURIComponent(link.serviceId)}`, "POST", {}, "پزشک به خدمت متصل شد.")) setLink({ providerId: "", serviceId: "" }); }}>
      <select aria-label="پزشک" className={input} value={link.providerId} onChange={(e) => setLink({ ...link, providerId: e.target.value })}><option value="">پزشک…</option>{providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      <select aria-label="خدمت" className={input} value={link.serviceId} onChange={(e) => setLink({ ...link, serviceId: e.target.value })}><option value="">خدمت…</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      <button disabled={!link.providerId || !link.serviceId} className={button}>اتصال پزشک به خدمت</button>
    </form>
  </Panel>;
}

function SchedulesTab({ providers, availability, act }: { providers: Json[]; availability: Json[]; act: Act }) {
  const [draft, setDraft] = useState({ providerId: "", weekday: "1", startsAt: "09:00", endsAt: "10:00", capacity: "1" });
  return <Panel title="برنامهٔ پزشکان" hint="زمان‌های در دسترس هر پزشک؛ پزشک هم می‌تواند برنامهٔ خودش را در پرتال پزشک ویرایش کند.">
    {!providers.length && <Empty>ابتدا پزشک تعریف کنید.</Empty>}
    {providers.map((provider) => { const slots = availability.filter((slot) => slot.provider_id === provider.id); return <div key={provider.id} className="mb-4"><h3 className="text-sm font-black">{provider.name}</h3>{!slots.length ? <Empty>زمانی ثبت نشده است.</Empty> : <div className="mt-2 space-y-1">{slots.map((slot) => <Row key={slot.id}><span data-slot>{DAYS[slot.weekday]} · <bdi dir="ltr">{slot.starts_at}–{slot.ends_at}</bdi> · ظرفیت {fa(slot.capacity)}</span><span className="text-xs text-stone-500">{slot.status === "ACTIVE" ? "فعال" : "لغوشده"}</span></Row>)}</div>}</div>; })}
    {providers.length > 0 && <form className="grid gap-2 sm:grid-cols-6" onSubmit={async (event) => { event.preventDefault(); await act("/api/booking/availability", "POST", { providerId: draft.providerId, weekday: Number(draft.weekday), startsAt: draft.startsAt, endsAt: draft.endsAt, capacity: Number(draft.capacity) }, "زمان افزوده شد."); }}>
      <select aria-label="پزشک زمان" className={input} value={draft.providerId} onChange={(e) => setDraft({ ...draft, providerId: e.target.value })}><option value="">پزشک…</option>{providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      <select aria-label="روز" className={input} value={draft.weekday} onChange={(e) => setDraft({ ...draft, weekday: e.target.value })}>{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select>
      <input aria-label="از" type="time" className={input} value={draft.startsAt} onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })} /><input aria-label="تا" type="time" className={input} value={draft.endsAt} onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })} />
      <input aria-label="ظرفیت" type="number" min={1} className={input} value={draft.capacity} onChange={(e) => setDraft({ ...draft, capacity: e.target.value })} /><button disabled={!draft.providerId} className={button}>افزودن زمان</button>
    </form>}
  </Panel>;
}

function AppointmentsTab({ appointments, services, providers, act, error }: { appointments: Json[]; services: Json[]; providers: Json[]; act: Act; error: string }) {
  const [filter, setFilter] = useState("ALL");
  const shown = appointments.filter((a) => filter === "ALL" || a.status === filter);
  const status = (id: string, to: string) => act(`/api/booking/appointments/${encodeURIComponent(id)}/status`, "POST", { status: to }, "وضعیت نوبت تغییر کرد.");
  return <Panel title="نوبت‌ها" hint="همان رکوردهای نوبت‌دهی؛ تغییر وضعیت فقط مطابق قرارداد مجاز و ثبت‌شده در سابقهٔ حساس است.">
    <Problem>{error}</Problem>
    <div className="mb-3 flex flex-wrap gap-2">{["ALL", "PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"].map((key) => <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)} className={`${ghost} ${filter === key ? "bg-[#2b2a27] text-white" : ""}`}>{key === "ALL" ? "همه" : STATUS[key]}</button>)}</div>
    {!shown.length && <Empty>نوبتی برای نمایش وجود ندارد.</Empty>}
    <div className="space-y-2">{shown.map((a) => <Row key={a.id}>
      <span data-appointment-row className="min-w-0 break-words"><b>{a.customer_name}</b> · {services.find((s) => s.id === a.service_id)?.name} · {providers.find((p) => p.id === a.provider_id)?.name}<br /><span className="text-xs text-stone-500">{when(a.starts_at)} · {STATUS[a.status] || a.status}{a.modality ? ` · ${modeLabel(a.modality)}` : ""}{a.booking_reference ? ` · ${a.booking_reference}` : ""}{a.app_user_id ? " · با حساب بیمار" : ""}</span></span>
      <span className="flex gap-2">{a.status === "PENDING" && <button type="button" onClick={() => status(a.id, "CONFIRMED")} className={button}>تأیید</button>}{["PENDING", "CONFIRMED"].includes(a.status) && <button type="button" onClick={() => status(a.id, "CANCELLED")} className={`${ghost} text-rose-700`}>لغو</button>}{a.status === "CONFIRMED" && Date.parse(a.starts_at) <= Date.now() && <button type="button" onClick={() => status(a.id, "COMPLETED")} className={button}>ثبت انجام</button>}</span>
    </Row>)}</div>
  </Panel>;
}

function FilesTab({ files, siteId, setNotice }: { files: Query<{ documents: Json[] }>; siteId: string; setNotice: (n: { tone: "ok" | "error"; text: string } | null) => void }) {
  const [reason, setReason] = useState<Record<string, string>>({});
  async function open(documentId: string) {
    const response = await apiFetch(`/api/site-projects/${siteId}/medical-documents/${encodeURIComponent(documentId)}/access`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: reason[documentId] || "" }) });
    if (!response.ok) { const body = await response.json().catch(() => ({})); setNotice({ tone: "error", text: body.code === "MEDICAL_DOCUMENT_REASON_REQUIRED" ? "دلیل دسترسی (۱۰ تا ۲۰۰ نویسه) الزامی است." : "باز کردن فایل ممکن نشد." }); return; }
    const url = URL.createObjectURL(await response.blob()); const link = document.createElement("a"); link.href = url; link.download = "document"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10_000); setNotice({ tone: "ok", text: "دسترسی ثبت شد." });
  }
  return <Panel title="فایل‌ها" hint="مدارک خصوصی بیماران؛ مالک فقط فراداده را می‌بیند و باز کردن هر فایل با ثبت دلیل و در سابقهٔ حساس ثبت می‌شود.">
    <Problem>{files.error}</Problem>
    {files.data && !files.data.documents.length && <Empty>هنوز مدرکی بارگذاری نشده است.</Empty>}
    <div className="space-y-2">{files.data?.documents.map((doc) => <Row key={doc.id}>
      <span data-file className="text-xs">{doc.mimeType} · {fa(Math.ceil(doc.sizeBytes / 1024))} کیلوبایت · {doc.lifecycleState === "deleted" ? "حذف‌شده" : doc.scanState === "clean" ? "اسکن‌شده" : "بدون اسکن (آزمایشی)"}</span>
      {doc.lifecycleState === "active" && <span className="flex w-full min-w-0 gap-2"><input aria-label="دلیل دسترسی" value={reason[doc.id] || ""} onChange={(e) => setReason({ ...reason, [doc.id]: e.target.value })} placeholder="دلیل دسترسی" className={`${input} min-w-0 flex-1`} /><button type="button" onClick={() => open(doc.id)} className={button}>باز کردن</button></span>}
    </Row>)}</div>
  </Panel>;
}
