import test from "node:test";
import assert from "node:assert/strict";
import { createProduct, createVariant, canSellVariant } from "../app/commerce/v2/catalog-core.mjs";
import { createInventoryState, reserveInventory, commitReservation, availability } from "../app/commerce/v2/inventory-reservation-engine.mjs";

test("active catalog item can reserve and commit stock without tenant leakage",()=>{
  const product=createProduct({id:"p",workspaceId:"tenant-a",storeId:"store-a",name:"Demo",status:"ACTIVE"});
  const variant=createVariant({id:"v",workspaceId:"tenant-a",storeId:"store-a",productId:"p",sku:"DEMO-1",inventoryPolicy:"DENY"});
  assert.equal(canSellVariant(product,variant),true);
  const selector={workspaceId:"tenant-a",storeId:"store-a",variantId:"v",locationId:"main"};
  const initial=createInventoryState([{...selector,onHand:4}]);
  const reserved=reserveInventory(initial,selector,2,{policy:variant.inventoryPolicy});
  assert.equal(reserved.ok,true);
  const committed=commitReservation(reserved.state,selector,2);
  assert.equal(availability(committed.state,selector).committed,2);
  const other={workspaceId:"tenant-b",storeId:"store-a",variantId:"v",locationId:"main"};
  assert.equal(availability(committed.state,other).onHand,0);
});
