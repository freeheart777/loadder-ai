export class GrowthPlanner {
  createPlan({ goal, signals = [] }) {
    return {
      goal,
      signals,
      actions: signals.map((signal) => ({
        signal,
        action: "analyze_and_optimize"
      }))
    };
  }
}
