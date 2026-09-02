import { ProductIntelligenceAgent } from "../product-intelligence/index.mjs";

export function registerProductIntelligenceListener({ eventBus, memoryService }) {
  return eventBus.subscribe("product.created", async (event) => {
    const insight = await ProductIntelligenceAgent.run(event.payload || {});

    await memoryService.remember({
      workspaceId: event.workspaceId,
      type: "product.insight",
      entityId: event.entityId,
      content: insight,
    });
  });
}
