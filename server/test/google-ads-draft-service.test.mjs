import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { runMigrations } from "../db/migrate.mjs";
import { migrations } from "../db/migrations/index.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { createGoogleAdsDraftRepository } from "../app/repositories/google-ads-draft-repository.mjs";
import { createGoogleAdsDraftService } from "../app/services/google-ads-draft-service.mjs";

const validDraft = {
  name: "فروش تابستانه لودر",
  dailyBudgetMicros: 5000000,
  biddingStrategy: "MAXIMIZE_CLICKS",
  adGroupName: "سایت ساز",
  finalUrl: "https://loadder.example/site-builder",
  headlines: ["سایتت را سریع بساز", "سایت حرفه‌ای با لودر", "همین امروز شروع کن"],
  descriptions: ["با لودر یک سایت حرفه‌ای برای کسب‌وکارت بساز.", "ساخت، مدیریت و رشد سایت در یک پلتفرم."],
  keywords: [{ text: "سایت ساز", matchType: "PHRASE" }, { text: "ساخت سایت", matchType: "EXACT" }],
};

test("Google Ads Persian Search drafts validate, project to Google resources, and stay tenant-scoped", () => {
  const db = new Database(":memory:");
  db.pragma("foreign_keys=ON");
  runMigrations(db, migrations);
  const at = "2026-08-29T10:00:00.000Z";
  for (const id of ["ws-a", "ws-b"]) db.prepare("INSERT INTO workspaces(id,name,slug,created_at,updated_at) VALUES(?,?,?,?,?)").run(id,id,id,at,at);
  const service = createGoogleAdsDraftService({ repository: createGoogleAdsDraftRepository(db), now: () => new Date(at) });

  const draft = runWithWorkspace("ws-a", () => service.create(validDraft));
  assert.equal(draft.status, "VALID");
  assert.equal(draft.validation.length, 0);
  assert.equal(draft.googleResource.channelType, "SEARCH");
  assert.equal(draft.googleResource.initialCampaignStatus, "PAUSED");
  assert.ok(draft.googleResource.operations.some((op) => op.entity === "CampaignBudget"));
  assert.ok(draft.googleResource.operations.some((op) => op.entity === "Campaign"));
  assert.ok(draft.googleResource.operations.some((op) => op.entity === "AdGroup"));
  assert.equal(draft.googleResource.operations.filter((op) => op.entity === "AdGroupCriterion").length, 2);
  assert.ok(draft.googleResource.operations.some((op) => op.entity === "AdGroupAd"));

  const prepared = runWithWorkspace("ws-a", () => service.prepareForGoogle(draft.id));
  assert.equal(prepared.executed, false);
  assert.equal(prepared.draft.status, "READY_FOR_AUTH");
  assert.ok(prepared.requires.includes("google_ads_oauth_connection"));
  assert.ok(prepared.requires.includes("explicit_publish_confirmation"));

  runWithWorkspace("ws-b", () => {
    assert.throws(() => service.get(draft.id), (error) => error.code === "GOOGLE_ADS_DRAFT_NOT_FOUND");
    assert.equal(service.list().length, 0);
  });

  const invalid = runWithWorkspace("ws-a", () => service.create({ ...validDraft, finalUrl: "http://unsafe.example", headlines: ["کم"] }));
  assert.equal(invalid.status, "DRAFT");
  assert.ok(invalid.validation.some((x) => x.field === "finalUrl"));
  assert.ok(invalid.validation.some((x) => x.field === "headlines"));
  assert.throws(() => runWithWorkspace("ws-a", () => service.prepareForGoogle(invalid.id)), (error) => error.code === "GOOGLE_ADS_DRAFT_INVALID" && error.status === 422);

  db.close();
});
