import test from 'node:test';
import assert from 'node:assert/strict';
import { createCrmAutomationService } from '../app/services/crm-automation-service.mjs';

function harness(events = [], nowMs = Date.parse('2026-09-09T00:00:00.000Z')) {
  const pending = [...events];
  const actions = new Map();
  const processed = [];
  const failed = [];
  const stuckCalls = [];

  const service = createCrmAutomationService({
    enqueueStuckEvents(args) {
      stuckCalls.push(args);
      return { scanned: 2, queued: 1 };
    },
    listPendingOutbox(limit) {
      return pending.filter((event) => !processed.includes(event.id)).slice(0, limit);
    },
    markOutboxProcessed(id) { processed.push(id); },
    markOutboxFailed(id, message) { failed.push({ id, message }); },
    createAutomationAction(action) {
      if (actions.has(action.idempotencyKey)) return false;
      actions.set(action.idempotencyKey, action);
      return true;
    },
    listAutomationActions() { return [...actions.values()]; },
    automationSummary() { return { pendingEvents: 0, actions: [] }; },
    now: () => nowMs,
  });

  return { service, actions, processed, failed, stuckCalls };
}

test('won event creates onboarding and invoice handoffs exactly once', () => {
  const event = {
    id: 'evt-won', eventType: 'deal.won', dealId: 'deal-1', dealVersion: 4,
    payload: { title: 'Enterprise Deal', amount: 9000000, currency: 'IRT' },
  };
  const h = harness([event]);

  const first = h.service.processPending();
  assert.deepEqual(first, { scanned: 1, processed: 1, failed: 0 });
  assert.equal(h.actions.size, 2);
  assert.ok([...h.actions.values()].some((action) => action.actionType === 'onboarding_handoff'));
  assert.ok([...h.actions.values()].some((action) => action.actionType === 'invoice_handoff'));

  h.processed.length = 0;
  const retry = h.service.processPending();
  assert.equal(retry.processed, 1);
  assert.equal(h.actions.size, 2, 'idempotency keys must prevent duplicate handoffs');
});

test('lost event creates completed analysis action carrying the reason', () => {
  const h = harness([{
    id: 'evt-lost', eventType: 'deal.lost', dealId: 'deal-2', dealVersion: 7,
    payload: { title: 'Lost Deal', reason: 'قیمت بالاتر از بودجه' },
  }]);

  h.service.processPending();
  const [action] = [...h.actions.values()];
  assert.equal(action.actionType, 'lost_analysis');
  assert.equal(action.status, 'completed');
  assert.equal(action.payload.reason, 'قیمت بالاتر از بودجه');
});

test('stuck event creates one follow-up task with a deterministic retry key', () => {
  const h = harness([{
    id: 'evt-stuck', eventType: 'deal.stuck', dealId: 'deal-3', dealVersion: 2,
    payload: { title: 'Slow Deal', stage: 'qualified', owner: 'ندا', lastActivityAt: '2026-09-01T00:00:00.000Z' },
  }]);

  h.service.processPending();
  const [action] = [...h.actions.values()];
  assert.equal(action.actionType, 'follow_up_task');
  assert.equal(action.payload.owner, 'ندا');
  assert.match(action.idempotencyKey, /deal\.stuck:deal-3:v2:follow_up/);
});

test('stuck sweep uses the requested threshold then processes pending events', () => {
  const h = harness([]);
  const result = h.service.sweepStuck({ afterDays: 3 });

  assert.equal(result.afterDays, 3);
  assert.equal(result.scanned, 0, 'processing scan count reflects pending outbox after enqueue mock');
  assert.equal(h.stuckCalls.length, 1);
  assert.equal(h.stuckCalls[0].thresholdIso, '2026-09-06T00:00:00.000Z');
});

test('invalid stuck threshold is rejected before repository access', () => {
  const h = harness([]);
  assert.throws(() => h.service.sweepStuck({ afterDays: 0 }), /between 1 and 90/);
  assert.equal(h.stuckCalls.length, 0);
});
