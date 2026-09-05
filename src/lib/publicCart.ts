type Cart = { id?: string; items?: Array<{ variantId: string }> };
type CartResponse = { cart?: Cart; code?: string; message?: string };

const RECOVERABLE_STALE_CART_CODES = new Set(["CART_NOT_FOUND", "CART_NOT_ACTIVE"]);

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
  const key = `loadder-public-cart:${siteProjectId}`;
  let cartId = localStorage.getItem(key) || "";
  const create = async () => {
    const data = await readPublicCartResponse(
      await fetch(`/api/auth/storefront/${siteProjectId}/carts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency }),
      }),
    );
    const id = data.cart?.id;
    if (!id) throw new Error("سبد خرید ساخته نشد.");
    localStorage.setItem(key, id);
    return id;
  };
  const add = async (id: string) => {
    const data = await readPublicCartResponse(
      await fetch(`/api/auth/storefront/carts/${id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId, quantity }),
      }),
    );
    if (!data.cart?.items?.some((item) => item.variantId === variantId)) {
      throw new Error("محصول در سبد ثبت نشد.");
    }
    return data.cart;
  };

  if (!cartId) cartId = await create();
  try {
    return await add(cartId);
  } catch (error) {
    if (!isRecoverableStaleCartError(error)) throw error;
    localStorage.removeItem(key);
    cartId = await create();
    return add(cartId);
  }
}
