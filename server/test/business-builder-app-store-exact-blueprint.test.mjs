import test from "node:test";
import assert from "node:assert/strict";
import { BUSINESS_BLUEPRINTS } from "../app/business-builder/business-blueprints.mjs";
import { loadderBusinessCompiler } from "../app/business-builder/business-compiler.mjs";
import { getLoadderAppStore, installBlueprint } from "../app/business-builder/app-store.mjs";

const ids = (items = []) => items.map((item) => item.id).sort();

test("every App Store entry installs exactly its declared blueprint with zero token cost", () => {
  const store = getLoadderAppStore();
  assert.deepEqual(store.map((item) => item.id).sort(), Object.keys(BUSINESS_BLUEPRINTS).sort());

  for (const item of store) {
    const blueprint = BUSINESS_BLUEPRINTS[item.id];
    const installed = installBlueprint({ blueprintId: item.id, compiler: loadderBusinessCompiler });
    assert.equal(installed.blueprintId, item.id);
    assert.equal(installed.tokenCost, 0);
    assert.equal(installed.definition.vertical, item.id);
    assert.deepEqual(ids(installed.definition.entities), ids(blueprint.entities), `${item.id}: entities must match exactly`);
    assert.deepEqual(ids(installed.definition.relationships), ids(blueprint.relationships), `${item.id}: relationships must match exactly`);
    assert.deepEqual(ids(installed.definition.workflows), [...blueprint.workflows].sort(), `${item.id}: workflows must match exactly`);
    const expectedRoles = [...new Set(["admin", ...blueprint.roles])].sort();
    assert.deepEqual(ids(installed.definition.roles), expectedRoles, `${item.id}: roles must match exactly`);
  }
});

test("legacy App Store install phrase also resolves to one exact blueprint instead of ranked merging", () => {
  for (const blueprint of Object.values(BUSINESS_BLUEPRINTS)) {
    const analysis = loadderBusinessCompiler.analyze({ intent: `یک ${blueprint.name} بساز`, name: blueprint.name });
    assert.equal(analysis.selectionMode, "exact-store-intent");
    assert.deepEqual(analysis.selectedBlueprints, [blueprint.id]);
  }
});
