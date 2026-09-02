export class DashboardSummaryService {
  constructor({ queryService, growthEngine }) {
    this.queryService = queryService;
    this.growthEngine = growthEngine;
  }

  async summary(workspaceId) {
    const insights = await this.queryService.list({ workspaceId });
    const signals = await this.growthEngine.detect({ insights });

    return {
      insights,
      signals,
      generatedAt: new Date().toISOString(),
    };
  }
}
