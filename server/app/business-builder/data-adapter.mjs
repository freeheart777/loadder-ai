const ALLOWED_ACTIONS = new Set(["list", "get", "create", "update", "delete"]);

function assertEntity(definition, entityId) {
  const entity = definition?.entities?.find((item) => item.id === entityId);
  if (!entity) {
    const error = new Error(`Unknown entity: ${entityId}`);
    error.code = "LOADDER_ENTITY_NOT_FOUND";
    throw error;
  }
  return entity;
}

function assertPayload(entity, payload = {}) {
  const allowed = new Map((entity.fields || []).map((field) => [field.id, field]));
  for (const key of Object.keys(payload)) {
    if (!allowed.has(key)) {
      const error = new Error(`Unknown field ${key} for ${entity.id}`);
      error.code = "LOADDER_FIELD_NOT_ALLOWED";
      throw error;
    }
  }
  for (const field of entity.fields || []) {
    if (field.required && payload[field.id] == null) {
      const error = new Error(`Required field missing: ${field.id}`);
      error.code = "LOADDER_FIELD_REQUIRED";
      throw error;
    }
  }
}

export class LoadderDataAdapter {
  async list() { throw new Error("list() not implemented"); }
  async get() { throw new Error("get() not implemented"); }
  async create() { throw new Error("create() not implemented"); }
  async update() { throw new Error("update() not implemented"); }
  async delete() { throw new Error("delete() not implemented"); }
}

export class LoadderDataRuntime {
  constructor({ adapter, audit = () => {} }) {
    if (!adapter) throw new TypeError("data adapter is required");
    this.adapter = adapter;
    this.audit = audit;
  }

  async execute({ definition, action, entityId, recordId = null, payload = {}, query = {} }) {
    if (!ALLOWED_ACTIONS.has(action)) throw new Error(`Unsupported data action: ${action}`);
    const entity = assertEntity(definition, entityId);
    if (["create", "update"].includes(action)) assertPayload(entity, payload);
    if (["get", "update", "delete"].includes(action) && !recordId) throw new Error("recordId is required");

    const context = { appId: definition.id, entity, entityId, recordId, payload, query };
    const result = await this.adapter[action](context);
    this.audit({ type: `data.${action}`, appId: definition.id, entityId, recordId: recordId || result?.id || null });
    return result;
  }
}

export { ALLOWED_ACTIONS };
