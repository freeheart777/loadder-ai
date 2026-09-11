import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import HomeChrome from "../components/home/HomeChrome";
import { AttentionZone, InProgressZone, LearnedZone, ToolsZone, Zone } from "../components/home/zones";
import { ATTENTION_COPY, ZONE_LABELS } from "../lib/homeCopy";
import {
  primaryItem, readAttention, readFindings, readPreparedWork,
  type Finding, type PreparedWork, type ZoneState,
} from "../lib/homeData";
import type { MissionControl } from "../lib/missionControlCopy";

/**
 * HOME.
 *
 * Four zones, in one order: what needs you, what is under way, what we have
 * learned, your tools. Every zone reads an endpoint that already existed, and
 * each reads independently — one failing contract dims one zone and leaves the
 * rest of Home usable.
 *
 * Home shows one attention item, the first the canonical contract emitted. It
 * does not re-rank, and it does not summarise the rest: the full list is one
 * click away behind «بقیهٔ موارد», which is also where «چرا؟» leads for depth.
 */
export default function DashboardPage() {
  const [attention, setAttention] = useState<ZoneState<MissionControl>>({ status: "loading", data: null });
  const [prepared, setPrepared] = useState<ZoneState<PreparedWork[]>>({ status: "loading", data: null });
  const [findings, setFindings] = useState<ZoneState<Finding[]>>({ status: "loading", data: null });

  useEffect(() => {
    let live = true;
    void readAttention()
      .then((data) => { if (live) setAttention({ status: "ok", data }); })
      .catch(() => { if (live) setAttention({ status: "failed", data: null }); });
    void readPreparedWork()
      .then((data) => { if (live) setPrepared({ status: "ok", data }); })
      .catch(() => { if (live) setPrepared({ status: "failed", data: null }); });
    void readFindings()
      .then((data) => { if (live) setFindings({ status: "ok", data }); })
      .catch(() => { if (live) setFindings({ status: "failed", data: null }); });
    return () => { live = false; };
  }, []);

  const item = primaryItem(attention.data);
  const others = Math.max(0, (attention.data?.items.length ?? 0) - 1);

  return (
    <HomeChrome>
      <Zone label={ZONE_LABELS.attention}>
        <AttentionZone state={attention} item={item} />
        {others > 0 && (
          <Link data-attention-more to="/dashboard/attention" className="mt-5 inline-flex min-h-11 items-center text-[13.5px] text-white/40 underline decoration-white/15 underline-offset-[6px] transition hover:text-white/70">
            {ATTENTION_COPY.more}
          </Link>
        )}
      </Zone>

      <Zone label={ZONE_LABELS.inProgress}>
        <InProgressZone state={prepared} />
      </Zone>

      <Zone label={ZONE_LABELS.learned}>
        <LearnedZone state={findings} />
      </Zone>

      <Zone id="tools" label={ZONE_LABELS.tools}>
        <ToolsZone />
      </Zone>
    </HomeChrome>
  );
}
