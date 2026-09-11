import { Link } from "react-router-dom";
import { ArrowRight } from "@phosphor-icons/react";
import HomeChrome from "../components/home/HomeChrome";
import MissionControlDashboard from "../components/mission-control/MissionControlDashboard";
import { useAuth } from "../lib/auth";
import { NAV } from "../lib/homeCopy";

/**
 * Expert depth behind Home's single attention item: the full attention surface,
 * unchanged. Home stays one decision; everything else lives one click in.
 */
export default function AttentionPage() {
  const { user } = useAuth();
  return (
    <HomeChrome>
      <Link to="/dashboard" className="mb-7 inline-flex min-h-11 items-center gap-2 text-[13.5px] text-white/35 transition hover:text-white/65">
        <ArrowRight size={15} />
        {NAV.home}
      </Link>
      <MissionControlDashboard userName={user?.name} />
    </HomeChrome>
  );
}
