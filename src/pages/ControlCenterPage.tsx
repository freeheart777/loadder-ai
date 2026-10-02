import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import ControlCenterShell from "../components/control-center/ControlCenterShell";
import type { ShellLink } from "../components/control-center/ControlCenterShell";
import EducationModules from "../components/control-center/EducationModules";
import MedicalModules from "../components/control-center/MedicalModules";
import { controlCenterFor, controlCenterPath, publicSitePath, websiteStudioPath } from "../components/control-center/modules";
import type { ModuleKey } from "../components/control-center/modules";
import { NoticeBar, Panel, Problem, Row, ghost, useQuery } from "../components/control-center/ui";
import type { Notice } from "../components/control-center/ui";

type Project = { name?: string; siteType?: string; status?: string };
const STATUS_LABEL: Record<string, string> = { PUBLISHED: "منتشرشده", DRAFT: "پیش‌نویس" };

/**
 * The one Control Center route: /dashboard/websites/:siteProjectId/control/:module?
 * Navigation comes from the capability registry for the site's type; each module renders
 * canonical data (Booking, enrolments, documents). The Website Studio stays the BUILD
 * surface; this is the OPERATE surface for the same SiteProject.
 */
export default function ControlCenterPage() {
  const { siteProjectId = "", module = "dashboard" } = useParams();
  const [notice, setNotice] = useState<Notice>(null);
  const site = useQuery<{ project?: Project }>(`/api/site-projects/${encodeURIComponent(siteProjectId)}`);
  const project = site.data?.project;
  const definition = controlCenterFor(project?.siteType);
  const { kind, vocabulary: vocab } = definition;
  const active = definition.modules.find((m) => m.key === module)?.key;

  const websiteLinks: ShellLink[] = [
    { label: "ویرایش وب‌سایت", to: websiteStudioPath(siteProjectId, project?.siteType), testId: "edit-website" },
    { label: "مشاهدهٔ وب‌سایت", to: publicSitePath(siteProjectId, project?.siteType), newTab: true, testId: "view-website" },
  ];

  if (site.loading) return <div dir="rtl" data-control-center-loading className="min-h-screen bg-[#f7f3ea]" aria-busy="true" />;
  if (site.error || !project) return <div dir="rtl" className="min-h-screen bg-[#f7f3ea] p-6"><div className="mx-auto max-w-xl space-y-3"><Problem>{site.error || "سایت پیدا نشد."}</Problem><Link to="/dashboard/websites" className={`${ghost} inline-flex items-center`}>سایت‌های من</Link></div></div>;
  if (!active) return <Navigate to={controlCenterPath(siteProjectId)} replace />;

  const body = (key: ModuleKey) => {
    if (key === "content") return <ContentPanel project={project} editTo={websiteStudioPath(siteProjectId, project.siteType)} noun={kind === "MEDICAL" ? "بخش درمان" : kind === "EDUCATION" ? "بخش آموزش" : "مرکز کنترل"} />;
    if (kind === "MEDICAL") return <MedicalModules siteProjectId={siteProjectId} module={key} vocab={vocab} setNotice={setNotice} />;
    if (kind === "EDUCATION") return <EducationModules siteProjectId={siteProjectId} module={key} vocab={vocab} setNotice={setNotice} />;
    if (key === "commerce") return <CommerceLinks />;
    return <Overview project={project} siteProjectId={siteProjectId} />;
  };

  return <ControlCenterShell kind={kind} title={project.name || vocab.center} kicker={vocab.center} statusLabel={STATUS_LABEL[String(project.status)] || undefined}
    modules={definition.modules} active={active} pathFor={(key) => controlCenterPath(siteProjectId, key)} websiteLinks={websiteLinks}>
    <NoticeBar notice={notice} />
    {body(active)}
  </ControlCenterShell>;
}

function ContentPanel({ project, editTo, noun }: { project: Project; editTo: string; noun: string }) {
  return <Panel title="محتوا" hint={`صفحات سایت در ویرایشگر یکسان وب‌سایت‌ساز ویرایش و منتشر می‌شود؛ محتوای جداگانه‌ای برای ${noun} وجود ندارد.`}>
    <Row><span>وضعیت انتشار: <b data-site-status>{STATUS_LABEL[String(project.status)] || project.status || "—"}</b></span><Link to={editTo} className={`${ghost} inline-flex items-center`}>باز کردن ویرایشگر</Link></Row>
  </Panel>;
}

// Stores keep their existing, richer management screens; the shell links to them instead of re-embedding.
function CommerceLinks() {
  return <Panel title="محصولات و سفارش‌ها" hint="مدیریت فروشگاه همان صفحه‌های موجود است؛ مرکز کنترل فقط مسیر ورود را یکپارچه می‌کند.">
    <div className="grid gap-2 sm:grid-cols-3">{[["مدیریت محصولات و سفارش‌ها", "/dashboard/websites/commerce"], ["عملیات کاتالوگ", "/dashboard/websites/commerce/operations"], ["مالی", "/dashboard/websites/commerce/financials"]].map(([label, to]) => <Link key={to} to={to} data-commerce-link className={`${ghost} inline-flex items-center justify-center text-center`}>{label}</Link>)}</div>
  </Panel>;
}

function Overview({ project, siteProjectId }: { project: Project; siteProjectId: string }) {
  return <Panel title="نمای کلی" hint="برای این نوع سایت هنوز ماژول عملیاتی دیگری فعال نیست؛ فقط وضعیت واقعی سایت نمایش داده می‌شود.">
    <Row><span>وضعیت انتشار: <b data-site-status>{STATUS_LABEL[String(project.status)] || project.status || "—"}</b></span><Link to={websiteStudioPath(siteProjectId, project.siteType)} className={`${ghost} inline-flex items-center`}>باز کردن ویرایشگر</Link></Row>
  </Panel>;
}

/** Old per-vertical addresses (/medical, /education) land on the single Control Center route. */
export function LegacyControlCenterRedirect() {
  const { siteProjectId = "" } = useParams();
  return <Navigate to={controlCenterPath(siteProjectId)} replace />;
}
