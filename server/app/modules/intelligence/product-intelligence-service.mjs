export class ProductIntelligenceService {
  constructor({ agent, memoryService }) {
    this.agent = agent;
    this.memoryService = memoryService;
  }

  async analyze(product, context = {}) {
    const insight = await this.agent.run(product);

    if (this.memoryService) {
      await this.memoryService.remember({
        workspaceId: context.workspaceId,
        type: "product.insight",
        entityId: product.id,
        content: insight,
      });
    }

    return insight;
  }
}
