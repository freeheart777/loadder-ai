const ALLOWED_FIELD_TYPES = new Set([
  "string",
  "text",
  "integer",
  "decimal",
  "boolean",
  "date",
  "datetime",
  "email",
  "phone",
  "url",
  "money",
  "enum",
  "reference",
  "json",
]);

const ALLOWED_RELATION_TYPES = new Set([
  "one-to-one",
  "one-to-many",
  "many-to-one",
  "many-to-many",
]);

export class LoadderAppSchemaError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = "LoadderAppSchemaError";
    this.code = "LOADDER_APP_SCHEMA_INVALID";
    this.details = details;
  }
}

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
const uniqueBy = (items, selector) => new Set(items.map(selector)).size === items.length;

export function validateLoadderAppDefinition(definition) {
  const errors = [];

  if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
    throw new LoadderAppSchemaError("Application definition must be an object.", ["definition"]);
  }

  if (definition.schemaVersion !== "1.0") errors.push("schemaVersion must be 1.0");
  if (!isNonEmptyString(definition.id)) errors.push("id is required");
  if (!isNonEmptyString(definition.name)) errors.push("name is required");
  if (!isNonEmptyString(definition.vertical)) errors.push("vertical is required");

  const entities = Array.isArray(definition.entities) ? definition.entities : [];
  if (!entities.length) errors.push("at least one entity is required");
  if (!uniqueBy(entities, (entity) => entity.id)) errors.push("entity ids must be unique");

  const entityIds = new Set(entities.map((entity) => entity.id));
  for (const entity of entities) {
    if (!isNonEmptyString(entity.id)) errors.push("every entity requires an id");
    if (!isNonEmptyString(entity.name)) errors.push(`entity ${entity.id || "unknown"} requires a name`);
    if (!Array.isArray(entity.fields)) errors.push(`entity ${entity.id || "unknown"} requires fields`);

    for (const field of entity.fields || []) {
      if (!isNonEmptyString(field.id)) errors.push(`entity ${entity.id}: field id is required`);
      if (!ALLOWED_FIELD_TYPES.has(field.type)) errors.push(`entity ${entity.id}: unsupported field type ${field.type}`);
      if (field.type === "reference" && !entityIds.has(field.references)) {
        errors.push(`entity ${entity.id}: reference field ${field.id} targets unknown entity ${field.references}`);
      }
    }
  }

  const relationships = Array.isArray(definition.relationships) ? definition.relationships : [];
  for (const relationship of relationships) {
    if (!entityIds.has(relationship.from)) errors.push(`relationship ${relationship.id}: unknown source ${relationship.from}`);
    if (!entityIds.has(relationship.to)) errors.push(`relationship ${relationship.id}: unknown target ${relationship.to}`);
    if (!ALLOWED_RELATION_TYPES.has(relationship.type)) errors.push(`relationship ${relationship.id}: unsupported type ${relationship.type}`);
  }

  const roles = Array.isArray(definition.roles) ? definition.roles : [];
  if (!roles.some((role) => role.id === "admin")) errors.push("an admin role is required");
  if (!uniqueBy(roles, (role) => role.id)) errors.push("role ids must be unique");

  const workflows = Array.isArray(definition.workflows) ? definition.workflows : [];
  for (const workflow of workflows) {
    if (!isNonEmptyString(workflow.id)) errors.push("every workflow requires an id");
    if (!Array.isArray(workflow.steps) || workflow.steps.length === 0) {
      errors.push(`workflow ${workflow.id || "unknown"} requires at least one step`);
    }
  }

  if (errors.length) {
    throw new LoadderAppSchemaError("Loadder application definition failed validation.", errors);
  }

  return Object.freeze(structuredClone(definition));
}

export function createLoadderAppDefinition(input) {
  return validateLoadderAppDefinition({
    schemaVersion: "1.0",
    id: input.id,
    name: input.name,
    vertical: input.vertical,
    description: input.description || "",
    locale: input.locale || "fa-IR",
    entities: input.entities || [],
    relationships: input.relationships || [],
    roles: input.roles || [],
    permissions: input.permissions || [],
    workflows: input.workflows || [],
    pages: input.pages || [],
    agents: input.agents || [],
    integrations: input.integrations || [],
    automations: input.automations || [],
    deployment: {
      targets: input.deployment?.targets || ["web"],
      provider: input.deployment?.provider || "loadder",
    },
    ownership: {
      runtimeContract: "loadder-runtime/v1",
      sourceOfTruth: "loadder-app-definition",
      providerIndependent: true,
    },
  });
}
