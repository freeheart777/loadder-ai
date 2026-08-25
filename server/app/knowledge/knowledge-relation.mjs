// Loadder Knowledge Graph Foundation v1
// Connects business patterns, interventions and outcomes.

export function createKnowledgeRelation({ from, relation, to, confidence = 0 }) {
  return {
    from,
    relation,
    to,
    confidence,
    createdAt: new Date().toISOString(),
  };
}
