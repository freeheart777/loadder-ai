export const StoreManagerAgent = {
  name: "store-manager-agent",
  permissions: ["business.analyze"],

  summarize(context = {}) {
    return {
      status: "ready",
      insights: context.insights || [],
      recommendations: context.recommendations || []
    };
  }
};
