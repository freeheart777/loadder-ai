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

// Production without an explicit, valid configuration must refuse rather than pretend: every call fails
// closed with 503 and `reason` says why (surfaced in the Medical readiness panel, never a secret).
export function createUnconfiguredMedicalStorage(reason = "not_enabled") {
  const fail = () => { throw new MedicalStorageError("MEDICAL_STORAGE_NOT_CONFIGURED", "Private medical storage is not configured.", 503); };
  return Object.freeze({ kind: "unconfigured", production: true, reason, put: fail, get: fail, remove: fail });
}

// Accepts exactly 32 bytes as 64 hex characters or standard/url-safe base64. Anything else is rejected.
export function parseEncryptionKey(value) {
  const raw = String(value ?? "").trim();
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  if (/^[A-Za-z0-9+/_-]{43}={0,1}$/.test(raw)) { const key = Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64"); if (key.length === 32) return key; }
  return null;
}

const MAGIC = Buffer.from("LMD1");   // format version 1: magic | iv(12) | tag(16) | ciphertext

// Private local storage for a single node: AES-256-GCM per object with a random IV, the storage key bound as
// additional authenticated data (a ciphertext moved to another key fails to decrypt), 0700/0600 permissions,
// atomic writes. Objects are never addressable by URL. Backups and volume snapshots hold ciphertext only; the
// key lives outside the data volume.
export function createEncryptedFileMedicalStorage({ root, key }) {
  if (!root || !path.isAbsolute(path.resolve(root))) throw new MedicalStorageError("MEDICAL_STORAGE_CONFIG", "A storage directory is required.", 500);
  if (!Buffer.isBuffer(key) || key.length !== 32) throw new MedicalStorageError("MEDICAL_STORAGE_CONFIG", "A 32-byte encryption key is required.", 500);
  const base = path.resolve(root);
  const resolveKey = (storageKey) => {
    const target = path.resolve(base, storageKey);
    if (!target.startsWith(`${base}${path.sep}`)) throw new MedicalStorageError("MEDICAL_STORAGE_KEY_INVALID", "Invalid storage key.", 400);
    return target;
  };
  const aad = (storageKey) => Buffer.from(String(storageKey), "utf8");
  return Object.freeze({
    kind: "encrypted-file", production: true, encrypted: true,
    async put({ workspaceId, siteProjectId, body }) {
      const storageKey = `${workspaceId}/${siteProjectId}/${crypto.randomUUID()}`, target = resolveKey(storageKey);
      const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
      cipher.setAAD(aad(storageKey));
      const ciphertext = Buffer.concat([cipher.update(Buffer.from(body)), cipher.final()]);
      const blob = Buffer.concat([MAGIC, iv, cipher.getAuthTag(), ciphertext]);
      await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
      const temporary = `${target}.${crypto.randomBytes(6).toString("hex")}.tmp`;
      await fs.writeFile(temporary, blob, { mode: 0o600 });
      await fs.rename(temporary, target);
      return storageKey;
    },
    async get(storageKey) {
      let blob;
      try { blob = await fs.readFile(resolveKey(storageKey)); }
      catch (error) { if (error?.code === "ENOENT") throw new MedicalStorageError("MEDICAL_STORAGE_NOT_FOUND", "Stored object not found.", 404); throw error; }
      const integrity = () => new MedicalStorageError("MEDICAL_STORAGE_INTEGRITY", "Stored object failed its integrity check.", 500);
      if (blob.length < MAGIC.length + 12 + 16 || !blob.subarray(0, MAGIC.length).equals(MAGIC)) throw integrity();
      const iv = blob.subarray(4, 16), tag = blob.subarray(16, 32), ciphertext = blob.subarray(32);
      try {
        const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAAD(aad(storageKey)); decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      } catch { throw integrity(); }
    },
    async remove(storageKey) { await fs.rm(resolveKey(storageKey), { force: true }); },
  });
}

// Development/test: plain local files under a dev directory (unchanged). Production: private encrypted local
// storage ONLY on explicit opt-in (MEDICAL_DOCUMENTS_ENABLED=true) with a valid MEDICAL_DOCUMENT_ENCRYPTION_KEY and an
// explicit MEDICAL_DOCUMENT_DIR; otherwise the fail-closed adapter. No silent default location in production.
export function createMedicalStorage({ nodeEnv = "development", root = process.env.MEDICAL_DOCUMENT_DEV_DIR || path.join(process.cwd(), "server", "data", "medical-private"), env = process.env } = {}) {
  if (nodeEnv !== "production") return createFileMedicalStorage({ root });
  if (env.MEDICAL_DOCUMENTS_ENABLED !== "true") return createUnconfiguredMedicalStorage("not_enabled");
  const key = parseEncryptionKey(env.MEDICAL_DOCUMENT_ENCRYPTION_KEY);
  if (!key) return createUnconfiguredMedicalStorage("invalid_encryption_key");
  if (!env.MEDICAL_DOCUMENT_DIR || !path.isAbsolute(env.MEDICAL_DOCUMENT_DIR)) return createUnconfiguredMedicalStorage("no_storage_directory");
  return createEncryptedFileMedicalStorage({ root: env.MEDICAL_DOCUMENT_DIR, key });
}
