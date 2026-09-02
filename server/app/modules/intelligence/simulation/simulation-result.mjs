export function simulationResult(input = {}) {
  return { prediction: input.prediction || null, confidence: 0 };
}
