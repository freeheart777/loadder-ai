import { createLandingComponentRegistry, landingComponentRegistry } from "../landing/landing-component-registry.mjs";

const commerceEntries = [
  ["PRODUCT_GRID", ["GRID", "FEATURED"], ["heading", "catalogId", "categoryId", "collectionId"]],
  ["CATEGORY_GRID", ["GRID", "VISUAL"], ["heading", "catalogId"]],
  ["PRODUCT_CARD", ["STANDARD", "COMPACT"], ["productId"]],
  ["PRODUCT_GALLERY", ["STANDARD", "FASHION"], ["productId"]],
  ["PRODUCT_INFO", ["STANDARD", "TECHNICAL"], ["productId"]],
  ["VARIANT_SELECTOR", ["BUTTONS", "SELECT"], ["productId"]],
  ["PRICE_BLOCK", ["STANDARD", "SALE"], ["productId"]],
  ["SPECIFICATION_TABLE", ["TABLE", "GROUPED"], ["productId"]],
  ["RELATED_PRODUCTS", ["GRID", "RAIL"], ["productId", "catalogId"]],
  ["COLLECTION_RAIL", ["RAIL", "GRID"], ["catalogId", "collectionId"]],
  ["COMMERCE_TRUST", ["FACTS", "SUMMARY"], ["productId"]],
].map(([componentId, variants, contentRoles]) => Object.freeze({
  componentId,
  version: 1,
  variants: Object.freeze(variants),
  contentRoles: Object.freeze(contentRoles),
  assetRoles: Object.freeze([]),
  trackingActions: Object.freeze(["CTA_CLICK"]),
  accessibility: Object.freeze({ requiresHeading: false, semanticRegion: true }),
  bounds: Object.freeze({ maxItems: 24, maxTextLength: 500 }),
}));

export const storefrontComponentRegistry = createLandingComponentRegistry([
  ...landingComponentRegistry.list(),
  ...commerceEntries,
]);

export const STOREFRONT_COMPONENT_IDS = Object.freeze(commerceEntries.map((entry) => entry.componentId));
