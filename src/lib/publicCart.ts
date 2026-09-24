type Cart = { id?: string; items?: Array<{ variantId: string; quantity?: number }> };
type CartResponse = { cart?: Cart; code?: string; message?: string };
export type PublicCartReference = { id: string; capability: string };
export type PublicOrderReference = { id: string; capability: string };

export type PublicCartItem = { id: string; productId: string; variantId: string; productName: string; sku: string; variantTitle: string; quantity: number; unitPriceMinor: number; lineTotalMinor: number };
export type PublicCart = { id: string; siteProjectId: string; currency: string; status: string; couponCode: string | null; subtotalMinor: number; discountMinor: number; shippingMinor: number; totalMinor: number; items: PublicCartItem[]; createdAt: string; updatedAt: string };
export type PublicShippingAddress = { province?: string; city?: string; address?: string; postalCode?: string; notes?: string };
export type PublicCheckoutInput = { fullName: string; phone: string; email?: string; shippingAddress?: PublicShippingAddress };
export type PublicOrder = { id: string; siteProjectId: string; currency: string; status: string; paymentStatus: string; fulfillmentStatus: string; subtotalMinor: number; discountMinor: number; shippingMinor: number; totalMinor: number; items: PublicCartItem[]; createdAt: string };

export const cartStorageKey = (siteProjectId: string) => `loadder-public-cart:${siteProjectId}`;
export const orderStorageKey = (orderId: string) => `loadder-public-order:${orderId}`;

export function readPublicCartReference(siteProjectId: string): PublicCartReference | null {
  const raw = localStorage.getItem(cartStorageKey(siteProjectId));
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as PublicCartReference;
    return typeof value.id === "string" && typeof value.capability === "string" && value.id && value.capability ? value : null;
  } catch { return null; }
}

export function writePublicCartReference(siteProjectId: string, reference: PublicCartReference) {
  localStorage.setItem(cartStorageKey(siteProjectId), JSON.stringify(reference));
}

/** P0-2: the receipt capability a completed checkout returns, kept so the customer can
 *  look their own order up again later -- previously this token was read once and discarded. */
export function readPublicOrderReference(orderId: string): PublicOrderReference | null {
  const raw = localStorage.getItem(orderStorageKey(orderId));
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as PublicOrderReference;
    return typeof value.id === "string" && typeof value.capability === "string" && value.id && value.capability ? value : null;
  } catch { return null; }
}

export function writePublicOrderReference(reference: PublicOrderReference) {
  localStorage.setItem(orderStorageKey(reference.id), JSON.stringify(reference));
}

export function cartCapabilityHeaders(capability: string, json = false): HeadersInit {
  return { ...(json ? { "Content-Type": "application/json" } : {}), "X-Loadder-Cart-Capability": capability };
}

export function orderCapabilityHeaders(capability: string): HeadersInit {
  return { "X-Loadder-Order-Capability": capability };
}

const RECOVERABLE_STALE_CART_CODES = new Set(["CART_NOT_FOUND", "CART_NOT_ACTIVE", "PUBLIC_RESOURCE_NOT_FOUND"]);

export class PublicCartApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, { status, code }: { status: number; code?: string | null }) {
    super(message);
    this.name = "PublicCartApiError";
    this.status = status;
    this.code = code || null;
  }
}

export function isRecoverableStaleCartError(error: unknown) {
  return error instanceof PublicCartApiError &&
    error.code !== null &&
    RECOVERABLE_STALE_CART_CODES.has(error.code);
}

export async function readPublicCartResponse<T = CartResponse>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as CartResponse;
  if (!response.ok) {
    throw new PublicCartApiError(data.message || "خطا در سبد خرید", {
      status: response.status,
      code: data.code,
    });
  }
  return data as T;
}

export async function addPublicCartItem(
  siteProjectId: string,
  currency: string,
  variantId: string,
  quantity = 1,
) {
  const key = cartStorageKey(siteProjectId);
  let reference = readPublicCartReference(siteProjectId);
  const create = async () => {
    const data = await readPublicCartResponse(
      await fetch(`/api/auth/storefront/${siteProjectId}/carts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency }),
      }),
    );
    const id = data.cart?.id, capability = (data as CartResponse & { cartCapability?: string }).cartCapability;
    if (!id || !capability) throw new Error("سبد خرید ساخته نشد.");
    const created = { id, capability };
    writePublicCartReference(siteProjectId, created);
    return created;
  };
  const add = async ({ id, capability }: PublicCartReference) => {
    const data = await readPublicCartResponse(
      await fetch(`/api/auth/storefront/carts/${id}/items`, {
        method: "POST",
        headers: cartCapabilityHeaders(capability, true),
        body: JSON.stringify({ variantId, quantity }),
      }),
    );
    if (!data.cart?.items?.some((item) => item.variantId === variantId)) {
      throw new Error("محصول در سبد ثبت نشد.");
    }
    return data.cart;
  };

  if (!reference) reference = await create();
  try {
    return await add(reference);
  } catch (error) {
    if (!isRecoverableStaleCartError(error)) throw error;
    localStorage.removeItem(key);
    reference = await create();
    return add(reference);
  }
}

/** The real cart for this store, or null when nothing has been added yet. */
export async function getPublicCart(siteProjectId: string): Promise<PublicCart | null> {
  const reference = readPublicCartReference(siteProjectId);
  if (!reference) return null;
  try {
    const data = await readPublicCartResponse<{ cart?: PublicCart }>(
      await fetch(`/api/auth/storefront/carts/${reference.id}`, {
        headers: cartCapabilityHeaders(reference.capability),
      }),
    );
    return data.cart ?? null;
  } catch (error) {
    if (!isRecoverableStaleCartError(error)) throw error;
    localStorage.removeItem(cartStorageKey(siteProjectId));
    return null;
  }
}

/** Submits the real cart through the commerce checkout API and creates a real order. */
export async function checkoutPublicCart(
  siteProjectId: string,
  input: PublicCheckoutInput,
): Promise<{ order: PublicOrder; receiptCapability: string }> {
  const reference = readPublicCartReference(siteProjectId);
  if (!reference) throw new PublicCartApiError("سبد خرید یافت نشد.", { status: 404, code: "CART_NOT_FOUND" });
  const data = await readPublicCartResponse<{ order?: PublicOrder; receiptCapability?: string; payment?: { redirectUrl?: string } }>(
    await fetch(`/api/auth/storefront/carts/${reference.id}/checkout`, {
      method: "POST",
      headers: cartCapabilityHeaders(reference.capability, true),
      body: JSON.stringify({
        fullName: input.fullName,
        phone: input.phone,
        email: input.email || "",
        shippingAddress: input.shippingAddress || {},
      }),
    }),
  );
  if (!data.order || !data.receiptCapability) throw new Error("سفارش ثبت نشد.");
  // A completed checkout closes the cart server-side; the local reference to it is stale from here on.
  localStorage.removeItem(cartStorageKey(siteProjectId));
  // P0-2: preserve the receipt capability so this order can be looked up again later,
  // instead of it being read once from the response and discarded.
  writePublicOrderReference({ id: data.order.id, capability: data.receiptCapability });
  // Gate 3: a connected gateway takes over; the gateway callback returns the customer to order-success.
  if (data.payment?.redirectUrl) {
    window.location.assign(data.payment.redirectUrl);
    return new Promise(() => {}); // page is leaving; keep the caller from navigating first
  }
  return { order: data.order, receiptCapability: data.receiptCapability };
}

/** The real order for this receipt reference, or null if it can no longer be found. */
export async function getPublicOrder(orderId: string): Promise<PublicOrder | null> {
  const reference = readPublicOrderReference(orderId);
  if (!reference) return null;
  try {
    const data = await readPublicCartResponse<{ order?: PublicOrder }>(
      await fetch(`/api/auth/storefront/orders/${reference.id}`, {
        headers: orderCapabilityHeaders(reference.capability),
      }),
    );
    return data.order ?? null;
  } catch (error) {
    if (error instanceof PublicCartApiError && error.status === 404) return null;
    throw error;
  }
}
