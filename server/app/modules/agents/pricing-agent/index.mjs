export const PricingAgent = {
  name: "pricing-agent",
  permissions: ["pricing.analyze"],

  analyze({ currentPrice, marketPrice }) {
    const diff = (currentPrice || 0) - (marketPrice || 0);
    return {
      currentPrice,
      marketPrice,
      signal: diff > 0 ? "above_market" : "competitive"
    };
  }
};
