import { validateLoadderAppDefinition } from "./loadder-app-schema.mjs";

const titleCase = (value) => String(value || "")
  .replace(/[-_]+/g, " ")
  .replace(/\b\w/g, (char) => char.toUpperCase());

const visibleFields = (entity) => (entity.fields || []).filter((field) => field.hidden !== true);

function fieldComponent(field) {
  const mapping = {
    text: "textarea",
    boolean: "switch",
    date: "date-picker",
    datetime: "datetime-picker",
    enum: "select",
    reference: "relation-select",
    money: "money-input",
    decimal: "number-input",
    integer: "number-input",
    email: "email-input",
    phone: "phone-input",
    url: "url-input",
    json: "json-editor",
  };
  return mapping[field.type] || "text-input";
}

function buildEntityViews(entity) {
  const fields = visibleFields(entity);
  const columns = fields.slice(0, 6).map((field) => ({
    id: field.id,
    label: field.name || titleCase(field.id),
    type: field.type,
  }));

  return [
    {
      id: `${entity.id}-list`,
      type: "resource-list",
      route: `/${entity.id}`,
      title: entity.pluralName || `${entity.name}s`,
      resource: entity.id,
      blocks: [
        { type: "page-header", title: entity.pluralName || `${entity.name}s`, primaryAction: { type: "navigate", to: `/${entity.id}/new`, label: `New ${entity.name}` } },
        { type: "data-table", resource: entity.id, columns, searchable: true, sortable: true, paginated: true },
      ],
    },
    {
      id: `${entity.id}-create`,
      type: "resource-form",
      route: `/${entity.id}/new`,
      title: `New ${entity.name}`,
      resource: entity.id,
      blocks: [{
        type: "form",
        mode: "create",
        resource: entity.id,
        fields: fields.map((field) => ({ id: field.id, label: field.name || titleCase(field.id), component: fieldComponent(field), required: field.required === true, references: field.references })),
      }],
    },
    {
      id: `${entity.id}-detail`,
      type: "resource-detail",
      route: `/${entity.id}/:id`,
      title: entity.name,
      resource: entity.id,
      blocks: [
        { type: "record-summary", resource: entity.id, fields: fields.slice(0, 8).map((field) => field.id) },
        { type: "related-records", resource: entity.id },
      ],
    },
  ];
}

function buildDashboard(definition) {
  const entities = definition.entities || [];
  const primary = entities.slice(0, 4);
  return {
    id: "dashboard",
    type: "dashboard",
    route: "/",
    title: definition.name,
    blocks: [
      { type: "hero-summary", title: definition.name, subtitle: definition.description || definition.vertical },
      { type: "metric-grid", metrics: primary.map((entity) => ({ id: `count-${entity.id}`, label: entity.pluralName || `${entity.name}s`, resource: entity.id, aggregate: "count" })) },
      { type: "activity-feed", scope: "application", limit: 12 },
      { type: "copilot-panel", agent: definition.agents?.[0]?.id || "business-copilot" },
    ],
  };
}

export function renderLoadderApp(definition) {
  const valid = validateLoadderAppDefinition(definition);
  const entityViews = valid.entities.flatMap(buildEntityViews);
  const declaredPageIds = new Set((valid.pages || []).map((page) => page.id));
  const views = [buildDashboard(valid), ...entityViews];

  return Object.freeze({
    renderContract: "loadder.ui.v1",
    appId: valid.id,
    locale: valid.locale,
    direction: String(valid.locale || "").toLowerCase().startsWith("fa") ? "rtl" : "ltr",
    navigation: [
      { id: "dashboard", label: "Dashboard", route: "/", icon: "squares-four" },
      ...valid.entities.map((entity) => ({ id: entity.id, label: entity.pluralName || `${entity.name}s`, route: `/${entity.id}`, icon: entity.icon || "database" })),
    ],
    views,
    declaredPages: [...declaredPageIds],
    theme: {
      density: "comfortable",
      radius: "medium",
      shell: "loadder-business",
    },
  });
}

export class LoadderUIAdapter {
  render() {
    throw new Error("render() not implemented");
  }
}
