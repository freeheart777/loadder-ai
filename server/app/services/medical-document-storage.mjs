import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export class MedicalStorageError extends Error {
  constructor(code, message, status = 500) { super(message); this.name = "MedicalStorageError"; this.code = code; this.status = status; }
}

// The storage contract: opaque keys the caller never chooses, objects that are
// never reachable by URL. Development/test adapters only; no production bucket
// is pretended to exist.
export function createMemoryMedicalStorage() {
  const objects = new Map();
  return Object.freeze({
    kind: "memory", production: false,
    async put({ workspaceId, siteProjectId, body }) { const key = `${workspaceId}/${siteProjectId}/${crypto.randomUUID()}`; objects.set(key, Buffer.from(body)); return key; },
    async get(key) { const body = objects.get(key); if (!body) throw new MedicalStorageError("MEDICAL_STORAGE_NOT_FOUND", "Stored object not found.", 404); return Buffer.from(body); },
    async remove(key) { objects.delete(key); },
    _keys: () => [...objects.keys()],
  });
}

export function createFileMedicalStorage({ root }) {
  const resolveKey = (key) => {
    const target = path.resolve(root, key);
    if (!target.startsWith(`${path.resolve(root)}${path.sep}`)) throw new MedicalStorageError("MEDICAL_STORAGE_KEY_INVALID", "Invalid storage key.", 400);
    return target;
  };
  return Object.freeze({
    kind: "file", production: false,
    async put({ workspaceId, siteProjectId, body }) {
      const key = `${workspaceId}/${siteProjectId}/${crypto.randomUUID()}`, target = resolveKey(key);
      await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
      await fs.writeFile(target, body, { mode: 0o600 });
      return key;
    },
    async get(key) { try { return await fs.readFile(resolveKey(key)); } catch (error) { if (error?.code === "ENOENT") throw new MedicalStorageError("MEDICAL_STORAGE_NOT_FOUND", "Stored object not found.", 404); throw error; } },
    async remove(key) { await fs.rm(resolveKey(key), { force: true }); },
  });
}

// Production has no private object store wired yet, so it must refuse rather than pretend.
export function createUnconfiguredMedicalStorage() {
  const fail = () => { throw new MedicalStorageError("MEDICAL_STORAGE_NOT_CONFIGURED", "Private medical storage is not configured.", 503); };
  return Object.freeze({ kind: "unconfigured", production: true, put: fail, get: fail, remove: fail });
}

export function createMedicalStorage({ nodeEnv = "development", root = process.env.MEDICAL_DOCUMENT_DEV_DIR || path.join(process.cwd(), "server", "data", "medical-private") } = {}) {
  return nodeEnv === "production" ? createUnconfiguredMedicalStorage() : createFileMedicalStorage({ root });
}
