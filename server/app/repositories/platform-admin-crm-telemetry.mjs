function tableExists(db, name) {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name));
}

function percent(numerator, denominator) {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;
}

function engagementSignal(row, nowMs = Date.now()) {
  if (row.status !== 'active') return { status: 'workspace_inactive', reason: 'workspace status is not active' };
  if (!row.dealCount) return { status: 'unknown', reason: 'no CRM deal evidence yet' };
  const open = Number(row.openDealCount || 0);
  const stuck = Number(row.stuckDealCount || 0);
  const last = Date.parse(row.lastCrmActivity || '');
  const inactiveDays = Number.isFinite(last) ? Math.floor((nowMs - last) / 86_400_000) : null;
  if (open > 0 && stuck / open >= 0.5) return { status: 'attention', reason: 'at least half of open deals are stuck', inactiveDays };
  if (open > 0 && inactiveDays !== null && inactiveDays >= 14) return { status: 'attention', reason: 'open pipeline has no CRM activity for 14+ days', inactiveDays };
  return { status: 'healthy', reason: 'no current CRM engagement warning', inactiveDays };
}

export function createPlatformAdminCrmTelemetry(db, { now = () => Date.now() } = {}) {
  return {
    crmTelemetry() {
      const hasDeals = tableExists(db, 'crm_deals');
      const hasOutbox = tableExists(db, 'crm_automation_outbox');
      const hasActions = tableExists(db, 'crm_automation_actions');

      if (!hasDeals) {
        return {
          status: 'unavailable',
          evidence: 'crm_deals table has not been initialized',
          totals: null,
          automation: hasOutbox || hasActions ? { status: 'partial' } : { status: 'unavailable' },
          workspaces: [],
        };
      }

      const totals = db.prepare(`
        SELECT
          COUNT(*) AS dealCount,
          SUM(CASE WHEN stage IN ('new','hot','qualified','negotiating') THEN 1 ELSE 0 END) AS openDealCount,
          SUM(CASE WHEN stage='converted' THEN 1 ELSE 0 END) AS wonCount,
          SUM(CASE WHEN stage='lost' THEN 1 ELSE 0 END) AS lostCount,
          SUM(CASE WHEN stage IN ('new','hot','qualified','negotiating') AND updated_at <= datetime('now','-3 days') THEN 1 ELSE 0 END) AS stuckCount,
          COALESCE(SUM(CASE WHEN stage IN ('new','hot','qualified','negotiating') THEN amount_minor ELSE 0 END),0) AS pipelineValue,
          COUNT(DISTINCT workspace_id) AS crmWorkspaceCount,
          MAX(updated_at) AS latestCrmActivity
        FROM crm_deals
      `).get();
      const closed = Number(totals.wonCount || 0) + Number(totals.lostCount || 0);

      let automation = { status: 'unavailable', pendingEvents: null, actionCount: null, pendingActionCount: null };
      if (hasOutbox || hasActions) {
        const pendingEvents = hasOutbox
          ? Number(db.prepare("SELECT COUNT(*) AS count FROM crm_automation_outbox WHERE status='pending'").get().count || 0)
          : null;
        const actionStats = hasActions
          ? db.prepare(`SELECT COUNT(*) AS actionCount, SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pendingActionCount FROM crm_automation_actions`).get()
          : null;
        automation = {
          status: hasOutbox && hasActions ? 'available' : 'partial',
          pendingEvents,
          actionCount: actionStats ? Number(actionStats.actionCount || 0) : null,
          pendingActionCount: actionStats ? Number(actionStats.pendingActionCount || 0) : null,
        };
      }

      const workspaces = db.prepare(`
        WITH deals AS (
          SELECT workspace_id,
            COUNT(*) AS dealCount,
            SUM(CASE WHEN stage IN ('new','hot','qualified','negotiating') THEN 1 ELSE 0 END) AS openDealCount,
            SUM(CASE WHEN stage='converted' THEN 1 ELSE 0 END) AS wonCount,
            SUM(CASE WHEN stage='lost' THEN 1 ELSE 0 END) AS lostCount,
            SUM(CASE WHEN stage IN ('new','hot','qualified','negotiating') AND updated_at <= datetime('now','-3 days') THEN 1 ELSE 0 END) AS stuckDealCount,
            COALESCE(SUM(CASE WHEN stage IN ('new','hot','qualified','negotiating') THEN amount_minor ELSE 0 END),0) AS pipelineValue,
            MAX(updated_at) AS lastCrmActivity
          FROM crm_deals GROUP BY workspace_id
        )
        SELECT w.id, w.name, w.slug, w.status,
          COALESCE(d.dealCount,0) AS dealCount,
          COALESCE(d.openDealCount,0) AS openDealCount,
          COALESCE(d.wonCount,0) AS wonCount,
          COALESCE(d.lostCount,0) AS lostCount,
          COALESCE(d.stuckDealCount,0) AS stuckDealCount,
          COALESCE(d.pipelineValue,0) AS pipelineValue,
          d.lastCrmActivity
        FROM workspaces w LEFT JOIN deals d ON d.workspace_id=w.id
        ORDER BY d.lastCrmActivity DESC, w.created_at DESC
        LIMIT 100
      `).all().map((row) => {
        const closedCount = Number(row.wonCount || 0) + Number(row.lostCount || 0);
        return {
          ...row,
          winRate: percent(Number(row.wonCount || 0), closedCount),
          engagement: engagementSignal(row, now()),
        };
      });

      if (hasOutbox) {
        const pendingByWorkspace = new Map(db.prepare(`
          SELECT workspace_id, COUNT(*) AS count FROM crm_automation_outbox
          WHERE status='pending' GROUP BY workspace_id
        `).all().map((row) => [row.workspace_id, Number(row.count || 0)]));
        for (const workspace of workspaces) workspace.pendingAutomationEvents = pendingByWorkspace.get(workspace.id) || 0;
      } else {
        for (const workspace of workspaces) workspace.pendingAutomationEvents = null;
      }

      return {
        status: 'available',
        evidence: 'persisted crm_deals + automation ledger',
        totals: {
          dealCount: Number(totals.dealCount || 0),
          openDealCount: Number(totals.openDealCount || 0),
          wonCount: Number(totals.wonCount || 0),
          lostCount: Number(totals.lostCount || 0),
          stuckCount: Number(totals.stuckCount || 0),
          pipelineValue: Number(totals.pipelineValue || 0),
          crmWorkspaceCount: Number(totals.crmWorkspaceCount || 0),
          latestCrmActivity: totals.latestCrmActivity || null,
          winRate: percent(Number(totals.wonCount || 0), closed),
        },
        automation,
        workspaces,
      };
    },
  };
}
