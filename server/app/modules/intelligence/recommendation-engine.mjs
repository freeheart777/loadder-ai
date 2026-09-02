export class RecommendationEngine {
  constructor({ decisionEngine }) {
    this.decisionEngine = decisionEngine;
  }

  async recommend(context) {
    return this.decisionEngine.analyze({
      type: "recommendation",
      context,
    });
  }
}
