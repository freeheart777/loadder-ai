export class ContentAssetStoreError extends Error {
  constructor(code = "CONTENT_ASSET_STORAGE_UNAVAILABLE", status = 503) {
    super(code); this.name = "ContentAssetStoreError"; this.code = code; this.status = status;
  }
}

const OPERATIONS = ["createUploadAuthorization", "statObject", "verifyChecksum", "createReadAuthorization", "deleteObject", "downloadObjectToFile", "writeCanonicalObject"];

export function assertContentAssetStore(store) {
  if (!store || !OPERATIONS.every((operation) => typeof store[operation] === "function")) throw new TypeError("ContentAssetStore contract is invalid.");
  return store;
}

export function createUnavailableContentAssetStore() {
  const unavailable = () => { throw new ContentAssetStoreError(); };
  return Object.freeze({ kind: "UNAVAILABLE", backendKind: null, legacyProviderKind: "UNAVAILABLE", configured: false, uploadEnabled: false, ...Object.fromEntries(OPERATIONS.map((operation) => [operation, unavailable])) });
}

export function createTestOnlyInsecureMemoryContentAssetStore() {
  const objects = new Map(); const failures = new Map(); let authorizationSequence = 0;
  const failIf = (operation) => { const code = failures.get(operation); if (code) throw new ContentAssetStoreError(code, 503); };
  const key = (locator) => {
    if (!locator || locator.storageProvider !== "TEST_MEMORY" || typeof locator.storageObjectKey !== "string") throw new ContentAssetStoreError("CONTENT_ASSET_INVALID", 400);
    return locator.storageObjectKey;
  };
  return Object.freeze({
    kind: "TEST_MEMORY", backendKind: "TEST_MEMORY", legacyProviderKind: "TEST_MEMORY", configured: true, uploadEnabled: true,
    createUploadAuthorization({ locator }) { failIf("createUploadAuthorization"); const objectKey = key(locator); authorizationSequence += 1; return Object.freeze({ method: "PUT", url: `memory://upload/${authorizationSequence}`, requiredHeaders: {}, expiresAt: new Date(Date.now() + 600000).toISOString(), authorization: `test-memory-upload-${authorizationSequence}`, objectKey }); },
    statObject(locator) { failIf("statObject"); const value = objects.get(key(locator)); if (!value) throw new ContentAssetStoreError("CONTENT_ASSET_NOT_FOUND", 404); return Object.freeze({ byteSize: value.byteSize, contentSha256: value.contentSha256 }); },
    verifyChecksum(locator, expectedSha256) { failIf("verifyChecksum"); const value = objects.get(key(locator)); if (!value) throw new ContentAssetStoreError("CONTENT_ASSET_NOT_FOUND", 404); return value.contentSha256 === expectedSha256; },
    createReadAuthorization(locator) { failIf("createReadAuthorization"); const objectKey = key(locator); if (!objects.has(objectKey)) throw new ContentAssetStoreError("CONTENT_ASSET_NOT_FOUND", 404); authorizationSequence += 1; return Object.freeze({ method: "GET", authorization: `test-memory-read-${authorizationSequence}` }); },
    deleteObject(locator) { failIf("deleteObject"); return objects.delete(key(locator)); },
    async downloadObjectToFile(locator, { destinationPath, maxBytes }) { failIf("downloadObjectToFile"); const value = objects.get(key(locator)); if (!value?.body) throw new ContentAssetStoreError("CONTENT_ASSET_NOT_FOUND", 404); if (value.body.length > maxBytes) throw new ContentAssetStoreError("CONTENT_ASSET_TOO_LARGE", 413); const { writeFile } = await import("node:fs/promises"); await writeFile(destinationPath, value.body, { flag: "wx" }); return Object.freeze({ byteSize: value.body.length }); },
    writeCanonicalObject(locator, { body, contentType, contentSha256 }) { failIf("writeCanonicalObject"); objects.set(key(locator), Object.freeze({ body, byteSize: body.length, contentSha256, contentType })); return true; },
    testOnlyInjectObject(locator, { byteSize, contentSha256, body = null, contentType = null }) { objects.set(key(locator), Object.freeze({ byteSize, contentSha256, body, contentType })); },
    testOnlyInjectFailure(operation, code = "CONTENT_ASSET_STORAGE_UNAVAILABLE") { failures.set(operation, code); },
    testOnlyClearFailure(operation) { failures.delete(operation); },
  });
}
