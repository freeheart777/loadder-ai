export function createIntelligenceController({ queryService }) {
  return {
    async product(req, res) {
      const result = await queryService.productInsights({
        productId: req.params.id,
        workspaceId: req.workspaceId,
      });

      return res.json({
        success: true,
        ...result,
      });
    },
  };
}
