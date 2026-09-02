export class MetricEngine {
  calculate(input = {}) {
    return { score: Number(input.score || 0) };
  }
}
