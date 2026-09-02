export class ProductIntelligenceWorkflow {
  constructor({ agent, insightService, memoryService }) {
    this.agent = agent;
    this.insightService = insightService;
    this.memoryService = memoryService;
  }

  async execute(product) {
    const result = await this.agent.run(product);

    const insight = await this.insightService.create({
      type: "product.insight",
      entityId: product.id,
      payload: result,
    });

    await this.memoryService.remember({
      type: "product.insight",
      content: result,
    });

    return insight;
  }
}
