import express from "express";
import { InventoryFulfillmentError } from "../services/inventory-fulfillment-service.mjs";
export function createInventoryFulfillmentRouter({ service }) {
  const router = express.Router();
  const actor = (request) => ({ userId: request.user.id, role: request.membership.role, workspaceId: request.workspace.id });
  const run = (response, operation, status = 200) => { try { const result = operation(); return response.status(result.reusedResult ? 200 : status).json({ success: true, ...result }); } catch (error) { return response.status(error instanceof InventoryFulfillmentError ? error.status : 500).json({ success: false, code: error instanceof InventoryFulfillmentError ? error.code : "FULFILLMENT_INVALID_STATE", message: "Commerce fulfillment operation could not be completed." }); } };
  router.get("/commerce/shipping/readiness", (_request, response) => run(response, () => service.readiness()));
  router.put("/commerce/products/:id/inventory", (request, response) => run(response, () => service.setInventory(request.params.id, request.body, actor(request))));
  router.get("/commerce/inventory", (request, response) => run(response, () => service.listInventory(actor(request))));
  router.post("/commerce/orders/:id/fulfillment", (request, response) => run(response, () => service.processOrder(request.params.id, actor(request)), 201));
  router.get("/commerce/fulfillments", (request, response) => run(response, () => service.listFulfillments(actor(request))));
  router.get("/commerce/fulfillments/:id", (request, response) => run(response, () => service.getFulfillment(request.params.id, actor(request))));
  router.patch("/commerce/fulfillments/:id", (request, response) => run(response, () => service.transitionFulfillment(request.params.id, request.body, actor(request))));
  router.post("/commerce/fulfillments/:id/shipments", (request, response) => run(response, () => service.createShipment(request.params.id, request.body, actor(request), request.headers["idempotency-key"]), 201));
  router.patch("/commerce/shipments/:id", (request, response) => run(response, () => service.transitionShipment(request.params.id, request.body, actor(request))));
  return router;
}
