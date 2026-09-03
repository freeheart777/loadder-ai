import { createLoadderAppDefinition } from "./loadder-app-schema.mjs";
import { BUSINESS_BLUEPRINTS, rankBlueprints } from "./business-blueprints.mjs";

const slugify = (value) => String(value || "loadder-app")
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9\u0600-\u06ff]+/g, "-")
  .replace(/^-+|-+$/g, "") || "loadder-app";

const clone = (value) => structuredClone(value);

function mergeBlueprints(blueprints) {
  const entities = new Map();
  const relationships = new Map();
  const roles = new Set(["admin"]);
  const workflows = new Set();
  const pages = new Set(["dashboard"]);

  for (const blueprint of blueprints) {
    for (const entity of blueprint.entities) {
      if (!entities.has(entity.id)) entities.set(entity.id, clone(entity));
    }
    for (const relationship of blueprint.relationships) relationships.set(relationship.id, clone(relationship));
    for (const role of blueprint.roles) roles.add(role);
    for (const workflow of blueprint.workflows) workflows.add(workflow);
    for (const page of blueprint.pages) pages.add(page);
  }

  return { entities, relationships, roles, workflows, pages };
}

function roleDefinition(id) {
  return {
    id,
    name: id.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "),
    system: id === "admin",
  };
}

function workflowDefinition(id) {
  return {
    id,
    name: id.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "),
    steps: [{ id: "start", type: "trigger" }, { id: "complete", type: "action" }],
  };
}

function inferVertical(intent, selectedBlueprints) {
  const text = String(intent).toLowerCase();
  const verticals = [
    ["logistics", ["logistics", "shipment", "fleet", "لجستیک", "حمل", "محموله"]],
    ["retail", ["retail", "shop", "store", "فروشگاه"]],
    ["healthcare", ["clinic", "medical", "doctor", "کلینیک", "پزشک"]],
    ["real-estate", ["real estate", "property", "املاک", "ملک"]],
    ["agency", ["agency", "campaign", "آژانس", "کمپین"]],
  ];
  const match = verticals.find(([, keywords]) => keywords.some((keyword) => text.includes(keyword)));
  if (match) return match[0];
  return selectedBlueprints.length === 1 ? selectedBlueprints[0].id : "business-operations";
}

export class LoadderBusinessCompiler {
  constructor({ blueprintCatalog = BUSINESS_BLUEPRINTS } = {}) {
    this.blueprintCatalog = blueprintCatalog;
  }

  analyze({ intent, name, locale = "fa-IR" }) {
    if (!intent || !String(intent).trim()) throw new Error("Business intent is required.");

    const ranked = rankBlueprints(intent);
    const selectedBlueprints = ranked.length
      ? ranked.slice(0, 3).map((item) => this.blueprintCatalog[item.blueprint.id]).filter(Boolean)
      : [this.blueprintCatalog.crm];

    const merged = mergeBlueprints(selectedBlueprints);
    const vertical = inferVertical(intent, selectedBlueprints);
    const appName = name?.trim() || `${vertical.replace(/-/g, " ")} workspace`;

    return {
      intent: String(intent).trim(),
      appName,
      locale,
      vertical,
      selectedBlueprints: selectedBlueprints.map((blueprint) => blueprint.id),
      confidence: ranked.length ? Math.min(0.95, 0.55 + ranked[0].score * 0.1) : 0.4,
      merged,
    };
  }

  compile(input) {
    const analysis = this.analyze(input);
    const { merged } = analysis;

    return createLoadderAppDefinition({
      id: slugify(input.id || analysis.appName),
      name: analysis.appName,
      description: analysis.intent,
      vertical: analysis.vertical,
      locale: analysis.locale,
      entities: [...merged.entities.values()],
      relationships: [...merged.relationships.values()],
      roles: [...merged.roles].map(roleDefinition),
      permissions: [{ id: "admin-full-access", role: "admin", resource: "*", actions: ["*"] }],
      workflows: [...merged.workflows].map(workflowDefinition),
      pages: [...merged.pages].map((id) => ({ id, name: id.replace(/_/g, " "), generated: true })),
      agents: [{ id: "business-copilot", type: "assistant", scope: "application", provider: "loadder-ai-gateway" }],
      integrations: [],
      automations: [],
      deployment: { targets: ["web", "pwa"], provider: "loadder" },
    });
  }
}

export const loadderBusinessCompiler = new LoadderBusinessCompiler();
