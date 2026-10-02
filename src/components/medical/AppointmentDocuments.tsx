import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { apiFetch } from "../../lib/api";

type Doc = { id: string; title: string; fileName: string | null; mimeType: string; sizeBytes: number; scanState: string; createdAt: string };
type Props = { siteProjectId: string; appointmentId: string; token: string; mode: "patient" | "doctor" };

const ERRORS: Record<string, string> = {
  MEDICAL_DOCUMENT_TYPE_NOT_ALLOWED: "فقط فایل‌های PDF، JPEG، PNG و WebP پذیرفته می‌شود.",
  MEDICAL_DOCUMENT_CONTENT_MISMATCH: "محتوای فایل با نوع آن هم‌خوانی ندارد.",
  MEDICAL_DOCUMENT_ACTIVE_CONTENT: "فایل‌های PDF دارای اسکریپت یا پیوست پذیرفته نمی‌شود.",
  MEDICAL_DOCUMENT_TOO_LARGE: "حجم فایل بیش از ۱۰ مگابایت است.",
  MEDICAL_DOCUMENT_EMPTY: "فایل خالی است.",
  MEDICAL_DOCUMENT_TITLE_REQUIRED: "عنوان مدرک را بنویسید.",
  MEDICAL_DOCUMENT_LIMIT_REACHED: "سقف مدارک این نوبت تکمیل شده است.",
  MEDICAL_DOCUMENT_REJECTED: "فایل در بررسی امنیتی رد شد.",
  MEDICAL_DOCUMENT_SCAN_UNAVAILABLE: "بررسی امنیتی در دسترس نیست؛ بعداً تلاش کنید.",
  MEDICAL_DOCUMENTS_NOT_PRODUCTION_READY: "بارگذاری مدارک در این محیط فعال نیست.",
};

// Private documents of one appointment. Files are fetched with the session token
// (never a public link); patients can add and remove, doctors only read.
export default function AppointmentDocuments({ siteProjectId, appointmentId, token, mode }: Props) {
  const root = `/api/auth/site/${encodeURIComponent(siteProjectId)}/${mode}`;
  const headers = useCallback((): Record<string, string> => ({ "X-Loadder-App-Token": token }), [token]);
  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const response = await apiFetch(`${root}/appointments/${encodeURIComponent(appointmentId)}/documents`, { headers: headers() });
    const body = await response.json().catch(() => ({}));
    setDocs(response.ok && Array.isArray(body.documents) ? body.documents : []);
  }, [root, appointmentId, headers]);
  useEffect(() => { if (open && docs === null) void load(); }, [open, docs, load]);

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file || !title.trim()) return;
    setBusy(true); setMessage("");
    try {
      const response = await apiFetch(`${root}/appointments/${encodeURIComponent(appointmentId)}/documents`, { method: "POST", headers: { ...headers(), "Content-Type": file.type || "application/octet-stream", "X-Document-Title": encodeURIComponent(title.trim()), "X-Document-Filename": encodeURIComponent(file.name) }, body: file });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) setMessage(ERRORS[body.code] || "بارگذاری انجام نشد.");
      else { setTitle(""); setFile(null); await load(); }
    } catch { setMessage("ارتباط با سرور برقرار نشد."); } finally { setBusy(false); }
  }

  async function download(doc: Doc) {
    setMessage("");
    const response = await apiFetch(`${root}/documents/${encodeURIComponent(doc.id)}/file`, { headers: headers() });
    if (!response.ok) { setMessage("دریافت فایل ممکن نشد."); return; }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url; link.download = doc.fileName || doc.title; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function remove(doc: Doc) {
    const response = await apiFetch(`${root}/documents/${encodeURIComponent(doc.id)}`, { method: "DELETE", headers: headers() });
    setMessage(response.ok ? "" : "حذف انجام نشد."); await load();
  }

  return <div data-documents={mode} className="mt-3">
    <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="min-h-11 rounded-xl border border-current/30 px-4 text-xs font-bold">{open ? "بستن مدارک" : "مدارک"}</button>
    {open && <div className="mt-3 space-y-3 rounded-2xl bg-black/5 p-3 text-[#2b2a27]">
      {docs === null && <p className="text-xs opacity-60">در حال دریافت…</p>}
      {docs?.length === 0 && <p data-documents-empty className="text-xs">مدرکی برای این نوبت ثبت نشده است.</p>}
      <ul className="space-y-2">{docs?.map((doc) => <li key={doc.id} data-document className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-3 text-xs">
        <span className="min-w-0 break-words"><b>{doc.title}</b>{doc.scanState !== "clean" && <em className="mr-2 not-italic opacity-60"> (بررسی امنیتی انجام نشده — محیط آزمایشی)</em>}</span>
        <span className="flex gap-2"><button type="button" onClick={() => download(doc)} className="min-h-11 rounded-lg border border-[#2b2a27]/20 px-3 font-bold">دانلود</button>{mode === "patient" && <button type="button" onClick={() => remove(doc)} className="min-h-11 rounded-lg border border-rose-300 px-3 font-bold text-rose-700">حذف</button>}</span>
      </li>)}</ul>
      {mode === "patient" && <form onSubmit={upload} className="grid gap-2">
        <input aria-label="عنوان مدرک" value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder="عنوان مدرک (مثلاً نتیجه آزمایش)" className="min-h-11 rounded-lg border border-[#2b2a27]/20 bg-white px-3 text-sm" />
        <input aria-label="فایل مدرک" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] || null)} className="min-h-11 rounded-lg border border-[#2b2a27]/20 bg-white px-3 py-2 text-xs" />
        <button disabled={busy || !file || !title.trim()} className="min-h-11 rounded-lg bg-[#5f7560] px-4 text-xs font-black text-white disabled:opacity-50">بارگذاری خصوصی</button>
        <p className="text-[11px] opacity-60">PDF، JPEG، PNG یا WebP تا ۱۰ مگابایت. فقط شما و پزشک همین نوبت می‌توانند فایل را ببینند.</p>
      </form>}
      {message && <p role="alert" className="rounded-lg bg-rose-50 p-2 text-xs text-rose-800">{message}</p>}
    </div>}
  </div>;
}
