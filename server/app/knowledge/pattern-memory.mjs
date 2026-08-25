const patterns = new Map();

export function createPatternMemory() {
  return {
    create(pattern) {
      const record = {
        id: pattern.id || crypto.randomUUID(),
        evidenceCount: pattern.evidenceCount || 1,
        confidence: pattern.confidence || 0,
        createdAt: new Date().toISOString(),
        ...pattern,
      };

      patterns.set(record.id, record);
      return record;
    },

    get(id) {
      return patterns.get(id) || null;
    },

    list() {
      return Array.from(patterns.values());
    },

    findSimilar(context = {}) {
      return Array.from(patterns.values())
        .map((pattern) => ({
          pattern,
          score: calculateSimilarity(pattern.context || {}, context),
        }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score);
    },
  };
}

function calculateSimilarity(source, target) {
  const keys = Object.keys(target);
  if (!keys.length) return 0;

  const matches = keys.filter((key) => source[key] === target[key]).length;
  return matches / keys.length;
}
