const clampInt = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const n = Number(value);
  if (!Number.isInteger(n)) throw new TypeError("Expected integer value.");
  return Math.min(max, Math.max(min, n));
};

const text = (value) => String(value ?? "").trim();
const upper = (value) => text(value).toUpperCase();

function eligibleLines(cart, promotion) {
  const include = promotion.include || {};
  const exclude = promotion.exclude || {};
  return (cart.lines || []).filter((line) => {
    const productId = text(line.productId);
    const category = upper(line.category);
    const brand = upper(line.brand);
    if (exclude.productIds?.includes(productId)) return false;
    if (exclude.categories?.map(upper).includes(category)) return false;
    if (exclude.brands?.map(upper).includes(brand)) return false;
    const hasInclusions = Boolean(include.productIds?.length || include.categories?.length || include.brands?.length);
    if (!hasInclusions) return true;
    if (include.productIds?.includes(productId)) return true;
    if (include.categories?.map(upper).includes(category)) return true;
    if (include.brands?.map(upper).includes(brand)) return true;
    return false;
  });
}

function lineValue(line) {
  const quantity = clampInt(line.quantity, 0);
  const unitPriceMinor = clampInt(line.unitPriceMinor, 0);
  return quantity * unitPriceMinor;
}

function inactiveReason(promotion, nowMs) {
  if (promotion.active === false) return "PROMOTION_INACTIVE";
  if (promotion.startsAt && Date.parse(promotion.startsAt) > nowMs) return "PROMOTION_NOT_STARTED";
  if (promotion.endsAt && Date.parse(promotion.endsAt) < nowMs) return "PROMOTION_EXPIRED";
  if (promotion.usageLimit != null && clampInt(promotion.usageCount || 0, 0) >= clampInt(promotion.usageLimit, 0)) return "PROMOTION_EXHAUSTED";
  return null;
}

export function evaluatePromotion(cart, promotion, context = {}) {
  if (!cart || typeof cart !== "object") throw new TypeError("Cart is required.");
  if (!promotion || typeof promotion !== "object") throw new TypeError("Promotion is required.");
  const nowMs = context.nowMs ?? Date.now();
  const unavailable = inactiveReason(promotion, nowMs);
  if (unavailable) return { eligible: false, discountMinor: 0, lineDiscounts: [], reasonCodes: [unavailable], promotionId: promotion.id ?? null };

  const subtotalMinor = (cart.lines || []).reduce((sum, line) => sum + lineValue(line), 0);
  const minimumSubtotalMinor = clampInt(promotion.minimumSubtotalMinor || 0, 0);
  if (subtotalMinor < minimumSubtotalMinor) {
    return { eligible: false, discountMinor: 0, lineDiscounts: [], reasonCodes: ["MINIMUM_SUBTOTAL_NOT_MET"], promotionId: promotion.id ?? null };
  }

  const lines = eligibleLines(cart, promotion).filter((line) => clampInt(line.quantity, 0) >= clampInt(promotion.minimumLineQuantity || 0, 0));
  if (!lines.length) return { eligible: false, discountMinor: 0, lineDiscounts: [], reasonCodes: ["NO_ELIGIBLE_LINES"], promotionId: promotion.id ?? null };

  const eligibleValue = lines.reduce((sum, line) => sum + lineValue(line), 0);
  const type = upper(promotion.rewardType);
  const value = clampInt(promotion.rewardValue, 0);
  let discountMinor = 0;
  let lineDiscounts = [];

  if (type === "PERCENT") {
    const percent = Math.min(value, 100);
    lineDiscounts = lines.map((line) => ({ lineId: line.id, discountMinor: Math.floor(lineValue(line) * percent / 100) }));
    discountMinor = lineDiscounts.reduce((sum, item) => sum + item.discountMinor, 0);
  } else if (type === "FIXED_CART") {
    discountMinor = Math.min(value, eligibleValue);
  } else if (type === "FIXED_LINE") {
    lineDiscounts = lines.map((line) => ({ lineId: line.id, discountMinor: Math.min(value, lineValue(line)) }));
    discountMinor = lineDiscounts.reduce((sum, item) => sum + item.discountMinor, 0);
  } else {
    return { eligible: false, discountMinor: 0, lineDiscounts: [], reasonCodes: ["UNSUPPORTED_REWARD_TYPE"], promotionId: promotion.id ?? null };
  }

  discountMinor = Math.min(discountMinor, eligibleValue);
  return { eligible: discountMinor > 0, discountMinor, lineDiscounts, reasonCodes: discountMinor > 0 ? ["PROMOTION_APPLIED"] : ["ZERO_DISCOUNT"], promotionId: promotion.id ?? null };
}
