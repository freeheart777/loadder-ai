const text = (value, field, { max = 200, nullable = false } = {}) => {
  if (value == null || value === "") {
    if (nullable) return null;
    throw new TypeError(`${field} is required`);
  }
  const out = String(value).trim();
  if (!out && !nullable) throw new TypeError(`${field} is required`);
  if (out.length > max) throw new RangeError(`${field} is too long`);
  return out || null;
};

const int = (value, field, { min = 0, nullable = false } = {}) => {
  if (value == null && nullable) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min) throw new TypeError(`${field} must be an integer >= ${min}`);
  return n;
};

const slugify = (value) => String(value || "")
  .trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);

const clone = (value) => structuredClone(value);

export function createProduct(input = {}) {
  const id = text(input.id, "product.id");
  const workspaceId = text(input.workspaceId, "product.workspaceId");
  const storeId = text(input.storeId, "product.storeId");
  const name = text(input.name, "product.name", { max: 300 });
  const slug = slugify(input.slug || name);
  if (!slug) throw new TypeError("product.slug is required");
  return Object.freeze({
    id, workspaceId, storeId, name, slug,
    description: text(input.description, "product.description", { max: 20000, nullable: true }) || "",
    category: text(input.category, "product.category", { max: 200, nullable: true }),
    brand: text(input.brand, "product.brand", { max: 200, nullable: true }),
    status: ["DRAFT", "ACTIVE", "ARCHIVED"].includes(input.status) ? input.status : "DRAFT",
    featured: Boolean(input.featured),
    metadata: Object.freeze(clone(input.metadata && typeof input.metadata === "object" ? input.metadata : {})),
  });
}

export function createVariant(input = {}) {
  const id = text(input.id, "variant.id");
  const workspaceId = text(input.workspaceId, "variant.workspaceId");
  const storeId = text(input.storeId, "variant.storeId");
  const productId = text(input.productId, "variant.productId");
  const sku = text(input.sku, "variant.sku", { max: 160 });
  return Object.freeze({
    id, workspaceId, storeId, productId, sku,
    title: text(input.title || "Default", "variant.title", { max: 300 }),
    priceMinor: int(input.priceMinor, "variant.priceMinor", { min: 0, nullable: true }),
    inventoryPolicy: input.inventoryPolicy === "ALLOW" ? "ALLOW" : "DENY",
    active: input.active !== false,
    options: Object.freeze(clone(input.options && typeof input.options === "object" ? input.options : {})),
    metadata: Object.freeze(clone(input.metadata && typeof input.metadata === "object" ? input.metadata : {})),
  });
}

export function assertVariantBelongsToProduct(product, variant) {
  if (product.workspaceId !== variant.workspaceId || product.storeId !== variant.storeId || product.id !== variant.productId) {
    throw new Error("CROSS_TENANT_OR_PRODUCT_VARIANT");
  }
  return true;
}

export function canSellVariant(product, variant) {
  assertVariantBelongsToProduct(product, variant);
  return product.status === "ACTIVE" && variant.active === true;
}

export function mergeProduct(product, patch = {}) {
  return createProduct({ ...product, ...clone(patch), id: product.id, workspaceId: product.workspaceId, storeId: product.storeId });
}

export function mergeVariant(variant, patch = {}) {
  return createVariant({ ...variant, ...clone(patch), id: variant.id, workspaceId: variant.workspaceId, storeId: variant.storeId, productId: variant.productId });
}
