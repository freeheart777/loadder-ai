import { createPaymentIntent, normalizePaymentEvent } from "./payment-contract.mjs";

export function createPaymentRuntime({ createIntent, verifyEvent, idempotencyStore } = {}) {
  if (typeof createIntent !== "function" || typeof verifyEvent !== "function" || !idempotencyStore || typeof idempotencyStore.claim !== "function") {
    throw new Error("Payment runtime adapter is incomplete");
  }
  return Object.freeze({
    async start(input) {
      const intent = createPaymentIntent(input);
      const result = await createIntent(intent);
      if (!result?.providerId) throw new Error("Payment provider must return providerId");
      return { ...intent, providerId: result.providerId, checkoutUrl: result.checkoutUrl || null };
    },
    async handleWebhook({ payload, signature }) {
      const raw = await verifyEvent({ payload, signature });
      const event = normalizePaymentEvent(raw);
      const claimed = await idempotencyStore.claim(event.id, { reference: event.reference || null, status: event.status || null });
      return { ok: true, idempotent: !claimed, event };
    },
  });
}

export function createMemoryPaymentIdempotencyStore() {
  const seen = new Set();
  return {
    claim: async (id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    },
    has: async (id) => seen.has(id),
    add: async (id) => { seen.add(id); return true; },
  };
}
