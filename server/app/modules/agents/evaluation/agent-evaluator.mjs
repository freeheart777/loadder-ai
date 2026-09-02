export class AgentEvaluator {
  evaluate({ agent, result }) {
    return {
      agent: agent.name,
      success: Boolean(result),
      score: result ? 100 : 0,
      evaluatedAt: new Date().toISOString(),
    };
  }
}
