import { useCallback, useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";

type Project = { id: string; name?: string; siteType?: string; status?: string };
type Enrollment = { id: string; authProjectId: string; appUserId: string; status: "active" | "revoked"; student: { email: string; displayName: string | null }; authProjectName: string };
type Candidate = { appUserId: string; authProjectId: string; email: string; displayName: string | null; authProjectName: string };
type Resource = { id: string; title: string; assetType: "document" | "audio" | "video"; mimeType: string; sizeBytes: number };
type Booking = { services: { id: string; name: string; duration_minutes: number }[]; providers: { id: string; name: string }[]; associations: { providerId: string; serviceId: string }[]; appointments: unknown[] };
type Section<T> = { state: "loading" | "ready" | "error" | "denied"; data: T; message?: string };

const typeLabel = { document: "جزوه و سند", audio: "فایل صوتی", video: "ویدئو" } as const;
const assetTypeFor = (mime: string) => mime.startsWith("audio/") ? "audio" : mime.startsWith("video/") ? "video" : "document";
const b64url = (value: string) => btoa(unescape(encodeURIComponent(value))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function load<T>(path: string, pick: (body: any) => T, fallback: T): Promise<Section<T>> {
  try {
    const response = await apiFetch(path);
    const body = await response.json().catch(() => ({}));
    if (response.status === 403) return { state: "denied", data: fallback, message: body.message };
    if (!response.ok) return { state: "error", data: fallback, message: body.message || "بارگذاری ناموفق بود." };
    return { state: "ready", data: pick(body) };
  } catch { return { state: "error", data: fallback, message: "ارتباط با سرور برقرار نشد." }; }
}

const Panel = ({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) =>
  <section className="min-w-0 rounded-3xl border border-[#d9bc83]/40 bg-white p-5 sm:p-6"><h2 className="text-lg font-black">{title}</h2>{hint && <p className="mt-1 text-xs leading-6 text-stone-500">{hint}</p>}<div className="mt-4">{children}</div></section>;
const Empty = ({ children }: { children: ReactNode }) => <p className="rounded-2xl border border-dashed border-[#d9bc83]/60 p-4 text-sm leading-7 text-stone-600">{children}</p>;
const Problem = ({ children }: { children: ReactNode }) => <p role="alert" className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800">{children}</p>;
const Stat = ({ label, value }: { label: string; value: number | string }) => <div className="rounded-2xl bg-[#f5f0e5] p-4"><p className="text-xs text-stone-500">{label}</p><p className="mt-1 text-2xl font-black">{typeof value === "number" ? value.toLocaleString("fa-IR") : value}</p></div>;

export default function EducationControlCenterPage() {
  const { siteProjectId = "" } = useParams();
  const id = encodeURIComponent(siteProjectId);
  const [project, setProject] = useState<Section<Project | null>>({ state: "loading", data: null });
  const [enrollments, setEnrollments] = useState<Section<Enrollment[]>>({ state: "loading", data: [] });
  const [candidates, setCandidates] = useState<Section<Candidate[]>>({ state: "loading", data: [] });
  const [resources, setResources] = useState<Section<Resource[]>>({ state: "loading", data: [] });
  const [booking, setBooking] = useState<Section<Booking | null>>({ state: "loading", data: null });
  const [pick, setPick] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const refreshStudents = useCallback(async () => {
    const [e, c] = await Promise.all([
      load(`/api/site-projects/${id}/learning-enrollments`, (b) => b.enrollments as Enrollment[], []),
      load(`/api/site-projects/${id}/learning-enrollments/candidates`, (b) => b.candidates as Candidate[], []),
    ]);
    setEnrollments(e); setCandidates(c);
  }, [id]);
  const refreshResources = useCallback(async () => setResources(await load(`/api/site-projects/${id}/learning-resources`, (b) => b.resources as Resource[], [])), [id]);

  useEffect(() => {
    void load(`/api/site-projects/${id}`, (b) => b.project as Project, null).then(setProject);
    void refreshStudents(); void refreshResources();
    void load("/api/booking", (b) => b as Booking, null).then(setBooking);
  }, [id, refreshStudents, refreshResources]);

  async function enroll(event: FormEvent) {
    event.preventDefault();
    const chosen = candidates.data.find((entry) => `${entry.authProjectId}:${entry.appUserId}` === pick);
    if (!chosen) return;
    setBusy("enroll"); setNotice(null);
    const response = await apiFetch(`/api/site-projects/${id}/learning-enrollments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ authProjectId: chosen.authProjectId, appUserId: chosen.appUserId }) });
    const body = await response.json().catch(() => ({}));
    setNotice(response.ok ? { tone: "ok", text: "ثبت‌نام دانشجو فعال شد." } : { tone: "error", text: body.message || "ثبت‌نام انجام نشد." });
    setPick(""); await refreshStudents(); setBusy("");
  }

  async function revoke(enrollment: Enrollment) {
    setBusy(enrollment.id); setNotice(null);
    const response = await apiFetch(`/api/site-projects/${id}/learning-enrollments/${encodeURIComponent(enrollment.id)}`, { method: "DELETE" });
    setNotice(response.ok ? { tone: "ok", text: "دسترسی دانشجو لغو شد." } : { tone: "error", text: "لغو دسترسی انجام نشد." });
    await refreshStudents(); setBusy("");
  }

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file || !title.trim()) return;
    setBusy("upload"); setNotice(null);
    const extension = (file.name.split(".").pop() || "bin").replace(/[^a-z0-9]/gi, "").slice(0, 8) || "bin";
    const response = await apiFetch(`/api/site-projects/${id}/media/upload`, {
      method: "POST",
      headers: { "Content-Type": file.type, "x-loadder-asset-type": assetTypeFor(file.type), "x-loadder-file-name": `resource-${Date.now()}.${extension}`, "x-loadder-media-metadata": b64url(JSON.stringify({ visibility: "workspace", title: title.trim(), name: file.name })) },
      body: file,
    });
    const body = await response.json().catch(() => ({}));
    setNotice(response.ok ? { tone: "ok", text: "منبع آموزشی خصوصی ذخیره شد." } : { tone: "error", text: body.message || "بارگذاری فایل انجام نشد (قالب یا حجم مجاز نیست)." });
    if (response.ok) { setTitle(""); setFile(null); }
    await refreshResources(); setBusy("");
  }

  const active = enrollments.data.filter((entry) => entry.status === "active");
  const site = project.data;
  const notEducation = project.state === "ready" && site && String(site.siteType).toUpperCase() !== "EDUCATION";

  return <main dir="rtl" className="min-h-screen bg-[#f5f0e5] px-4 py-6 text-[#292721] sm:p-10" data-education-control-center>
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="rounded-3xl bg-[#292721] p-6 text-[#f5f0e5] sm:p-8">
        <Link to="/dashboard/websites" className="text-xs font-bold text-[#d9bc83]">سایت‌های من</Link>
        <p className="mt-5 text-xs text-[#d9bc83]">مرکز مدیریت آموزش</p>
        <h1 className="mt-1 break-words text-2xl font-black sm:text-3xl">{site?.name || "آموزشگاه"}</h1>
        <div className="mt-5 flex flex-wrap gap-2 text-sm font-bold">
          <Link to={`/dashboard/websites/corporate?project=${id}`} className="inline-flex min-h-11 items-center rounded-xl border border-[#d9bc83]/50 px-4">ویرایشگر سایت</Link>
          <Link to="/dashboard/booking" className="inline-flex min-h-11 items-center rounded-xl border border-[#d9bc83]/50 px-4">استودیوی نوبت‌دهی</Link>
        </div>
      </header>

      {project.state === "error" && <Problem>{project.message}</Problem>}
      {notEducation && <Problem>این سایت از نوع آموزشی نیست؛ مرکز مدیریت آموزش فقط برای سایت‌های آموزشی در دسترس است.</Problem>}
      {notice && <p role={notice.tone === "error" ? "alert" : "status"} className={`rounded-2xl border p-4 text-sm ${notice.tone === "error" ? "border-rose-300 bg-rose-50 text-rose-800" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}>{notice.text}</p>}

      {!notEducation && <>
        <Panel title="نمای کلی" hint="فقط شمارش رکوردهای واقعی ثبت‌شده؛ هیچ شاخص دیگری نمایش داده نمی‌شود.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="دانشجوی فعال" value={enrollments.state === "ready" ? active.length : "—"} />
            <Stat label="منبع آموزشی" value={resources.state === "ready" ? resources.data.length : "—"} />
            <Stat label="خدمات نوبت‌دهی" value={booking.state === "ready" && booking.data ? booking.data.services.length : "—"} />
            <Stat label="مدرس/ارائه‌دهنده" value={booking.state === "ready" && booking.data ? booking.data.providers.length : "—"} />
          </div>
        </Panel>

        <Panel title="دانشجویان و ثبت‌نام‌ها" hint="فقط کاربران موجود با نقش «مشتری» که در یک برنامهٔ این Workspace عضو هستند قابل ثبت‌نام‌اند.">
          {enrollments.state === "error" && <Problem>{enrollments.message}</Problem>}
          {enrollments.state === "denied" && <Empty>مدیریت ثبت‌نام فقط برای مالک یا مدیر Workspace در دسترس است.</Empty>}
          {enrollments.state === "ready" && <>
            <form onSubmit={enroll} className="flex flex-col gap-2 sm:flex-row">
              <select aria-label="کاربر مشتری" value={pick} onChange={(e) => setPick(e.target.value)} className="min-h-11 min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-3 text-sm text-[#292721]">
                <option value="">انتخاب مشتری برای ثبت‌نام…</option>
                {candidates.data.map((entry) => <option key={`${entry.authProjectId}:${entry.appUserId}`} value={`${entry.authProjectId}:${entry.appUserId}`}>{entry.displayName ? `${entry.displayName} · ` : ""}{entry.email} ({entry.authProjectName})</option>)}
              </select>
              <button disabled={!pick || busy === "enroll"} className="min-h-11 rounded-xl bg-[#292721] px-5 text-sm font-bold text-white disabled:opacity-40">ثبت‌نام دانشجو</button>
            </form>
            {!candidates.data.length && <p className="mt-2 text-xs leading-6 text-stone-500">مشتریِ ثبت‌نام‌نشده‌ای وجود ندارد. ابتدا برای مشتری در برنامهٔ مرتبط دعوت‌نامه بسازید.</p>}
            <div className="mt-4 space-y-2">
              {!enrollments.data.length && <Empty>هنوز دانشجویی ثبت‌نام نشده است.</Empty>}
              {enrollments.data.map((entry) => <article key={entry.id} data-enrollment-status={entry.status} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#f5f0e5] p-4">
                <div className="min-w-0"><p className="break-all text-sm font-black">{entry.student.displayName || entry.student.email}</p><p className="break-all text-xs text-stone-500">{entry.student.email} · {entry.authProjectName} · {entry.status === "active" ? "فعال" : "لغوشده"}</p>
                  {entry.status === "active" && <p className="mt-1 break-all text-[11px] text-stone-500" dir="ltr">{`${window.location.origin}/learn/${entry.authProjectId}/${siteProjectId}`}</p>}</div>
                {entry.status === "active" && <button disabled={busy === entry.id} onClick={() => revoke(entry)} className="min-h-11 rounded-xl border border-rose-300 px-4 text-sm font-bold text-rose-700 disabled:opacity-40">لغو دسترسی</button>}
              </article>)}
            </div>
          </>}
        </Panel>

        <Panel title="منابع آموزشی" hint="فایل‌ها خصوصی ذخیره می‌شوند و فقط دانشجویان ثبت‌نام‌شده می‌توانند آن‌ها را دریافت کنند.">
          {resources.state === "error" && <Problem>{resources.message}</Problem>}
          {resources.state === "denied" && <Empty>مدیریت منابع فقط برای مالک یا مدیر Workspace در دسترس است.</Empty>}
          {resources.state === "ready" && <>
            <form onSubmit={upload} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input aria-label="عنوان منبع" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="عنوان منبع" className="min-h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm text-[#292721] placeholder:text-stone-400" />
              <input aria-label="فایل منبع" type="file" accept="application/pdf,audio/mpeg,audio/ogg,audio/wav,video/mp4,video/webm" onChange={(e) => setFile(e.target.files?.[0] || null)} className="min-h-11 min-w-0 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm" />
              <button disabled={!file || !title.trim() || busy === "upload"} className="min-h-11 rounded-xl bg-[#292721] px-5 text-sm font-bold text-white disabled:opacity-40">بارگذاری خصوصی</button>
            </form>
            <p className="mt-2 text-xs text-stone-500">قالب‌های مجاز: PDF، MP3/OGG/WAV، MP4/WebM تا ۲۵ مگابایت.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {!resources.data.length && <div className="sm:col-span-2"><Empty>هنوز منبع خصوصی‌ای بارگذاری نشده است.</Empty></div>}
              {resources.data.map((resource) => <article key={resource.id} className="min-w-0 rounded-2xl bg-[#f5f0e5] p-4"><span className="text-xs font-bold text-[#8d6b35]">{typeLabel[resource.assetType]}</span><p className="mt-1 break-words text-sm font-black">{resource.title}</p><p className="text-xs text-stone-500">{Math.ceil(resource.sizeBytes / 1024).toLocaleString("fa-IR")} کیلوبایت</p></article>)}
            </div>
          </>}
        </Panel>

        <Panel title="خدمات و مدرسان نوبت‌دهی" hint="داده از همان استودیوی نوبت‌دهی خوانده می‌شود.">
          {booking.state === "denied" && <Empty>قابلیت نوبت‌دهی برای این Workspace فعال نیست.</Empty>}
          {booking.state === "error" && <Problem>{booking.message}</Problem>}
          {booking.state === "ready" && booking.data && (!booking.data.services.length
            ? <Empty>هنوز خدمتی در استودیوی نوبت‌دهی تعریف نشده است.</Empty>
            : <div className="grid gap-2 sm:grid-cols-2">{booking.data.services.map((service) => {
              const names = booking.data!.associations.filter((link) => link.serviceId === service.id).map((link) => booking.data!.providers.find((provider) => provider.id === link.providerId)?.name).filter(Boolean);
              return <article key={service.id} className="min-w-0 rounded-2xl bg-[#f5f0e5] p-4"><p className="break-words text-sm font-black">{service.name}</p><p className="text-xs text-stone-500">{service.duration_minutes.toLocaleString("fa-IR")} دقیقه</p><p className="mt-1 text-xs">{names.length ? `مدرس: ${names.join("، ")}` : "مدرسی به این خدمت متصل نیست."}</p></article>;
            })}</div>)}
        </Panel>
      </>}
    </div>
  </main>;
}
