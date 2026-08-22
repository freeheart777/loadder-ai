import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createWriteStream } from "node:fs";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { ContentAssetStoreError } from "./content-asset-store.mjs";

export function createR2ContentAssetStore(config) {
  const complete = [config?.accountId, config?.bucket, config?.accessKeyId, config?.secretAccessKey].every(Boolean);
  if (!complete) return null;
  const client = new S3Client({ region: "auto", endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey } });
  const command = (Type, key, extra = {}) => new Type({ Bucket: config.bucket, Key: key, ...extra });
  const wrap = async (operation) => { try { return await operation(); } catch { throw new ContentAssetStoreError(); } };
  return Object.freeze({
    kind: "R2", backendKind: "OBJECT_STORAGE", legacyProviderKind: "UNAVAILABLE", configured: true, uploadEnabled: config.mediaRuntimeAvailable === true,
    async createUploadAuthorization({ locator, contentType, contentSha256, expiresIn = 600 }) {
      const requiredHeaders = { "Content-Type": contentType, "x-amz-checksum-sha256": Buffer.from(contentSha256, "hex").toString("base64") };
      const url = await wrap(() => getSignedUrl(client, command(PutObjectCommand, locator.storageObjectKey, { ContentType: contentType, ChecksumSHA256: requiredHeaders["x-amz-checksum-sha256"] }), { expiresIn }));
      return Object.freeze({ method: "PUT", url, requiredHeaders, expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString() });
    },
    async statObject(locator) { const value = await wrap(() => client.send(command(HeadObjectCommand, locator.storageObjectKey))); return Object.freeze({ byteSize: value.ContentLength, checksumSha256Base64: value.ChecksumSHA256, contentType: value.ContentType }); },
    async verifyChecksum(locator, expected) { const value = await this.statObject(locator); return value.checksumSha256Base64 === Buffer.from(expected, "hex").toString("base64"); },
    async createReadAuthorization(locator, { expiresIn = 300 } = {}) { const url = await wrap(() => getSignedUrl(client, command(GetObjectCommand, locator.storageObjectKey), { expiresIn })); return Object.freeze({ method: "GET", url, expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString() }); },
    async deleteObject(locator) { await wrap(() => client.send(command(DeleteObjectCommand, locator.storageObjectKey))); return true; },
    async downloadObjectToFile(locator, { destinationPath, maxBytes }) {
      const value = await wrap(() => client.send(command(GetObjectCommand, locator.storageObjectKey))); let byteSize = 0;
      const limiter = new Transform({ transform(chunk, encoding, callback) { byteSize += chunk.length; if (byteSize > maxBytes) callback(new ContentAssetStoreError("CONTENT_ASSET_TOO_LARGE", 413)); else callback(null, chunk); } });
      await wrap(() => pipeline(value.Body, limiter, createWriteStream(destinationPath, { flags: "wx", mode: 0o600 })));
      return Object.freeze({ byteSize });
    },
    async writeCanonicalObject(locator, { body, contentType, contentSha256 }) { await wrap(() => client.send(command(PutObjectCommand, locator.storageObjectKey, { Body: body, ContentType: contentType, ChecksumSHA256: Buffer.from(contentSha256, "hex").toString("base64") }))); return true; },
  });
}
