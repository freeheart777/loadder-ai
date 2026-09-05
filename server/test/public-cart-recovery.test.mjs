import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { transpileModule, ModuleKind, ScriptTarget } from "typescript";

const helperPath = new URL("../../src/lib/publicCart.ts", import.meta.url);
const helperSource = await readFile(helperPath, "utf8");
const helperJavaScript = transpileModule(helperSource, {
  compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2023 },
}).outputText;
const helper = await import(`data:text/javascript;base64,${Buffer.from(helperJavaScript).toString("base64")}`);

const jsonResponse = (status, payload) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });

function storageWith(entries = {}) {
  const values = new Map(Object.entries(entries));
  const removed = [];
  const written = [];
  return {
    removed,
    written,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, String(value));
      written.push([key, String(value)]);
    },
    removeItem: (key) => {
      values.delete(key);
      removed.push(key);
    },
  };
}

async function withRuntime({ storage, responses }, operation) {
  const previousStorage = globalThis.localStorage;
  const previousFetch = globalThis.fetch;
  const calls = [];
  globalThis.localStorage = storage;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || "GET", body: init.body });
    const next = responses.shift();
    if (next instanceof Error) throw next;
    if (!next) throw new Error("Unexpected fetch");
    return next;
  };
  try {
    return { value: await operation(), calls };
  } catch (error) {
    error.testCalls = calls;
    throw error;
  } finally {
    globalThis.localStorage = previousStorage;
    globalThis.fetch = previousFetch;
  }
}

test("public cart stale recovery policy", async (t) => {
  const key = "loadder-public-cart:store-1";

  await t.test("missing and inactive carts recover exactly once and persist the replacement", async () => {
    for (const [status, code] of [[404, "CART_NOT_FOUND"], [409, "CART_NOT_ACTIVE"]]) {
      const storage = storageWith({ [key]: "cart-stale" });
      const result = await withRuntime({
        storage,
        responses: [
          jsonResponse(status, { success: false, code, message: "stale" }),
          jsonResponse(201, { success: true, cart: { id: "cart-new", items: [] } }),
          jsonResponse(201, { success: true, cart: { id: "cart-new", items: [{ variantId: "v1" }] } }),
        ],
      }, () => helper.addPublicCartItem("store-1", "IRT", "v1", 1));

      assert.equal(result.calls.length, 3);
      assert.deepEqual(storage.removed, [key]);
      assert.deepEqual(storage.written, [[key, "cart-new"]]);
      assert.equal(storage.getItem(key), "cart-new");
      assert.equal(result.value.items.length, 1);
    }
  });

  await t.test("domain authorization validation server and unknown errors never recreate", async () => {
    const cases = [
      [409, "INSUFFICIENT_INVENTORY"],
      [400, "INVALID_QUANTITY"],
      [404, "VARIANT_NOT_AVAILABLE"],
      [409, "CROSS_STORE_VARIANT"],
      [409, "CURRENCY_MISMATCH"],
      [401, "AUTHENTICATION_REQUIRED"],
      [403, "FORBIDDEN"],
      [403, "WORKSPACE_MISMATCH"],
      [500, "ECOMMERCE_INTERNAL_ERROR"],
      [404, "UNKNOWN_CART_ERROR"],
    ];
    for (const [status, code] of cases) {
      const storage = storageWith({ [key]: "cart-existing" });
      const response = jsonResponse(status, { success: false, code, message: code });
      await assert.rejects(async () => {
        await withRuntime({ storage, responses: [response] }, () =>
          helper.addPublicCartItem("store-1", "IRT", "v1", 1));
      }, (error) => error.code === code && error.status === status && error.testCalls.length === 1);
      assert.equal(storage.getItem(key), "cart-existing");
      assert.deepEqual(storage.removed, []);
    }
  });

  await t.test("network and malformed error responses fail closed", async () => {
    for (const failure of [
      new TypeError("fetch failed"),
      new Response("not-json", { status: 502 }),
    ]) {
      const storage = storageWith({ [key]: "cart-existing" });
      await assert.rejects(() => withRuntime({ storage, responses: [failure] }, () =>
        helper.addPublicCartItem("store-1", "IRT", "v1", 1)));
      assert.equal(storage.getItem(key), "cart-existing");
      assert.deepEqual(storage.removed, []);
    }
  });

  await t.test("a retry failure propagates without a second recovery loop", async () => {
    const storage = storageWith({ [key]: "cart-stale" });
    await assert.rejects(
      () => withRuntime({
          storage,
          responses: [
            jsonResponse(404, { code: "CART_NOT_FOUND", message: "missing" }),
            jsonResponse(201, { cart: { id: "cart-new", items: [] } }),
            jsonResponse(409, { code: "INSUFFICIENT_INVENTORY", message: "inventory" }),
          ],
        }, () => helper.addPublicCartItem("store-1", "IRT", "v1", 1)),
      (error) => error.code === "INSUFFICIENT_INVENTORY" && error.testCalls.length === 3,
    );
    assert.equal(storage.getItem(key), "cart-new");
    assert.equal(storage.written.length, 1);
  });

  await t.test("successful add is issued once and response verification cannot trigger recovery", async () => {
    const storage = storageWith({ [key]: "cart-existing" });
    const success = await withRuntime({
      storage,
      responses: [jsonResponse(201, { cart: { id: "cart-existing", items: [{ variantId: "v1" }] } })],
    }, () => helper.addPublicCartItem("store-1", "IRT", "v1", 1));
    assert.equal(success.calls.length, 1);
    assert.equal(storage.written.length, 0);

    await assert.rejects(() => withRuntime({
      storage,
      responses: [jsonResponse(201, { cart: { id: "cart-existing", items: [] } })],
    }, () => helper.addPublicCartItem("store-1", "IRT", "v1", 1)), /محصول در سبد ثبت نشد/);
    assert.equal(storage.getItem(key), "cart-existing");
  });
});

test("public cart routes preserve machine-readable stale and variant codes", async () => {
  const source = await readFile(new URL("../app/routes/auth.mjs", import.meta.url), "utf8");
  assert.match(source, /code:"CART_NOT_FOUND"/);
  assert.match(source, /code:"VARIANT_NOT_AVAILABLE"/);
});

test("cart load clears only proven stale references and item updates never recreate carts", async () => {
  const source = await readFile(new URL("../../src/pages/PublicCartPage.tsx", import.meta.url), "utf8");
  assert.match(source, /if \(isRecoverableStaleCartError\(error\)\) localStorage\.removeItem\(key\)/);
  assert.match(source, /method: "PUT"/);
  assert.doesNotMatch(source, /storefront\/\$\{siteProjectId\}\/carts/);
});
