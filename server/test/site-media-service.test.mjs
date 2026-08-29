import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { runMigrations } from "../db/migrate.mjs";
import { migrations } from "../db/migrations/index.mjs";
import { createSiteProjectRepository } from "../app/repositories/site-project-repository.mjs";
import { createSiteMediaRepository } from "../app/repositories/site-media-repository.mjs";
import { createSiteProjectService } from "../app/services/site-project-service.mjs";
import { createSiteMediaService } from "../app/services/site-media-service.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";

test("media upload is scoped to the owning workspace and project", async () => {
  const db = new Database(":memory:");
  runMigrations(db, migrations);
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
