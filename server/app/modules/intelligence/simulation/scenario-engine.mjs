export class ScenarioEngine {
  simulate({ scenario, current = {} }) {
    return {
      scenario,
      current,
      confidence: 0.5,
      result: "requires_more_data"
    };
  }
}
