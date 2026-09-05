import { validateLoadderAppDefinition } from "./loadder-app-schema.mjs";

export function exportLoadderApplication({ project, version }) {
  if (!project || !version) throw new TypeError("project and version are required");
  const definition = validateLoadderAppDefinition(version.definition);
  return Object.freeze({
    contract: "loadder.application-export.v1",
    exportedAt: new Date().toISOString(),
    project: { name: project.name, intent: project.intent, locale: project.locale },
    version: { versionNumber: version.versionNumber },
    definition,
    ui: version.ui,
    bundle: version.bundle,
    portability: {
      providerIndependent: definition.ownership?.providerIndependent === true,
      runtimeContract: definition.ownership?.runtimeContract,
      sourceOfTruth: definition.ownership?.sourceOfTruth,
    },
  });
}

export function importLoadderApplication(payload) {
  if (payload?.contract !== "loadder.application-export.v1") {
    const error = new Error("Unsupported Loadder export contract.");
    error.code = "LOADDER_EXPORT_UNSUPPORTED";
    throw error;
  }
  const definition = validateLoadderAppDefinition(payload.definition);
  if (definition.ownership?.providerIndependent !== true) {
    const error = new Error("Imported application is not provider independent.");
    error.code = "LOADDER_IMPORT_OWNERSHIP_INVALID";
    throw error;
  }
  return Object.freeze({
    project: { name: payload.project?.name || definition.name, intent: payload.project?.intent || definition.description || "Imported Loadder application", locale: payload.project?.locale || definition.locale || "fa-IR" },
    version: { definition, ui: payload.ui, bundle: payload.bundle },
  });
}
