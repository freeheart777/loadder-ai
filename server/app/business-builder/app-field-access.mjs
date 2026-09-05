import { canAppAccess, validateAppAccessPolicy } from "./app-access-policy.mjs";

const SYSTEM_FIELDS = new Set(["id", "createdAt", "updatedAt"]);

function entityFor(definition, resource) {
  return (definition?.entities || []).find((entity) => entity.id === resource) || null;
}

export function appFieldAccess({ definition, role = "public", resource, action = "read" }) {
  const entity = entityFor(definition, resource);
  if (!entity) return { resource, action, allowed: false, fields: new Set(), systemFields: new Set(SYSTEM_FIELDS) };
  if (!definition?.accessPolicy) {
    return { resource, action, allowed: true, fields: new Set((entity.fields || []).map((field) => field.id)), systemFields: new Set(SYSTEM_FIELDS) };
  }
  const policy = validateAppAccessPolicy(definition.accessPolicy);
  const allowed = canAppAccess(policy, { role, resource, action });
  const fields = new Set((entity.fields || []).filter((field) => canAppAccess(policy, { role, resource, action, field: field.id })).map((field) => field.id));
  return { resource, action, allowed, fields, systemFields: new Set(SYSTEM_FIELDS) };
}

export function redactAppRecord(record, access) {
  if (record == null || typeof record !== "object" || Array.isArray(record)) return record;
  const output = {};
  for (const [key, value] of Object.entries(record)) {
    if (access.systemFields.has(key) || access.fields.has(key)) output[key] = value;
  }
  return output;
}

export function redactAppRecords(records, access) {
  return Array.isArray(records) ? records.map((record) => redactAppRecord(record, access)) : [];
}

export function assertAppPayloadFields(payload, access) {
  const data = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const forbidden = Object.keys(data).filter((key) => !access.fields.has(key));
  if (forbidden.length) {
    const error = new Error(`App role cannot write fields: ${forbidden.join(", ")}`);
    error.code = "APP_FIELD_ACCESS_FORBIDDEN";
    error.fields = forbidden;
    throw error;
  }
  return data;
}

export function filterDefinitionForRole(definition, role = "public") {
  if (!definition?.accessPolicy) return structuredClone(definition);
  const next = structuredClone(definition);
  next.entities = (next.entities || []).flatMap((entity) => {
    const access = appFieldAccess({ definition, role, resource: entity.id, action: "read" });
    if (!access.allowed) return [];
    return [{ ...entity, fields: (entity.fields || []).filter((field) => access.fields.has(field.id)) }];
  });
  const entityIds = new Set(next.entities.map((entity) => entity.id));
  next.relationships = (next.relationships || []).filter((relationship) => entityIds.has(relationship.from) && entityIds.has(relationship.to));
  next.pages = (next.pages || []).filter((page) => !page.entityId || entityIds.has(page.entityId));
  return next;
}

function filterBlock(block, allowedFields) {
  const next = structuredClone(block);
  if (Array.isArray(next.columns)) next.columns = next.columns.filter((column) => !column?.id || allowedFields.has(column.id));
  if (Array.isArray(next.fields)) {
    next.fields = next.fields.filter((field) => {
      const id = typeof field === "string" ? field : field?.id;
      return !id || allowedFields.has(id);
    });
  }
  return next;
}

export function filterUiForRole(ui, definition, role = "public") {
  if (!ui) return ui;
  if (!definition?.accessPolicy) return structuredClone(ui);
  const next = structuredClone(ui);
  const entityAccess = new Map((definition.entities || []).map((entity) => [entity.id, appFieldAccess({ definition, role, resource: entity.id, action: "read" })]));
  const allowedResources = new Set([...entityAccess.entries()].filter(([, access]) => access.allowed).map(([id]) => id));
  next.navigation = (next.navigation || []).filter((item) => item.id === "dashboard" || !item.id || allowedResources.has(item.id));
  next.views = (next.views || []).flatMap((view) => {
    if (view.resource && !allowedResources.has(view.resource)) return [];
    const access = view.resource ? entityAccess.get(view.resource) : null;
    const blocks = (view.blocks || []).flatMap((block) => {
      if (block.resource && !allowedResources.has(block.resource)) return [];
      const blockAccess = block.resource ? entityAccess.get(block.resource) : access;
      return [filterBlock(block, blockAccess?.fields || new Set())];
    });
    return [{ ...view, blocks }];
  });
  return next;
}
