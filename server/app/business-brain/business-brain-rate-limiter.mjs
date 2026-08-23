export function createBusinessBrainRateLimiter({ now = () => Date.now(), userLimit = 3, workspaceLimit = 10, windowMs = 60_000 } = {}) {
  const users = new Map(), workspaces = new Map();
  const consume = (map, key, maximum, time) => { const recent = (map.get(key) || []).filter((value) => time - value < windowMs); if (recent.length >= maximum) return Math.max(1, Math.ceil((windowMs - (time - recent[0])) / 1000)); recent.push(time); map.set(key, recent); return 0; };
  return Object.freeze({
    acquire(workspaceId, userId) {
      const time = now(), userKey = `${workspaceId}:${userId}`, userRetry = consume(users, userKey, userLimit, time);
      if (userRetry) return { allowed: false, retryAfter: userRetry };
      const workspaceRetry = consume(workspaces, workspaceId, workspaceLimit, time);
      if (workspaceRetry) { users.get(userKey).pop(); return { allowed: false, retryAfter: workspaceRetry }; }
      return { allowed: true, retryAfter: 0 };
    },
  });
}
