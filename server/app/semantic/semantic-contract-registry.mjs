const contracts = [
  {
    semanticType: "listening_attention_state", semanticVersion: 1, schemaVersion: 1,
    allowedStates: ["SURGING", "RISING", "STABLE", "FALLING", "INSUFFICIENT_EVIDENCE"],
    subjectTypes: ["listening_scope"], valuePermitted: false,
    producer: "semantic_listening_attention", producerVersion: "1.0",
    requiredEvidenceKinds: ["listening_aggregate", "listening_trend_signal"],
    contextRequired: true,
  },
  {
    semanticType: "competitive_visibility_state", semanticVersion: 1, schemaVersion: 1,
    allowedStates: ["LEADING", "PARITY", "TRAILING", "INSUFFICIENT_EVIDENCE"],
    subjectTypes: ["listening_scope"], valuePermitted: false,
    producer: "semantic_competitive_visibility", producerVersion: "1.0",
    requiredEvidenceKinds: ["listening_aggregate"], contextRequired: true,
  },
].map((contract) => Object.freeze({ ...contract, allowedStates: Object.freeze(contract.allowedStates), subjectTypes: Object.freeze(contract.subjectTypes), requiredEvidenceKinds: Object.freeze(contract.requiredEvidenceKinds) }));

const registry = new Map(contracts.map((contract) => [contract.semanticType, contract]));
export const semanticContractRegistry = Object.freeze({
  get: (semanticType) => registry.get(semanticType) || null,
  list: () => [...registry.values()],
});
