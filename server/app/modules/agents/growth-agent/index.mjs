export const GrowthAgent = {
  name: "growth-agent",
  permissions: ["growth.analyze"],

  async analyze(context) {
    return {
      agent: "growth-agent",
      recommendations: [],
      context,
      status: "ready",
    };
  },
};
