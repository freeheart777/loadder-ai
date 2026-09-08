const ACTIVE_STAGES = new Set(['new', 'hot', 'qualified', 'negotiating']);

function daysAgoIso(days, nowMs) {
  return new Date(nowMs - days * 86_400_000).toISOString();
}

export function createCrmAutomationService({
  enqueueStuckEvents,
  listPendingOutbox,
  markOutboxProcessed,
  markOutboxFailed,
  createAutomationAction,
  listAutomationActions,
  automationSummary,
  now = () => Date.now(),
}) {
  if (!enqueueStuckEvents || !listPendingOutbox || !markOutboxProcessed || !markOutboxFailed || !createAutomationAction || !listAutomationActions || !automationSummary) {
    throw new Error('CRM automation service requires repository functions.');
  }

  function processEvent(event) {
    const payload = event.payload || {};
    const baseKey = `${event.eventType}:${event.dealId}:v${event.dealVersion}`;

    if (event.eventType === 'deal.stuck') {
      createAutomationAction({
        dealId: event.dealId,
        actionType: 'follow_up_task',
        title: `پیگیری Deal متوقف‌شده: ${payload.title || event.dealId}`,
        payload: {
          owner: payload.owner || 'تیم فروش',
          stage: payload.stage,
          lastActivityAt: payload.lastActivityAt,
          suggestedDueAt: new Date(now() + 86_400_000).toISOString(),
          sourceEvent: event.eventType,
        },
        idempotencyKey: `${baseKey}:follow_up`,
      });
      return;
    }

    if (event.eventType === 'deal.won') {
      createAutomationAction({
        dealId: event.dealId,
        actionType: 'onboarding_handoff',
        title: `شروع آنبوردینگ: ${payload.title || event.dealId}`,
        payload: { ...payload, sourceEvent: event.eventType },
        idempotencyKey: `${baseKey}:onboarding`,
      });
      createAutomationAction({
        dealId: event.dealId,
        actionType: 'invoice_handoff',
        title: `درخواست صدور فاکتور: ${payload.title || event.dealId}`,
        payload: { ...payload, sourceEvent: event.eventType },
        idempotencyKey: `${baseKey}:invoice`,
      });
      return;
    }

    if (event.eventType === 'deal.lost') {
      createAutomationAction({
        dealId: event.dealId,
        actionType: 'lost_analysis',
        title: `تحلیل علت شکست: ${payload.title || event.dealId}`,
        payload: { ...payload, sourceEvent: event.eventType },
        idempotencyKey: `${baseKey}:lost_analysis`,
        status: 'completed',
      });
      return;
    }

    if (event.eventType === 'deal.stage_changed' && ACTIVE_STAGES.has(payload.toStage)) return;
  }

  function processPending({ limit = 50 } = {}) {
    const events = listPendingOutbox(limit);
    let processed = 0;
    let failed = 0;
    for (const event of events) {
      try {
        processEvent(event);
        markOutboxProcessed(event.id, new Date(now()).toISOString());
        processed += 1;
      } catch (error) {
        markOutboxFailed(event.id, error?.message || String(error));
        failed += 1;
      }
    }
    return { scanned: events.length, processed, failed };
  }

  function sweepStuck({ afterDays = 3 } = {}) {
    const normalized = Number(afterDays);
    if (!Number.isFinite(normalized) || normalized < 1 || normalized > 90) throw new Error('afterDays must be between 1 and 90.');
    const timestamp = now();
    const queued = enqueueStuckEvents({ thresholdIso: daysAgoIso(normalized, timestamp), occurredAt: new Date(timestamp).toISOString() });
    const processing = processPending();
    return { ...queued, ...processing, afterDays: normalized };
  }

  return Object.freeze({
    processPending,
    sweepStuck,
    actions: (limit = 100) => listAutomationActions(limit),
    summary: () => automationSummary(),
  });
}
