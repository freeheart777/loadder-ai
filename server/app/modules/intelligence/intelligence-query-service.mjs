export class IntelligenceQueryService {
  constructor({ insightRepository }) {
    this.insightRepository = insightRepository;
  }

  getProductInsights(productId, workspaceId) {
    return this.insightRepository.findByEntity({
      entityType: "product",
      entityId: productId,
      workspaceId,
    });
  }
}
