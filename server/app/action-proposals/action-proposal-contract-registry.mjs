const freeze = (entry) => Object.freeze(Object.fromEntries(Object.entries(entry).map(([key,value]) => [key,Array.isArray(value)?Object.freeze([...value]):value])));

function validate(entry) {
  if (!entry || typeof entry.actionType !== "string" || !entry.actionType ||
      !Number.isInteger(entry.actionVersion) || entry.actionVersion < 1 ||
      !Number.isInteger(entry.schemaVersion) || entry.schemaVersion < 1 ||
      !Array.isArray(entry.supportedRecommendationTypes) || !entry.supportedRecommendationTypes.length ||
      !Array.isArray(entry.supportedDecisionTypes) || entry.supportedDecisionTypes.some((value) => value !== "ADOPT") ||
      !Array.isArray(entry.supportedTargetTypes) || entry.supportedTargetTypes.length !== 1 ||
      entry.riskClass !== "NON_EXECUTING" || entry.executionEligible !== false ||
      entry.executable !== false || entry.requiresAuthorization !== true ||
      typeof entry.producer !== "string" || !entry.producer ||
      typeof entry.producerVersion !== "string" || !entry.producerVersion ||
      typeof entry.policyVersion !== "string" || !entry.policyVersion) {
    throw new Error("Action proposal contract is invalid.");
  }
  if (Object.hasOwn(entry,"parameters") || Object.hasOwn(entry,"parameterSchema")) {
    throw new Error("Phase 4I v1 action proposal contracts cannot define parameters.");
  }
  return freeze(entry);
}

export function createActionProposalContractRegistry(entries = []) {
  const contracts = new Map();
  for (const entry of entries.map(validate)) {
    const key = `${entry.actionType}@${entry.actionVersion}`;
    if (contracts.has(key)) throw new Error(`Duplicate action proposal contract: ${key}`);
    contracts.set(key,entry);
  }
  return Object.freeze({
    get: (actionType,actionVersion=1) => contracts.get(`${actionType}@${actionVersion}`) || null,
    list: () => [...contracts.values()],
  });
}

// No current evidence-review recommendation justifies a concrete action.
export const actionProposalContractRegistry = createActionProposalContractRegistry();
