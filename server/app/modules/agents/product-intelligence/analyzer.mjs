export function analyzeProduct(product = {}) {
  const issues = [];

  if (!product.description) issues.push("missing_description");
  if (!product.imageUrl && !product.metadata?.gallery?.length) issues.push("missing_media");
  if ((product.views || 0) > 1000 && (product.sales || 0) < 10) {
    issues.push("low_conversion");
  }

  return {
    score: Math.max(0, 100 - issues.length * 15),
    issues,
    recommendations: issues.map((issue) => ({
      issue,
      action: `resolve_${issue}`,
    })),
  };
}
