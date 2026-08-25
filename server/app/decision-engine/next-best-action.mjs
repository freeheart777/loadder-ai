import { getAllActions } from './action-registry.mjs';
import { scoreAction } from './decision-scorer.mjs';
import { checkGuardrails } from './guardrail-engine.mjs';

export function getNextBestAction(context = {}) {
  return getAllActions()
    .filter((action) => checkGuardrails(context, action).allowed)
    .map((action) => ({
      action,
      score: scoreAction({
        impact: action.impact ?? 0,
        confidence: action.confidence ?? 0,
        cost: action.cost ?? 0,
        risk: action.risk ?? 0,
        reversibility: action.reversibility ?? 0,
      }),
    }))
    .sort((a, b) => b.score - a.score)[0] ?? null;
}
