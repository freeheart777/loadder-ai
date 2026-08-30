export type ProductMediaVariant = { imageUrl?: string | null };
export type ProductWithMedia = {
  metadata?: { gallery?: unknown } | null;
  gallery?: unknown;
  variants?: ProductMediaVariant[];
};

export function productGallery(product: ProductWithMedia | null | undefined) {
  const publicGallery = Array.isArray(product?.gallery) ? product.gallery : [];
  const metadataGallery = Array.isArray(product?.metadata?.gallery)
    ? product.metadata.gallery
    : [];
  const variantImages = (product?.variants || [])
    .map((variant) => variant.imageUrl)
    .filter(Boolean);
  return [
    ...new Set(
      [...publicGallery, ...metadataGallery, ...variantImages].filter(
        (value): value is string =>
          typeof value === "string" && value.length > 0,
      ),
    ),
  ];
}

export function productMainImage(product: ProductWithMedia | null | undefined) {
  return productGallery(product)[0] || "";
}

export function isSafeProductImageUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}
