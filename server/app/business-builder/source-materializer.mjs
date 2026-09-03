import { validateLoadderAppDefinition } from "./loadder-app-schema.mjs";

const stableJson = (value) => JSON.stringify(value, null, 2);

function createManifest(definition, ui) {
  return {
    contract: "loadder.bundle.v1",
    appId: definition.id,
    name: definition.name,
    vertical: definition.vertical,
    locale: definition.locale,
    uiContract: ui.renderContract,
    entry: "app.definition.json",
    ownership: definition.ownership,
    generatedBy: "loadder-business-builder",
  };
}

export function materializeLoadderSourceBundle({ definition, ui }) {
  const valid = validateLoadderAppDefinition(definition);
  if (!ui || ui.appId !== valid.id || ui.renderContract !== "loadder.ui.v1") {
    throw new Error("UI contract does not match the Loadder application definition.");
  }

  const manifest = createManifest(valid, ui);
  const files = [
    { path: "loadder.manifest.json", content: stableJson(manifest), mediaType: "application/json" },
    { path: "app.definition.json", content: stableJson(valid), mediaType: "application/json" },
    { path: "ui.definition.json", content: stableJson(ui), mediaType: "application/json" },
    { path: "README.md", content: `# ${valid.name}\n\nGenerated from Loadder-owned contracts.\n\n- App contract: ${valid.schemaVersion}\n- UI contract: ${ui.renderContract}\n- Runtime: ${valid.ownership.runtimeContract}\n`, mediaType: "text/markdown" },
  ];

  const byteSize = files.reduce((total, file) => total + Buffer.byteLength(file.content, "utf8"), 0);
  return Object.freeze({
    contract: "loadder.source-bundle.v1",
    appId: valid.id,
    manifest,
    files,
    metrics: { fileCount: files.length, byteSize },
    portable: true,
    externalRuntimeRequired: false,
  });
}
