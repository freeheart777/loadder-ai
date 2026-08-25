// Loadder Knowledge Graph Foundation v1
// Represents reusable business improvement knowledge nodes.

export function createKnowledgeNode({ type, entityId, data = {}, confidence = 0 }) {
  return {
    id: `${type}:${entityId}`,
    type,
    entityId,
    data,
    confidence,
    createdAt: new Date().toISOString(),
  };
}
