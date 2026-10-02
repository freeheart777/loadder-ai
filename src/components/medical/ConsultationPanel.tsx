import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { apiFetch } from "../../lib/api";

type Consultation = { id: string; modality: string; state: string; joinLink: string | null; joinLinkSet: boolean; joinAvailableFrom: string };
type Props = { siteProjectId: string; appointmentId: string; token: string; mode: "patient" | "doctor" };

const STATE: Record<string, string> = { scheduled: "مشاورهٔ آنلاین برنامه‌ریزی شده", in_progress: "مشاوره در جریان است", completed: "مشاوره انجام شد", missed: "مشاوره برگزار نشد", cancelled: "مشاوره لغو شد" };
const ERRORS: Record<string, string> = {
  CONSULTATION_JOIN_LINK_INVALID: "پیوند باید یک نشانی https معتبر باشد.",
  CONSULTATION_NOT_STARTED: "هنوز زود است؛ شروع از ۱۵ دقیقه پیش از نوبت ممکن است.",
  CONSULTATION_NOT_ENDED: "زمان نوبت هنوز تمام نشده است.",
  CONSULTATION_TRANSITION_INVALID: "این اقدام در وضعیت فعلی مجاز نیست.",
  CONSULTATION_CLOSED: "این مشاوره بسته شده است.",
};
const time = (iso: string) => new Intl.DateTimeFormat("fa-IR", { timeStyle: "short", dateStyle: "medium", timeZone: "UTC" }).format(new Date(iso));

// The online consultation of a remote appointment. There is no video provider here:
// the join link is an address the doctor entered, shown to the patient only when due.
export default function ConsultationPanel({ siteProjectId, appointmentId, token, mode }: Props) {
  const url = `/api/auth/site/${encodeURIComponent(siteProjectId)}/${mode}/appointments/${encodeURIComponent(appointmentId)}/consultation`;
  const headers = useCallback((): Record<string, string> => ({ "X-Loadder-App-Token": token }), [token]);
  const [data, setData] = useState<Consultation | null | undefined>(undefined);
  const [link, setLink] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const response = await apiFetch(url, { headers: headers() });
    const body = await response.json().catch(() => ({}));
    setData(response.ok ? body.consultation : null);
  }, [url, headers]);
  useEffect(() => { void load(); }, [load]);

  async function call(path: string, method: string, body?: object) {
    setMessage("");
    const response = await apiFetch(`${url}${path}`, { method, headers: { "Content-Type": "application/json", ...headers() }, body: body ? JSON.stringify(body) : undefined });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) setMessage(ERRORS[result.code] || "عملیات انجام نشد."); else if (path === "/join-link") setLink("");
    await load();
  }
  const saveLink = (event: FormEvent) => { event.preventDefault(); void call("/join-link", "PUT", { url: link }); };

  if (!data) return null;
  const open = data.state === "scheduled" || data.state === "in_progress";
  return <div data-consultation={data.state} className="mt-3 rounded-2xl bg-black/5 p-3 text-xs text-[#2b2a27]">
    <p className="font-black">{STATE[data.state] || data.state} · {data.modality === "VIDEO" ? "ویدئویی" : "صوتی"}</p>
    {mode === "patient" && open && (data.joinLink
      ? <a data-join-link href={data.joinLink} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center rounded-xl bg-[#5f7560] px-4 font-black text-white">ورود به جلسه</a>
      : <p data-join-pending className="mt-1 opacity-70">{data.joinLinkSet ? `پیوند ورود از ${time(data.joinAvailableFrom)} (۱۵ دقیقه پیش از شروع) نمایش داده می‌شود.` : "پزشک هنوز پیوند ورود را ثبت نکرده است."}</p>)}
    {mode === "doctor" && open && <div className="mt-2 space-y-2">
      <form onSubmit={saveLink} className="flex gap-2"><input aria-label="پیوند جلسه" dir="ltr" value={link} onChange={(event) => setLink(event.target.value)} placeholder={data.joinLinkSet ? "پیوند ثبت شده است (برای تغییر، پیوند جدید وارد کنید)" : "https://…"} className="min-h-11 min-w-0 flex-1 rounded-lg border border-[#2b2a27]/20 bg-white px-3 text-xs" /><button disabled={!link.trim()} className="min-h-11 rounded-lg bg-[#5f7560] px-3 font-black text-white disabled:opacity-50">ثبت پیوند</button></form>
      <div className="flex flex-wrap gap-2">
        {data.joinLinkSet && <button type="button" onClick={() => call("/join-link", "PUT", { url: null })} className="min-h-11 rounded-lg border border-[#2b2a27]/20 px-3 font-bold">حذف پیوند</button>}
        {data.state === "scheduled" && <button type="button" onClick={() => call("/start", "POST")} className="min-h-11 rounded-lg bg-[#2b2a27] px-3 font-bold text-white">شروع مشاوره</button>}
        {data.state === "in_progress" && <button type="button" onClick={() => call("/complete", "POST")} className="min-h-11 rounded-lg bg-[#2b2a27] px-3 font-bold text-white">پایان مشاوره</button>}
        {data.state === "scheduled" && <button type="button" onClick={() => call("/missed", "POST")} className="min-h-11 rounded-lg border border-[#2b2a27]/20 px-3 font-bold">برگزار نشد</button>}
      </div>
    </div>}
    {message && <p role="alert" className="mt-2 rounded-lg bg-rose-50 p-2 text-rose-800">{message}</p>}
  </div>;
}
