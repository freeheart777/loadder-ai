export function createBoundedSemaphore(limit) {
  if (!Number.isInteger(limit) || limit < 1) throw new TypeError("Semaphore limit must be positive.");
  let active = 0;
  return Object.freeze({
    tryAcquire() {
      if (active >= limit) return null;
      active += 1; let released = false;
      return () => { if (!released) { released = true; active -= 1; } };
    },
    get active() { return active; },
    limit,
  });
}

export const imageVerificationSemaphore = createBoundedSemaphore(2);
export const videoVerificationSemaphore = createBoundedSemaphore(1);
