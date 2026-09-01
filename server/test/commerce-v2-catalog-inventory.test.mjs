import test from "node:test";
import assert from "node:assert/strict";
import { createProduct, createVariant, canSellVariant, mergeProduct, assertVariantBelongsToProduct } from "../app/commerce/v2/catalog-core.mjs";
import { createInventoryState, availability, reserveInventory, releaseReservation, commitReservation, adjustOnHand, inventorySnapshot } from "../app/commerce/v2/inventory-reservation-engine.mjs";

const product = () => createProduct({ id:"p1",workspaceId:"w1",storeId:"s1",name:"Phone",status:"ACTIVE",brand:"Loadder" });
const variant = () => createVariant({ id:"v1",workspaceId:"w1",storeId:"s1",productId:"p1",sku:"PHONE-BLACK",priceMinor:1000,active:true });
const selector={workspaceId:"w1",storeId:"s1",variantId:"v1",locationId:"main"};

test("catalog creates immutable product/variant and sellability depends on lifecycle",()=>{
  const p=product(),v=variant();
  assert.equal(Object.isFrozen(p),true);
  assert.equal(Object.isFrozen(v),true);
  assert.equal(canSellVariant(p,v),true);
  const archived=mergeProduct(p,{status:"ARCHIVED"});
  assert.equal(canSellVariant(archived,v),false);
  assert.equal(p.status,"ACTIVE");
});

test("catalog blocks cross-tenant/product variant relationships",()=>{
  const p=product();
  const bad=createVariant({id:"v2",workspaceId:"w2",storeId:"s1",productId:"p1",sku:"BAD"});
  assert.throws(()=>assertVariantBelongsToProduct(p,bad),/CROSS_TENANT_OR_PRODUCT_VARIANT/);
});

test("inventory reserves without mutating input state",()=>{
  const state=createInventoryState([{...selector,onHand:10}]);
  const result=reserveInventory(state,selector,3);
  assert.equal(result.ok,true);
  assert.equal(availability(state,selector).available,10);
  assert.equal(availability(result.state,selector).available,7);
});

test("DENY inventory policy rejects oversell and ALLOW can reserve beyond on-hand",()=>{
  const state=createInventoryState([{...selector,onHand:2}]);
  const denied=reserveInventory(state,selector,3,{policy:"DENY"});
  assert.equal(denied.ok,false);
  assert.equal(denied.code,"INSUFFICIENT_INVENTORY");
  const allowed=reserveInventory(state,selector,3,{policy:"ALLOW"});
  assert.equal(allowed.ok,true);
  assert.equal(availability(allowed.state,selector).available,-1);
});

test("reservation can be released or committed deterministically",()=>{
  const initial=createInventoryState([{...selector,onHand:10}]);
  const reserved=reserveInventory(initial,selector,4).state;
  const released=releaseReservation(reserved,selector,1).state;
  assert.deepEqual(availability(released,selector),{...selector,onHand:10,reserved:3,committed:0,available:7});
  const committed=commitReservation(released,selector,2).state;
  assert.deepEqual(availability(committed,selector),{...selector,onHand:10,reserved:1,committed:2,available:7});
});

test("on-hand cannot drop below allocated stock",()=>{
  const state=reserveInventory(createInventoryState([{...selector,onHand:5}]),selector,3).state;
  assert.throws(()=>adjustOnHand(state,selector,-3),/ON_HAND_BELOW_ALLOCATED/);
  const next=adjustOnHand(state,selector,2).state;
  assert.equal(availability(next,selector).onHand,7);
});

test("inventory snapshot order is deterministic",()=>{
  const a={workspaceId:"w1",storeId:"s1",variantId:"b",locationId:"main",onHand:1};
  const b={workspaceId:"w1",storeId:"s1",variantId:"a",locationId:"main",onHand:1};
  const one=inventorySnapshot(createInventoryState([a,b]));
  const two=inventorySnapshot(createInventoryState([b,a]));
  assert.deepEqual(one,two);
});
