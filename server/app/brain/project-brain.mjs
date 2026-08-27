const DEFAULT_VERSION = 1;

export function createProjectBrain({ store }) {
  if (!store || typeof store.get !== "function" || typeof store.save !== "function") throw new TypeError("store must implement get/save");
  return Object.freeze({
    async get(projectId) { return (await store.get(projectId)) ?? { projectId, version: DEFAULT_VERSION, facts: {}, decisions: [], rules: [], knowledge: [], updatedAt: new Date().toISOString() }; },
    async update(projectId, patch) {
      const current = await this.get(projectId);
      const next = { ...current, ...patch, projectId, version: (current.version ?? DEFAULT_VERSION) + 1, updatedAt: new Date().toISOString() };
      await store.save(next);
      return next;
    },
  });
}
