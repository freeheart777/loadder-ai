import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePromotion } from "../app/commerce/v2/promotion-engine.mjs";

const cart = {
  lines: [
    { id: "l1", productId: "p1", category: "phone", brand: "A", quantity: 2, unitPriceMinor: 1000 },
    { id: "l2", productId: "p2", category: "case", brand: "B", quantity: 1, unitPriceMinor: 500 },
  ],
};

test("percentage promotion is deterministic and does not mutate cart", () => {
  const before = structuredClone(cart);
  const promotion = { id: "promo-1", active: true, rewardType: "PERCENT", rewardValue: 10 };
  const a = evaluatePromotion(cart, promotion, { nowMs: 1_800_000_000_000 });
  const b = evaluatePromotion(cart, promotion, { nowMs: 1_800_000_000_000 });
  assert.deepEqual(a, b);
  assert.equal(a.discountMinor, 250);
  assert.equal(a.eligible, true);
  assert.deepEqual(cart, before);
});

test("exclusions override inclusions", () => {
  const result = evaluatePromotion(cart, {
    id: "promo-2", active: true, rewardType: "PERCENT", rewardValue: 50,
    include: { categories: ["phone", "case"] }, exclude: { productIds: ["p1"] },
  });
  assert.equal(result.discountMinor, 250);
  assert.deepEqual(result.lineDiscounts, [{ lineId: "l2", discountMinor: 250 }]);
});

test("fixed cart discount never exceeds eligible merchandise value", () => {
  const result = evaluatePromotion(cart, {
    id: "promo-3", active: true, rewardType: "FIXED_CART", rewardValue: 99_999,
    include: { productIds: ["p2"] },
  });
  assert.equal(result.discountMinor, 500);
});

test("expired and exhausted promotions fail with explicit reasons", () => {
  const expired = evaluatePromotion(cart, { id: "x", active: true, rewardType: "PERCENT", rewardValue: 10, endsAt: "2025-01-01T00:00:00Z" }, { nowMs: Date.parse("2026-01-01T00:00:00Z") });
  assert.equal(expired.eligible, false);
  assert.deepEqual(expired.reasonCodes, ["PROMOTION_EXPIRED"]);
  const exhausted = evaluatePromotion(cart, { id: "y", active: true, rewardType: "PERCENT", rewardValue: 10, usageLimit: 5, usageCount: 5 });
  assert.deepEqual(exhausted.reasonCodes, ["PROMOTION_EXHAUSTED"]);
});

test("minimum subtotal and minimum quantity are enforced", () => {
  const subtotal = evaluatePromotion(cart, { id: "z", active: true, rewardType: "PERCENT", rewardValue: 10, minimumSubtotalMinor: 10_000 });
  assert.deepEqual(subtotal.reasonCodes, ["MINIMUM_SUBTOTAL_NOT_MET"]);
  const quantity = evaluatePromotion(cart, { id: "q", active: true, rewardType: "FIXED_LINE", rewardValue: 100, minimumLineQuantity: 3 });
  assert.deepEqual(quantity.reasonCodes, ["NO_ELIGIBLE_LINES"]);
});
