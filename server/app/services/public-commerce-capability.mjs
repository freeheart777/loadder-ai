import crypto from "node:crypto";

export const CART_CAPABILITY_HEADER = "x-loadder-cart-capability";
export const ORDER_CAPABILITY_HEADER = "x-loadder-order-capability";

export function createPublicCapability() {
  const value = crypto.randomBytes(32).toString("base64url");
  return Object.freeze({ value, hash: hashPublicCapability(value) });
}

export function hashPublicCapability(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

export function matchesPublicCapability(value, expectedHash) {
  if (typeof value !== "string" || !value || typeof expectedHash !== "string" || !/^[a-f0-9]{64}$/i.test(expectedHash)) return false;
  const actual = Buffer.from(hashPublicCapability(value), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
