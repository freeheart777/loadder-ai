import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertLoadderCoreOwnership, LOADDER_CORE_POLICY } from "../app/business-builder/ownership-boundary.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const coreDir = path.resolve(here, "../app/business-builder");

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

test("business-builder core currently contains no forbidden vendor coupling", () => {
  for (const name of fs.readdirSync(coreDir).filter((file) => file.endsWith(".mjs") && file !== "ownership-boundary.mjs")) {
    const source = fs.readFileSync(path.join(coreDir, name), "utf8");
    assert.equal(assertLoadderCoreOwnership({ moduleName: name, moduleSource: source }), true);
  }
});
