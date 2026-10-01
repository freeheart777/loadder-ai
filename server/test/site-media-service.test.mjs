import assert from "node:assert/strict";
import test from "node:test";
import { createSiteTestDb } from "../test-helpers/site-test-db.mjs";
import { createSiteProjectRepository } from "../app/repositories/site-project-repository.mjs";
import { createSiteMediaRepository } from "../app/repositories/site-media-repository.mjs";
import { createSiteProjectService } from "../app/services/site-project-service.mjs";
import { createSiteMediaService } from "../app/services/site-media-service.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";

test("media upload is scoped to the owning workspace and project", async () => {
  const db = createSiteTestDb();
  const projectService = createSiteProjectService({
    repository: createSiteProjectRepository(db),
    businessContextService: { getCurrent: () => ({ activeContext: { id: "ctx-1" }, isStale: false }) },
    now: () => new Date("2026-08-29T00:00:00.000Z"),
  });
  const storage = {
    async signedUpload({ workspaceId, siteProjectId, assetType, fileName }) {
      const path = `${workspaceId}/${siteProjectId}/${assetType}/upload-${fileName}`;
      return { bucket: "site-media", path, token: "token", signedUrl: `https://storage.example/${path}?token=token` };
    },
    publicAssetUrl: (path) => `https://cdn.example/${path}`,
  };
  const mediaService = createSiteMediaService({
    repository: createSiteMediaRepository(db),
    siteProjectService: projectService,
    storage,
    now: () => new Date("2026-08-29T00:00:00.000Z"),
  });

  const project = runWithWorkspace("ws-1", () => projectService.create({ name: "Media Store", siteType: "STORE", content: { hero: "Hello" } }));
  const upload = await runWithWorkspace("ws-1", () => mediaService.createUpload(project.id, { assetType: "hero", fileName: "hero.webp", mimeType: "image/webp", sizeBytes: 2048 }));
  assert.match(upload.path, new RegExp(`^ws-1/${project.id}/hero/`));

  const media = runWithWorkspace("ws-1", () => mediaService.completeUpload(project.id, { assetType: "hero", storageKey: upload.path, mimeType: "image/webp", sizeBytes: 2048, metadata: { alt: "Hero" } }));
  assert.equal(media.siteProjectId, project.id);
  assert.equal(media.metadata.alt, "Hero");
  assert.equal(runWithWorkspace("ws-1", () => mediaService.list(project.id)).length, 1);

  runWithWorkspace("ws-1", () => {
    assert.throws(() => mediaService.completeUpload(project.id, { assetType: "hero", storageKey: `ws-2/${project.id}/hero/foreign.webp`, mimeType: "image/webp", sizeBytes: 100 }), (error) => error.code === "SITE_MEDIA_STORAGE_KEY_FORBIDDEN");
    assert.throws(() => mediaService.completeUpload(project.id, { assetType: "hero", storageKey: upload.path, mimeType: "application/javascript", sizeBytes: 100 }), (error) => error.code === "SITE_MEDIA_MIME_TYPE_INVALID");
  });

  await assert.rejects(() => runWithWorkspace("ws-2", () => mediaService.createUpload(project.id, { assetType: "hero", fileName: "steal.webp", mimeType: "image/webp", sizeBytes: 100 })), (error) => error.code === "SITE_PROJECT_NOT_FOUND");
  assert.throws(() => runWithWorkspace("ws-2", () => mediaService.list(project.id)), (error) => error.code === "SITE_PROJECT_NOT_FOUND");
  db.close();
});

test("private learning resources use the canonical media library and fail closed outside their workspace", async () => {
  const db = createSiteTestDb();
  const projectService = createSiteProjectService({ repository: createSiteProjectRepository(db), now: () => new Date("2026-10-02T00:00:00.000Z") });
  const objects = new Map();
  const storage = {
    publicAssetUrl: (key) => `https://cdn.example/${key}`,
    async readLocalAsset(encodedKey) {
      const key = Buffer.from(encodedKey, "base64url").toString("utf8");
      return objects.get(key) || Promise.reject(Object.assign(new Error("not found"), { code: "SITE_MEDIA_NOT_FOUND" }));
    },
  };
  const mediaService = createSiteMediaService({ repository: createSiteMediaRepository(db), siteProjectService: projectService, storage });
  const project = runWithWorkspace("ws-1", () => projectService.create({ name: "Academy", siteType: "EDUCATION", content: {} }));
  const key = `ws-1/${project.id}/document/lesson.pdf`;
  objects.set(key, { body: Buffer.from("%PDF-test"), fileName: "lesson.pdf", mimeType: "application/pdf" });
  const resource = runWithWorkspace("ws-1", () => mediaService.completeUpload(project.id, {
    assetType: "document", storageKey: key, mimeType: "application/pdf", sizeBytes: 9,
    metadata: { visibility: "workspace", title: "جزوهٔ درس", contentCandidateId: "canonical-content-id" },
  }));
  const listed = runWithWorkspace("ws-1", () => mediaService.listLearningResources(project.id));
  assert.deepEqual(listed.map((item) => ({ id: item.id, title: item.title, assetType: item.assetType })), [{ id: resource.id, title: "جزوهٔ درس", assetType: "document" }]);
  const downloaded = await runWithWorkspace("ws-1", () => mediaService.readLearningResource(project.id, resource.id));
  assert.equal(downloaded.object.body.toString(), "%PDF-test");
  await assert.rejects(() => runWithWorkspace("ws-1", () => mediaService.readLearningResource(project.id, "missing")), (error) => error.code === "LEARNING_RESOURCE_NOT_FOUND");
  assert.throws(() => runWithWorkspace("ws-2", () => mediaService.listLearningResources(project.id)), (error) => error.code === "SITE_PROJECT_NOT_FOUND");
  db.close();
});
