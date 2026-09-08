const ACTIVE_STAGES = ["new", "hot", "qualified", "negotiating"];
const TERMINAL_STAGES = new Set(["converted", "lost"]);

function asTimestamp(value) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function percent(part, total) {
  return total > 0 ? round((part / total) * 100, 1) : 0;
}

function stageDurations(history, nowMs) {
  const sorted = [...history].sort((a, b) => {
    const left = asTimestamp(a.occurredAt) ?? 0;
    const right = asTimestamp(b.occurredAt) ?? 0;
    return left - right || (a.version || 0) - (b.version || 0);
  });
  const durations = [];
  for (let index = 0; index < sorted.length; index += 1) {
    const entry = sorted[index];
    const startedAt = asTimestamp(entry.occurredAt);
    if (startedAt == null) continue;
    const nextStartedAt = index + 1 < sorted.length ? asTimestamp(sorted[index + 1].occurredAt) : nowMs;
    if (nextStartedAt == null || nextStartedAt < startedAt) continue;
    durations.push({
      stage: entry.toStage,
      durationMs: nextStartedAt - startedAt,
    });
  }
  return durations;
}

export function createCrmPipelineAnalyticsService({ getDeals, getDealStageHistory, now = () => Date.now() }) {
  if (!getDeals || !getDealStageHistory) {
    throw new Error("CRM pipeline analytics requires deal and history repository functions.");
  }

  function snapshot() {
    const nowMs = now();
    const deals = getDeals();
    const histories = new Map(deals.map((deal) => [deal.id, getDealStageHistory(deal.id)]));

    const wonCount = deals.filter((deal) => deal.stage === "converted").length;
    const lostCount = deals.filter((deal) => deal.stage === "lost").length;
    const closedCount = wonCount + lostCount;
    const openDeals = deals.filter((deal) => ACTIVE_STAGES.includes(deal.stage));

    const transitionCounts = new Map();
    const stageEntryCounts = new Map();
    const durationBuckets = new Map();

    for (const history of histories.values()) {
      for (const entry of history) {
        stageEntryCounts.set(entry.toStage, (stageEntryCounts.get(entry.toStage) || 0) + 1);
        if (entry.fromStage) {
          const key = `${entry.fromStage}->${entry.toStage}`;
          transitionCounts.set(key, (transitionCounts.get(key) || 0) + 1);
        }
      }
      for (const duration of stageDurations(history, nowMs)) {
        if (TERMINAL_STAGES.has(duration.stage)) continue;
        const bucket = durationBuckets.get(duration.stage) || [];
        bucket.push(duration.durationMs);
        durationBuckets.set(duration.stage, bucket);
      }
    }

    const stageMetrics = ["new", "hot", "qualified", "negotiating", "converted", "lost"].map((stage) => {
      const currentCount = deals.filter((deal) => deal.stage === stage).length;
      const durations = durationBuckets.get(stage) || [];
      const avgMs = durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : 0;
      return {
        stage,
        currentCount,
        enteredCount: stageEntryCounts.get(stage) || 0,
        averageTimeDays: round(avgMs / 86_400_000, 1),
      };
    });

    const conversions = [...transitionCounts.entries()]
      .map(([key, count]) => {
        const [fromStage, toStage] = key.split("->");
        const fromEntries = stageEntryCounts.get(fromStage) || 0;
        return {
          fromStage,
          toStage,
          count,
          conversionRate: percent(count, fromEntries),
        };
      })
      .sort((a, b) => b.count - a.count);

    const lostReasonsMap = new Map();
    for (const deal of deals.filter((item) => item.stage === "lost")) {
      const reason = String(deal.lostReason || "ثبت نشده").trim() || "ثبت نشده";
      lostReasonsMap.set(reason, (lostReasonsMap.get(reason) || 0) + 1);
    }
    const lostReasons = [...lostReasonsMap.entries()]
      .map(([reason, count]) => ({ reason, count, share: percent(count, lostCount) }))
      .sort((a, b) => b.count - a.count);

    const stuckDeals = openDeals
      .map((deal) => ({
        id: deal.id,
        title: deal.title,
        stage: deal.stage,
        owner: deal.owner,
        idleDays: Math.max(0, Math.floor((nowMs - (asTimestamp(deal.updatedAt) ?? nowMs)) / 86_400_000)),
        amount: Number(deal.amount) || 0,
      }))
      .filter((deal) => deal.idleDays >= 3)
      .sort((a, b) => b.idleDays - a.idleDays);

    return {
      generatedAt: new Date(nowMs).toISOString(),
      summary: {
        totalDeals: deals.length,
        openDeals: openDeals.length,
        wonCount,
        lostCount,
        closedCount,
        winRate: percent(wonCount, closedCount),
        lossRate: percent(lostCount, closedCount),
        stuckCount: stuckDeals.length,
        pipelineValue: openDeals.reduce((sum, deal) => sum + (Number(deal.amount) || 0), 0),
      },
      stageMetrics,
      conversions,
      lostReasons,
      stuckDeals,
    };
  }

  return { snapshot };
}
