import test from "node:test";
import assert from "node:assert/strict";
import { assertLoadderCoreOwnership, LOADDER_CORE_POLICY } from "../app/business-builder/ownership-boundary.mjs";

test("owned core accepts provider-neutral modules", () => {
  assert.equal(assertLoadderCoreOwnership({ moduleName: "compiler", moduleSource: "export function compile() { return 'loadder'; }" }), true);
});

test("owned core rejects vendor coupling", () => {
  for (const vendor of LOADDER_CORE_POLICY.forbiddenCoreVendors) {
    assert.throws(
      () => assertLoadderCoreOwnership({ moduleName: "core", moduleSource: `import x from '${vendor}'` }),
      (error) => error?.code === "LOADDER_CORE_OWNERSHIP_VIOLATION",
    );
  }
});
