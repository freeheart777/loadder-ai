import { useCallback, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { apiFetch } from "../../lib/api";
import { formatAppointmentWhen } from "../../lib/appointmentTime";
import { indef } from "./modules";
import type { Vocabulary } from "./modules";
import { Empty, Panel, Problem, Row, button, fa, ghost, input, useQuery } from "./ui";
import type { Json, Notice } from "./ui";

// The ONE management UI over the canonical Booking engine (services, providers, links,
// availability, appointments). Medical, Education and the workspace Booking Studio all use
// these panels; only the vocabulary differs. No second repository, no second state machine.
export type BookingData = { services: Json[]; providers: Json[]; associations: Json[]; availability: Json[]; appointments: Json[] };
export type Act = (path: string, method: string, body?: object, ok?: string) => Promise<boolean>;

const DAYS = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];
const STATUS: Record<string, string> = { PENDING: "در انتظار تأیید", CONFIRMED: "تأییدشده", CANCELLED: "لغوشده", COMPLETED: "انجام‌شده" };

/** Booking records for one site (`?siteProjectId=`) or for the workspace itself, plus the one mutation helper. */
export function useBookingAdmin(siteProjectId: string | undefined, setNotice: (notice: Notice) => void, afterChange?: () => Promise<unknown> | void) {
  const booking = useQuery<BookingData>(siteProjectId ? `/api/booking?siteProjectId=${encodeURIComponent(siteProjectId)}` : "/api/booking");
  const { reload } = booking;
  const act: Act = useCallback(async (path, method, body, ok = "انجام شد.") => {
    setNotice(null);
    const response = await apiFetch(path, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify({ ...(siteProjectId ? { siteProjectId } : {}), ...body }) : undefined });
    const result = await response.json().catch(() => ({}));
    setNotice(response.ok ? { tone: "ok", text: ok } : { tone: "error", text: result.message || "عملیات انجام نشد." });
    await Promise.all([reload(), afterChange?.()]);
    return response.ok;
  }, [siteProjectId, reload, afterChange, setNotice]);
  return { booking, act };
}

type ProviderPanelProps = { vocab: Vocabulary; providers: Json[]; act: Act; error: string; hint?: string; /** Vertical-only controls for one provider row (e.g. doctor sign-in). */ rowExtra?: (provider: Json) => ReactNode; rowNote?: (provider: Json) => ReactNode };

export function ProvidersPanel({ vocab, providers, act, error, hint, rowExtra, rowNote }: ProviderPanelProps) {
  const [name, setName] = useState("");
  const add = async (event: FormEvent) => { event.preventDefault(); if (await act("/api/booking/providers", "POST", { name }, `${vocab.provider} افزوده شد.`)) setName(""); };
  return <Panel title={vocab.providers} hint={hint}>
    <Problem>{error}</Problem>
    <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row"><input aria-label={`نام ${vocab.provider}`} value={name} onChange={(e) => setName(e.target.value)} placeholder={`نام ${vocab.provider}`} className={input} /><button disabled={!name.trim()} className={button}>افزودن {vocab.provider}</button></form>
    <div className="mt-4 space-y-2">{!providers.length && <Empty>هنوز {indef(vocab.provider)} تعریف نشده است.</Empty>}
      {providers.map((provider) => <Row key={provider.id}>
        <span data-provider className="min-w-0 break-words"><b>{provider.name}</b>{rowNote?.(provider)}</span>
        {rowExtra?.(provider)}
      </Row>)}</div>
  </Panel>;
}

export function ServicesPanel({ vocab, services, providers, associations, act, error, hint }: { vocab: Vocabulary; services: Json[]; providers: Json[]; associations: Json[]; act: Act; error: string; hint?: string }) {
  const firstMode = vocab.modes[0][0];
  const blank = { name: "", duration: "30", price: "", modes: [firstMode] as string[] };
  const [form, setForm] = useState(blank);
  const [link, setLink] = useState({ providerId: "", serviceId: "" });
  const modeLabel = (mode: string) => vocab.modes.find(([key]) => key === mode)?.[1] || mode;
  const create = async (event: FormEvent) => { event.preventDefault(); const price = form.price.trim(); if (await act("/api/booking/services", "POST", { name: form.name, durationMinutes: Number(form.duration), modalities: form.modes, ...(price ? { priceAmount: Number(price), priceCurrency: "IRT" } : {}) }, `${vocab.service} افزوده شد.`)) setForm(blank); };
  const toggle = (mode: string) => setForm({ ...form, modes: form.modes.includes(mode) ? form.modes.filter((m) => m !== mode) : [...form.modes, mode] });
  const restrict = (providerId: string, serviceId: string, modalities: string[] | null) => act(`/api/booking/providers/${encodeURIComponent(providerId)}/services/${encodeURIComponent(serviceId)}/modalities`, "PUT", { modalities }, `${vocab.mode}‌های ${vocab.provider} ذخیره شد.`);
  return <Panel title={vocab.services} hint={hint}>
    <Problem>{error}</Problem>
    <form onSubmit={create} className="grid gap-2 sm:grid-cols-2">
      <input aria-label={`نام ${vocab.service}`} className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={`نام ${vocab.service}`} />
      <input aria-label="مدت (دقیقه)" type="number" min={5} className={input} value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
      <input aria-label="هزینه (تومان، اختیاری)" type="number" min={0} className={input} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="هزینه (اختیاری)" />
      <div className="flex flex-wrap items-center gap-3 text-sm">{vocab.modes.map(([key, label]) => <label key={key} className="flex min-h-11 items-center gap-1"><input type="checkbox" checked={form.modes.includes(key)} onChange={() => toggle(key)} />{label}</label>)}</div>
      <button disabled={!form.name.trim()} className={`${button} sm:col-span-2`}>افزودن {vocab.service}</button>
    </form>
    <div className="mt-4 space-y-2">{!services.length && <Empty>هنوز {indef(vocab.service)} تعریف نشده است.</Empty>}
      {services.map((service) => { const modes: string[] = JSON.parse(service.modalities_json || "[]"); const links = associations.filter((a) => a.serviceId === service.id); return <article key={service.id} data-service className="rounded-2xl bg-[#f7f3ea] p-4 text-sm">
        <b className="break-words">{service.name}</b><span className="mr-2 text-xs text-stone-500">{fa(service.duration_minutes)} دقیقه · {modes.length ? modes.map(modeLabel).join("، ") : `بدون ${vocab.mode} مشخص`}{service.price_amount != null ? ` · ${fa(service.price_amount)} ${service.price_currency === "IRT" ? "تومان" : service.price_currency || ""}` : ""}</span>
        <div className="mt-2 space-y-1">{links.map((l) => { const provider = providers.find((p) => p.id === l.providerId); const current: string[] | null = l.modalities; return <div key={l.providerId} className="flex flex-wrap items-center gap-2 text-xs"><span>{provider?.name}:</span>{modes.map((mode) => <label key={mode} className="flex items-center gap-1"><input type="checkbox" checked={!current || current.includes(mode)} onChange={() => { const base = current ?? modes; const next = base.includes(mode) ? base.filter((m) => m !== mode) : [...base, mode]; void restrict(l.providerId, service.id, next.length === modes.length ? null : next); }} />{modeLabel(mode)}</label>)}</div>; })}</div></article>; })}</div>
    <form className="mt-4 grid gap-2 sm:grid-cols-3" onSubmit={async (event) => { event.preventDefault(); if (await act(`/api/booking/providers/${encodeURIComponent(link.providerId)}/services/${encodeURIComponent(link.serviceId)}`, "POST", {}, `${vocab.provider} به ${vocab.service} متصل شد.`)) setLink({ providerId: "", serviceId: "" }); }}>
      <select aria-label={vocab.provider} className={input} value={link.providerId} onChange={(e) => setLink({ ...link, providerId: e.target.value })}><option value="">{vocab.provider}…</option>{providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      <select aria-label={vocab.service} className={input} value={link.serviceId} onChange={(e) => setLink({ ...link, serviceId: e.target.value })}><option value="">{vocab.service}…</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      <button disabled={!link.providerId || !link.serviceId} className={button}>اتصال {vocab.provider} به {vocab.service}</button>
    </form>
  </Panel>;
}

export function SchedulesPanel({ vocab, providers, availability, act, hint }: { vocab: Vocabulary; providers: Json[]; availability: Json[]; act: Act; hint?: string }) {
  const [draft, setDraft] = useState({ providerId: "", weekday: "1", startsAt: "09:00", endsAt: "10:00", capacity: "1" });
  return <Panel title={vocab.schedule} hint={hint}>
    {!providers.length && <Empty>ابتدا {vocab.provider} تعریف کنید.</Empty>}
    {providers.map((provider) => { const slots = availability.filter((slot) => slot.provider_id === provider.id); return <div key={provider.id} className="mb-4"><h3 className="text-sm font-black">{provider.name}</h3>{!slots.length ? <Empty>زمانی ثبت نشده است.</Empty> : <div className="mt-2 space-y-1">{slots.map((slot) => <Row key={slot.id}><span data-slot>{DAYS[slot.weekday]} · <bdi dir="ltr">{slot.starts_at}–{slot.ends_at}</bdi> · ظرفیت {fa(slot.capacity)}</span><span className="text-xs text-stone-500">{slot.status === "ACTIVE" ? "فعال" : "لغوشده"}</span></Row>)}</div>}</div>; })}
    {providers.length > 0 && <form className="grid gap-2 sm:grid-cols-6" onSubmit={async (event) => { event.preventDefault(); await act("/api/booking/availability", "POST", { providerId: draft.providerId, weekday: Number(draft.weekday), startsAt: draft.startsAt, endsAt: draft.endsAt, capacity: Number(draft.capacity) }, "زمان افزوده شد."); }}>
      <select aria-label={`${vocab.provider} زمان`} className={input} value={draft.providerId} onChange={(e) => setDraft({ ...draft, providerId: e.target.value })}><option value="">{vocab.provider}…</option>{providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      <select aria-label="روز" className={input} value={draft.weekday} onChange={(e) => setDraft({ ...draft, weekday: e.target.value })}>{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select>
      <input aria-label="از" type="time" className={input} value={draft.startsAt} onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })} /><input aria-label="تا" type="time" className={input} value={draft.endsAt} onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })} />
      <input aria-label="ظرفیت" type="number" min={1} className={input} value={draft.capacity} onChange={(e) => setDraft({ ...draft, capacity: e.target.value })} /><button disabled={!draft.providerId} className={button}>افزودن زمان</button>
    </form>}
  </Panel>;
}

/** Operator-entered appointment. The datetime-local value IS the clinic wall-clock time, so it is stored as that same wall-clock (never shifted by the operator's zone). */
function ManualAppointment({ vocab, services, providers, associations, act }: { vocab: Vocabulary; services: Json[]; providers: Json[]; associations: Json[]; act: Act }) {
  const [draft, setDraft] = useState({ providerId: "", serviceId: "", customerName: "", at: "" });
  const linked = associations.some((l) => l.providerId === draft.providerId && l.serviceId === draft.serviceId);
  const ready = draft.providerId && draft.serviceId && draft.customerName.trim() && draft.at && linked;
  const submit = async (event: FormEvent) => { event.preventDefault(); if (ready && await act("/api/booking/appointments", "POST", { providerId: draft.providerId, serviceId: draft.serviceId, customerName: draft.customerName.trim(), startsAt: `${draft.at.slice(0, 16)}:00.000Z` }, `${vocab.appointment} ثبت شد.`)) setDraft({ ...draft, customerName: "", at: "" }); };
  return <form onSubmit={submit} data-manual-appointment className="mb-4 grid gap-2 rounded-2xl border border-stone-200 p-3 sm:grid-cols-2">
    <select aria-label={`${vocab.provider} ${vocab.appointment}`} className={input} value={draft.providerId} onChange={(e) => setDraft({ ...draft, providerId: e.target.value })}><option value="">{vocab.provider}…</option>{providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
    <select aria-label={`${vocab.service} ${vocab.appointment}`} className={input} value={draft.serviceId} onChange={(e) => setDraft({ ...draft, serviceId: e.target.value })}><option value="">{vocab.service}…</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
    <input aria-label={`نام ${vocab.person}`} className={input} value={draft.customerName} onChange={(e) => setDraft({ ...draft, customerName: e.target.value })} placeholder={`نام ${vocab.person}`} />
    <input aria-label="زمان" type="datetime-local" className={input} value={draft.at} onChange={(e) => setDraft({ ...draft, at: e.target.value })} />
    {draft.providerId && draft.serviceId && !linked && <p className="text-xs text-rose-700 sm:col-span-2">ابتدا {vocab.provider} را به {vocab.service} متصل کنید.</p>}
    <button disabled={!ready} className={`${button} sm:col-span-2`}>ثبت {vocab.appointment}</button>
  </form>;
}

export function AppointmentsPanel({ vocab, appointments, services, providers, associations = [], manualCreate = false, act, error, hint }: { vocab: Vocabulary; appointments: Json[]; services: Json[]; providers: Json[]; associations?: Json[]; manualCreate?: boolean; act: Act; error: string; hint?: string }) {
  const [filter, setFilter] = useState("ALL");
  const modeLabel = (mode: string) => vocab.modes.find(([key]) => key === mode)?.[1] || mode;
  const shown = appointments.filter((a) => filter === "ALL" || a.status === filter);
  const status = (id: string, to: string) => act(`/api/booking/appointments/${encodeURIComponent(id)}/status`, "POST", { status: to }, `وضعیت ${vocab.appointment} تغییر کرد.`);
  return <Panel title={vocab.appointments} hint={hint}>
    <Problem>{error}</Problem>
    {manualCreate && <ManualAppointment vocab={vocab} services={services} providers={providers} associations={associations} act={act} />}
    <div className="mb-3 flex flex-wrap gap-2">{["ALL", "PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"].map((key) => <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)} className={`${ghost} ${filter === key ? "bg-[#2b2a27] text-white" : ""}`}>{key === "ALL" ? "همه" : STATUS[key]}</button>)}</div>
    {!shown.length && <Empty>{indef(vocab.appointment)} برای نمایش وجود ندارد.</Empty>}
    <div className="space-y-2">{shown.map((a) => <Row key={a.id}>
      <span data-appointment-row className="min-w-0 break-words"><b>{a.customer_name}</b> · {services.find((s) => s.id === a.service_id)?.name} · {providers.find((p) => p.id === a.provider_id)?.name}<br /><span className="text-xs text-stone-500">{formatAppointmentWhen(a.starts_at, "medium")} · {STATUS[a.status] || a.status}{a.modality ? ` · ${modeLabel(a.modality)}` : ""}{a.booking_reference ? ` · ${a.booking_reference}` : ""}{a.app_user_id ? ` · با حساب ${vocab.person}` : ""}</span></span>
      <span className="flex gap-2">{a.status === "PENDING" && <button type="button" onClick={() => status(a.id, "CONFIRMED")} className={button}>تأیید</button>}{["PENDING", "CONFIRMED"].includes(a.status) && <button type="button" onClick={() => status(a.id, "CANCELLED")} className={`${ghost} text-rose-700`}>لغو</button>}{a.status === "CONFIRMED" && Date.parse(a.starts_at) <= Date.now() && <button type="button" onClick={() => status(a.id, "COMPLETED")} className={button}>ثبت انجام</button>}</span>
    </Row>)}</div>
  </Panel>;
}
