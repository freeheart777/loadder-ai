export function scoreAction({
  impact = 0,
  confidence = 0,
  goalFit = 0,
  reversibility = 0,
  cost = 0,
  risk = 0,
}) {
  return Number((
    impact * 0.35 +
    confidence * 0.25 +
    goalFit * 0.2 +
    reversibility * 0.1 -
    cost * 0.05 -
    risk * 0.05
  ).toFixed(4));
}
