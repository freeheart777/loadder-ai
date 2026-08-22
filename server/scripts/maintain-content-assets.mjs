import { pathToFileURL } from "node:url";
import { environment } from "../app/config/environment.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { createContentAssetRepository } from "../app/repositories/content-asset-repository.mjs";
import { createR2ContentAssetStore } from "../app/content-assets/r2-content-asset-store.mjs";
import { createUnavailableContentAssetStore } from "../app/content-assets/content-asset-store.mjs";
import { CONTENT_ASSET_RETENTION_MS } from "../app/content-assets/content-asset-policy.mjs";

const timestampAfter = (candidate, previous) => candidate > previous ? candidate : new Date(Date.parse(previous) + 1).toISOString();
const locator = (asset, objectKey) => ({ storageProvider: asset.storageBackendKind || asset.storageProvider, storageObjectKey: objectKey });

export async function maintainContentAssets({ database, store, now = new Date(), limit = 50 } = {}) {
  if (!database) throw new TypeError("Maintenance database is required.");
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new TypeError("Maintenance limit must be between 1 and 50.");
  if (!store?.configured) return Object.freeze({ examined: 0, deleted: 0, failed: 0, storageUnavailable: true });
  const repository = createContentAssetRepository(database), workspaces = database.prepare("SELECT id FROM workspaces WHERE status='active' ORDER BY id").all();
  let examined = 0, deleted = 0, failed = 0;
  for (const { id: workspaceId } of workspaces) {
    if (examined >= limit) break;
    await runWithWorkspace(workspaceId, async () => {
      const candidates = [];
      for (const [status, age] of [["DELETING", 0], ["UPLOADING", CONTENT_ASSET_RETENTION_MS.UPLOADING], ["FAILED", CONTENT_ASSET_RETENTION_MS.FAILED]]) {
        if (candidates.length >= limit - examined) break;
        const before = new Date(now.getTime() - age).toISOString();
        candidates.push(...repository.listMaintenance({ status, before, limit: limit - examined - candidates.length }));
      }
      for (const candidate of candidates) {
        examined += 1;
        try {
          const deleting = candidate.status === "DELETING" ? candidate : repository.requestDeletion(candidate.id, timestampAfter(now.toISOString(), candidate.updatedAt));
          if (!deleting) continue;
          for (const objectKey of new Set([deleting.storageObjectKey, deleting.canonicalStorageObjectKey].filter(Boolean))) await store.deleteObject(locator(deleting, objectKey));
          if (repository.recordDeleted(deleting.id, timestampAfter(now.toISOString(), deleting.updatedAt))) deleted += 1;
        } catch { failed += 1; }
      }
    });
  }
  return Object.freeze({ examined, deleted, failed, storageUnavailable: false });
}

async function main() {
  const { db } = await import("../db/database.mjs");
  const store = environment.contentAssetStorage.provider === "r2" ? (createR2ContentAssetStore(environment.contentAssetStorage) || createUnavailableContentAssetStore()) : createUnavailableContentAssetStore();
  const result = await maintainContentAssets({ store });
  db.pragma("wal_checkpoint(TRUNCATE)"); db.close();
  console.log(JSON.stringify(result));
  if (result.storageUnavailable || result.failed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
