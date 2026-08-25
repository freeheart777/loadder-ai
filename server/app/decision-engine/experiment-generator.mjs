export function createExperimentProposal({ action, context = {} }) {
  return {
    type: 'decision_experiment',
    actionId: action?.id ?? null,
    durationDays: 14,
    successMetrics: action?.metrics ?? [],
    context,
    rollbackSupported: Boolean(action?.rollback?.possible),
    status: 'proposed',
  };
}
