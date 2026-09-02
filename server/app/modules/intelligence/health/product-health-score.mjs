export function calculateProductHealth(product = {}) {
  let score = 100;
  const issues = [];

  if (!product.imageUrl) {
    score -= 20;
    issues.push("missing_image");
  }

  if (!product.description) {
    score -= 20;
    issues.push("missing_description");
  }

  if (!product.reviews || product.reviews.length === 0) {
    score -= 10;
    issues.push("missing_reviews");
  }

  return {
    score: Math.max(score, 0),
    issues,
  };
}
