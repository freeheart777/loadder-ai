import { useCallback, useState } from "react";
import type { FormEvent } from "react";
import { apiFetch } from "../../lib/api";
import { AppointmentsPanel, ProvidersPanel, SchedulesPanel, ServicesPanel, useBookingAdmin } from "./BookingPanels";
import type { Act } from "./BookingPanels";
import type { ModuleKey, Vocabulary } from "./modules";
import { Empty, Panel, Problem, Row, Stat, button, fa, ghost, input, useQuery } from "./ui";
import type { Json, Notice, Query } from "./ui";

// Medical-only modules. Everything that is Booking (doctors, services, schedules, appointments)
// comes from the shared panels; this file adds only what Booking does not know: patients,
// doctor sign-in, private documents and the readiness settings.
type Props = { siteProjectId: string; module: ModuleKey; vocab: Vocabulary; setNotice: (notice: Notice) => void };

export default function MedicalModules({ siteProjectId, module, vocab, setNotice }: Props) {
  const id = encodeURIComponent(siteProjectId);
  const summary = useQuery<{ summary: Json }>(`/api/site-projects/${id}/medical/summary`);
  const doctors = useQuery<{ doctors: Json[] }>(`/api/site-projects/${id}/doctor-identities`);
  const patients = useQuery<{ patients: Json[] }>(module === "people" ? `/api/site-projects/${id}/medical/patients` : null);
  const files = useQuery<{ documents: Json[] }>(module === "files" ? `/api/site-projects/${id}/medical-documents` : null);
  const settings = useQuery<{ settings: Json }>(module === "settings" ? `/api/site-projects/${id}/medical/settings` : null);
  const refreshAll = useCallback(async () => { await Promise.all([summary.reload(), doctors.reload(), patients.reload(), files.reload(), settings.reload()]); }, [summary, doctors, patients, files, settings]);
  const { booking, act } = useBookingAdmin(siteProjectId, setNotice, refreshAll);

  const providers = booking.data?.providers || [], services = booking.data?.services || [], associations = booking.data?.associations || [];
  const identityOf = (providerId: string) => doctors.data?.doctors.find((entry) => entry.providerId === providerId);

  if (module === "dashboard") return <Panel title="نمای کلی" hint="فقط شمارش رکوردهای واقعی همین مرکز؛ هیچ شاخص برآوردی نمایش داده نمی‌شود.">
    <Problem>{summary.error}</Problem>
    {summary.data && <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label="بیماران" value={summary.data.summary.patients} /><Stat label="پزشکان" value={summary.data.summary.providers} /><Stat label="پزشکان دارای ورود" value={summary.data.summary.doctorIdentities} /><Stat label="خدمات" value={summary.data.summary.services} />
      <Stat label="نوبت‌های پیش‌رو" value={summary.data.summary.upcoming} /><Stat label="در انتظار تأیید" value={summary.data.summary.appointments.PENDING} /><Stat label="تأییدشده" value={summary.data.summary.appointments.CONFIRMED} /><Stat label="مدارک فعال" value={summary.data.summary.documents} />
    </div>}
    {summary.data && summary.data.summary.appointments.total === 0 && <div className="mt-4"><Empty>هنوز نوبتی ثبت نشده است. پس از تعریف خدمت، پزشک و زمان در دسترس، نوبت‌ها اینجا شمارش می‌شوند.</Empty></div>}
  </Panel>;

  if (module === "people") return <Panel title="بیماران" hint="کاربران واقعی که با شمارهٔ موبایل وارد این مرکز شده‌اند. شماره‌ها پنهان نمایش داده می‌شود.">
    <Problem>{patients.error}</Problem>
    {patients.data && !patients.data.patients.length && <Empty>هنوز بیماری وارد نشده است.</Empty>}
    <div className="space-y-2">{patients.data?.patients.map((patient) => <Row key={patient.id}><span data-patient className="min-w-0 break-words"><b>{patient.displayName || "بدون نام"}</b> <bdi dir="ltr" className="text-xs text-stone-500">{patient.mobile}</bdi></span><span className="text-xs text-stone-500">{fa(patient.appointments)} نوبت · {patient.status === "active" ? "فعال" : "غیرفعال"}</span></Row>)}</div>
  </Panel>;

  if (module === "providers") return <ProvidersPanel vocab={vocab} providers={providers} act={act} error={booking.error || doctors.error}
    hint="پزشکان همان ارائه‌دهندگان نوبت‌دهی همین مرکزند؛ ورود پزشک با موبایل فقط توسط مالک یا مدیر تعریف می‌شود."
    rowNote={(provider) => { const identity = identityOf(provider.id); const active = identity?.status === "active"; return <span className="mr-2 text-xs text-stone-500">{active ? `ورود فعال · ${identity!.mobile}` : identity ? "ورود لغوشده" : "بدون ورود"}</span>; }}
    rowExtra={(provider) => <DoctorLogin provider={provider} identity={identityOf(provider.id)} act={act} />} />;

  if (module === "services") return <ServicesPanel vocab={vocab} services={services} providers={providers} associations={associations} act={act} error={booking.error}
    hint="مدت، شیوه‌های مراجعه و هزینه همان داده‌ای است که در سایت و رزرو نمایش داده می‌شود. شیوهٔ «متنی» هنوز قابل رزرو عمومی نیست." />;
  if (module === "schedules") return <SchedulesPanel vocab={vocab} providers={providers} availability={booking.data?.availability || []} act={act}
    hint="زمان‌های در دسترس هر پزشک؛ پزشک هم می‌تواند برنامهٔ خودش را در پرتال پزشک ویرایش کند." />;
  if (module === "appointments") return <AppointmentsPanel vocab={vocab} appointments={booking.data?.appointments || []} services={services} providers={providers} act={act} error={booking.error}
    hint="همان رکوردهای نوبت‌دهی؛ تغییر وضعیت فقط مطابق قرارداد مجاز و ثبت‌شده در سابقهٔ حساس است." />;

  if (module === "files") return <FilesPanel files={files} siteId={id} setNotice={setNotice} />;

  if (module === "settings") return <Panel title="تنظیمات و آمادگی" hint="وضعیت واقعی پیکربندی؛ هر مانع تولید صریح نمایش داده می‌شود.">
    <Problem>{settings.error}</Problem>
    {settings.data && <div className="space-y-2" data-settings>
      <Row><span>ورود بیماران با موبایل: <b>{settings.data.settings.patientIdentity.enabled ? "فعال" : "غیرفعال"}</b></span>{!settings.data.settings.patientIdentity.enabled && <button type="button" onClick={() => act(`/api/site-projects/${id}/patient-identity`, "POST", undefined, "ورود بیماران فعال شد.")} className={button}>فعال‌سازی</button>}</Row>
      <Row><span>ارسال پیامک کد ورود: <b data-otp-state>{settings.data.settings.otpDelivery.configured ? (settings.data.settings.otpDelivery.simulator ? "شبیه‌ساز (فقط آزمایشی)" : "پیکربندی‌شده") : "پیکربندی نشده"}</b></span></Row>
      {settings.data.settings.environment === "production" && !settings.data.settings.otpDelivery.configured && <Problem>در تولید، بدون ارائه‌دهندهٔ پیامک واقعی ورود بیماران کار نمی‌کند.</Problem>}
      <Row><span>مدارک خصوصی: <b data-documents-state>{settings.data.settings.documents.productionReady ? "آمادهٔ تولید" : "آمادهٔ تولید نیست"}</b></span><span className="text-xs text-stone-500">اسکنر: {settings.data.settings.documents.scannerConfigured ? "پیکربندی‌شده" : "پیکربندی نشده"} · ذخیره‌سازی: {settings.data.settings.documents.storage}</span></Row>
    </div>}
  </Panel>;

  return null;
}

function DoctorLogin({ provider, identity, act }: { provider: Json; identity: Json | undefined; act: Act }) {
  const [mobile, setMobile] = useState("");
  const base = `/api/site-projects/${encodeURIComponent(provider.site_project_id)}/doctor-identities`;
  if (identity?.status === "active") return <button type="button" onClick={() => act(`${base}/${encodeURIComponent(provider.id)}`, "DELETE", undefined, "دسترسی پزشک لغو شد.")} className={`${ghost} text-rose-700`}>لغو دسترسی</button>;
  if (identity) return null;
  const submit = async (event: FormEvent) => { event.preventDefault(); await act(base, "POST", { providerId: provider.id, mobile, displayName: provider.name }, "ورود پزشک تعریف شد."); };
  return <form className="flex gap-2" onSubmit={submit}><input aria-label={`موبایل ${provider.name}`} dir="ltr" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="09123456789" className={`${input} w-40`} /><button className={button}>تعریف ورود</button></form>;
}

function FilesPanel({ files, siteId, setNotice }: { files: Query<{ documents: Json[] }>; siteId: string; setNotice: (n: Notice) => void }) {
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
