export function createContentGenerationRateLimiter({ now = () => Date.now(), userLimit = 5, workspaceLimit = 20, workspaceConcurrency = 2 } = {}) {
  const users = new Map();
  const workspaces = new Map();
  const active = new Map();
  const windowMs = 60_000;
  const consume = (map, key, maximum, time) => {
    const recent = (map.get(key) || []).filter((value) => time - value < windowMs);
    if (recent.length >= maximum) return Math.max(1, Math.ceil((windowMs - (time - recent[0])) / 1000));
    recent.push(time); map.set(key, recent); return 0;
  };
  return Object.freeze({
    acquire(workspaceId, userId) {
      const time = now();
      const current = active.get(workspaceId) || 0;
      if (current >= workspaceConcurrency) return { allowed: false, retryAfter: 1, release() {} };
      const userRetry = consume(users, `${workspaceId}:${userId}`, userLimit, time);
      if (userRetry) return { allowed: false, retryAfter: userRetry, release() {} };
      const workspaceRetry = consume(workspaces, workspaceId, workspaceLimit, time);
      if (workspaceRetry) {
        const userEvents = users.get(`${workspaceId}:${userId}`); userEvents.pop();
        return { allowed: false, retryAfter: workspaceRetry, release() {} };
      }
      active.set(workspaceId, current + 1);
      let released = false;
      return { allowed: true, retryAfter: 0, release() { if (released) return; released = true; const next = (active.get(workspaceId) || 1) - 1; if (next) active.set(workspaceId, next); else active.delete(workspaceId); } };
    },
  });
}
