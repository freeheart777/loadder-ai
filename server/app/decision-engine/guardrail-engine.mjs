export function checkGuardrails(context = {}, action = {}) {
  if (
    action.id === 'increase_ads_budget' &&
    context.cacIncreasing &&
    context.conversionDropping
  ) {
    return {
      allowed: false,
      reason: 'Acquisition scaling blocked until conversion issues are addressed',
    };
  }

  return { allowed: true };
}
