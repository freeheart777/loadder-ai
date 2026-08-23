import { landingHash } from "../landing/landing-contracts.mjs";
import { ShippingProviderError } from "../shipping/shipping-providers.mjs";
import { shippingProviderRegistry } from "../shipping/shipping-provider-registry.mjs";
export class InventoryFulfillmentError extends Error { constructor(code, status = 400) { super(code); this.code = code; this.status = status; } }
const fail = (code, status = 400) => { throw new InventoryFulfillmentError(code, status); };
const roles = new Set(["owner", "admin"]);
const strict = (value, keys) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).every((key) => keys.includes(key));
const requireActor = (actor) => { if (!actor?.userId || !actor.workspaceId || !roles.has(actor.role)) fail("SHIPPING_PERMISSION_DENIED", 403); };
const requireKey = (value) => typeof value === "string" && value.trim() && value.length <= 200 ? value.trim() : fail("FULFILLMENT_IDEMPOTENCY_CONFLICT", 409);

export function createInventoryFulfillmentService({ repository, provider, registry = shippingProviderRegistry, now = () => new Date() }) {
  const at = () => now().toISOString();
  const providerResultValid = (result) => strict(result, ["providerShipmentReference", "trackingNumber", "status"]) && typeof result.providerShipmentReference === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(result.providerShipmentReference) && (result.trackingNumber === null || typeof result.trackingNumber === "string" && result.trackingNumber.length <= 200) && ["CREATED", "READY", "IN_TRANSIT"].includes(result.status);
  return Object.freeze({
    readiness() { return { shippingManualEnabled: true, shippingProviderConfigured: Boolean(provider.configured), shippingProviderEnabled: Boolean(provider.configured && provider.enabled), provider: provider.provider, liveValidationStatus: provider.liveValidationStatus || null, providers: registry.list() }; },
    setInventory(productId, input, actor) {
      requireActor(actor);
      if (!strict(input, ["variantId", "trackingMode", "stockOnHand", "lowStockThreshold", "revision"]) || !["TRACKED", "UNTRACKED"].includes(input.trackingMode) || !Number.isSafeInteger(input.stockOnHand) || input.stockOnHand < 0 || input.lowStockThreshold !== null && (!Number.isSafeInteger(input.lowStockThreshold) || input.lowStockThreshold < 0) || !Number.isInteger(input.revision) || input.revision < 0) fail("INVENTORY_INVALID");
      const product = repository.findProduct(productId, actor.workspaceId); if (!product) fail("INVENTORY_ITEM_NOT_FOUND", 404);
      if (input.variantId) { const variant = repository.findVariant(input.variantId, actor.workspaceId); if (!variant || variant.productId !== product.id) fail("INVENTORY_ITEM_NOT_FOUND", 404); }
      try { const inventory = repository.setInventory({ workspaceId: actor.workspaceId, catalogId: product.catalogId, productId, variantId: input.variantId, trackingMode: input.trackingMode, stockOnHand: input.stockOnHand, lowStockThreshold: input.lowStockThreshold, revision: input.revision, userId: actor.userId, now: at() }); if (!inventory) fail("INVENTORY_REVISION_CONFLICT", 409); return { inventory: { ...inventory, available: inventory.stockOnHand - inventory.stockReserved } }; } catch (error) { if (error instanceof InventoryFulfillmentError) throw error; fail(error.code || "INVENTORY_INVALID", error.code ? 409 : 400); }
    },
    listInventory(actor) { requireActor(actor); return { inventoryItems: repository.listInventory(actor.workspaceId) }; },
    processOrder(orderId, actor = { system: true }) {
      if (!actor.system) requireActor(actor);
      const order = repository.findOrder(orderId, actor.workspaceId); if (!order) fail("FULFILLMENT_NOT_FOUND", 404);
      const normalized = { orderId: order.id, policy: "POST_PAYMENT_DIRECT_COMMIT_V1" };
      try { return { fulfillment: repository.processOrder({ workspaceId: order.workspaceId, orderId: order.id, userId: actor.userId, idempotencyKey: `order:${order.id}`, requestHash: landingHash(normalized), now: at() }) }; } catch (error) { fail(error.code || "FULFILLMENT_INVALID_STATE", 409); }
    },
    getPublicStatus(orderId) { const fulfillment = repository.fulfillmentByOrder(orderId); if (!fulfillment) return null; const shipment = repository.shipmentByFulfillment(fulfillment.id); return Object.freeze({ status: fulfillment.status, processingStatus: fulfillment.processingStatus, shipmentStatus: shipment?.status || null, trackingNumber: shipment?.trackingNumber || null }); },
    listFulfillments(actor) { requireActor(actor); return { fulfillments: repository.listFulfillments(actor.workspaceId) }; },
    getFulfillment(id, actor) { requireActor(actor); const fulfillment = repository.fulfillment(id, actor.workspaceId); if (!fulfillment) fail("FULFILLMENT_NOT_FOUND", 404); return { fulfillment, shipment: repository.shipmentByFulfillment(fulfillment.id) }; },
    transitionFulfillment(id, input, actor) { requireActor(actor); if (!strict(input, ["status", "revision"]) || !Number.isInteger(input.revision)) fail("FULFILLMENT_INVALID_STATE", 409); const prior = repository.fulfillment(id, actor.workspaceId); if (!prior) fail("FULFILLMENT_NOT_FOUND", 404); const value = repository.transitionFulfillment({ id, workspaceId: actor.workspaceId, status: input.status, revision: input.revision, now: at() }); if (!value) fail("FULFILLMENT_INVALID_STATE", 409); return { fulfillment: value }; },
    createShipment(fulfillmentId, input, actor, rawKey) {
      requireActor(actor);
      if (!strict(input, ["provider", "trackingNumber"]) || !registry.supports(input.provider, "CREATE") || input.trackingNumber !== null && (typeof input.trackingNumber !== "string" || input.trackingNumber.trim().length < 1 || input.trackingNumber.length > 200)) fail("SHIPMENT_INVALID");
      const fulfillment = repository.fulfillment(fulfillmentId, actor.workspaceId); if (!fulfillment) fail("FULFILLMENT_NOT_FOUND", 404); if (fulfillment.fulfillmentMode !== "PHYSICAL_DELIVERY") fail("FULFILLMENT_INVALID_STATE", 409);
      const idempotencyKey = requireKey(rawKey), normalized = { fulfillmentId, provider: input.provider, trackingNumber: input.trackingNumber }, requestHash = landingHash(normalized);
      let output = { providerShipmentReference: null, trackingNumber: input.trackingNumber, status: "CREATED" };
      if (input.provider !== "MANUAL") { if (provider.provider !== input.provider || !provider.configured || !provider.enabled) fail("SHIPPING_NOT_CONFIGURED", 503); try { output = provider.createShipment({ fulfillmentId, orderId: fulfillment.confirmedOrderId }); if (!providerResultValid(output)) fail("SHIPPING_PROVIDER_INVALID_RESPONSE", 502); } catch (error) { if (error instanceof InventoryFulfillmentError) throw error; fail(error instanceof ShippingProviderError ? error.code : "SHIPPING_PROVIDER_UNAVAILABLE", 503); } }
      const result = repository.createShipment({ workspaceId: actor.workspaceId, fulfillmentId, orderId: fulfillment.confirmedOrderId, provider: input.provider, providerVersion: 1, status: output.status, trackingNumber: output.trackingNumber, providerReference: output.providerShipmentReference, idempotencyKey, requestHash, userId: actor.userId, now: at() });
      if (!result.created && result.value.requestHash !== requestHash) fail("FULFILLMENT_IDEMPOTENCY_CONFLICT", 409); return { shipment: result.value, reusedResult: !result.created };
    },
    transitionShipment(id, input, actor) {
      requireActor(actor); if (!strict(input, ["status", "revision"]) || !["IN_TRANSIT", "DELIVERED"].includes(input.status) || !Number.isInteger(input.revision)) fail("FULFILLMENT_INVALID_STATE", 409);
      const prior = repository.shipment(id, actor.workspaceId); if (!prior) fail("SHIPMENT_NOT_FOUND", 404); const shipment = repository.transitionShipment({ id, workspaceId: actor.workspaceId, status: input.status, revision: input.revision, now: at() }); if (!shipment) fail("FULFILLMENT_INVALID_STATE", 409);
      const fulfillment = repository.fulfillment(prior.fulfillmentId, actor.workspaceId); repository.transitionFulfillment({ id: fulfillment.id, workspaceId: actor.workspaceId, status: input.status === "IN_TRANSIT" ? "SHIPPED" : "COMPLETED", revision: fulfillment.revision, now: at() }); return { shipment };
    },
  });
}
