export function analyzeProduct(product = {}) {
  const issues = [];

  if (!product.imageUrl) issues.push("missing_image");
  if (!product.description) issues.push("missing_description");
  if (!product.brand) issues.push("missing_brand");

  return {
    score: Math.max(0, 100 - issues.length * 15),
    issues,
    recommendations: issues.map((issue) => ({
      issue,
      action: `resolve_${issue}`,
    })),
  };
}
