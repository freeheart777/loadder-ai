import { useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { AppointmentsPanel, ProvidersPanel, SchedulesPanel, ServicesPanel, useBookingAdmin } from "../components/control-center/BookingPanels";
import ControlCenterShell from "../components/control-center/ControlCenterShell";
import { WORKSPACE_BOOKING, workspaceBookingModules } from "../components/control-center/modules";
import type { ModuleKey } from "../components/control-center/modules";
import { NoticeBar } from "../components/control-center/ui";
import type { Notice } from "../components/control-center/ui";

/**
 * Booking Studio: the workspace's own Booking records (services, providers, availability and
 * appointments that belong to no single site). It is a module of the same Control Center shell
 * and the same Booking panels the Medical and Education centres use, over the canonical Booking
 * APIs. Per-site management lives in each site's Control Center.
 */
export default function BookingStudioPage() {
  const { module = "appointments" } = useParams();
  const [notice, setNotice] = useState<Notice>(null);
  const { booking, act } = useBookingAdmin(undefined, setNotice);
  const modules = workspaceBookingModules();
  const active = modules.find((m) => m.key === module)?.key;
  if (!active) return <Navigate to="/dashboard/booking" replace />;
  const vocab = WORKSPACE_BOOKING, data = booking.data, providers = data?.providers || [], services = data?.services || [];

  const body = (key: ModuleKey) => {
    if (key === "providers") return <ProvidersPanel vocab={vocab} providers={providers} act={act} error={booking.error} hint="ارائه‌دهندگانی که زمان‌های قابل رزرو را ارائه می‌کنند." />;
    if (key === "services") return <ServicesPanel vocab={vocab} services={services} providers={providers} associations={data?.associations || []} act={act} error={booking.error} hint="خدمت‌های قابل رزرو، مدت و هزینهٔ آن‌ها." />;
    if (key === "schedules") return <SchedulesPanel vocab={vocab} providers={providers} availability={data?.availability || []} act={act} hint="بازه‌های هفتگی حضور هر ارائه‌دهنده." />;
    return <AppointmentsPanel vocab={vocab} appointments={data?.appointments || []} services={services} providers={providers} associations={data?.associations || []} manualCreate act={act} error={booking.error} hint="همهٔ نوبت‌های ثبت‌شده در این Workspace." />;
  };

  return <ControlCenterShell kind="GENERIC" title="استودیوی نوبت‌دهی" kicker={vocab.center} modules={modules} active={active} pathFor={(key) => `/dashboard/booking/${key}`} backTo={{ label: "داشبورد", to: "/dashboard" }}>
    <NoticeBar notice={notice} />
    {body(active)}
  </ControlCenterShell>;
}
