export const ProductIntelligenceAgent = {
  name: "product-intelligence",
  permissions: ["product.analyze"],

  async run(product) {
    const issues = [];

    if (!product.description) issues.push("missing_description");
    if (!product.imageUrl) issues.push("missing_image");

    return {
      productId: product.id,
      issues,
      score: Math.max(0, 100 - issues.length * 20),
    };
  },
};
