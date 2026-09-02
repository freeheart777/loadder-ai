export class GrowthSignalEngine {
  analyze(metrics = {}) {
    const signals = [];

    if ((metrics.views || 0) > 1000 && (metrics.sales || 0) < 10) {
      signals.push({
        type: "conversion_risk",
        severity: "medium",
        recommendation: "improve_product_experience",
      });
    }

    if ((metrics.inventory || 0) === 0) {
      signals.push({
        type: "inventory_risk",
        severity: "high",
        recommendation: "review_stock",
      });
    }

    return signals;
  }
}
