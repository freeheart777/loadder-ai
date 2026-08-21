import assert from "node:assert/strict";
import crypto from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import Database from "better-sqlite3";
import express from "express";

import { createRequireAuth, createRequireWorkspace } from "../app/middleware/auth.mjs";
import { createBrandBookRepository } from "../app/repositories/brand-book-repository.mjs";
import { createBusinessContextRepository } from "../app/repositories/business-context-repository.mjs";
import { createBusinessDnaRepository } from "../app/repositories/business-dna-repository.mjs";
import { createBusinessProfileRepository } from "../app/repositories/business-profile-repository.mjs";
import { createIdentityRepository } from "../app/repositories/identity-repository.mjs";
import { createAuthRouter } from "../app/routes/auth.mjs";
import { createBrandBookRouter } from "../app/routes/brand-book.mjs";
import { createBusinessDnaRouter } from "../app/routes/business-dna.mjs";
import { createBusinessProfileRouter } from "../app/routes/business-profile.mjs";
import { createOnboardingRouter } from "../app/routes/onboarding.mjs";
import { createWorkspaceRouter } from "../app/routes/workspaces.mjs";
import { createAuthService } from "../app/services/auth-service.mjs";
import { createBrandBookService } from "../app/services/brand-book-service.mjs";
import { createBusinessContextService } from "../app/services/business-context-service.mjs";
import { createBusinessDnaService } from "../app/services/business-dna-service.mjs";
import { createBusinessProfileService } from "../app/services/business-profile-service.mjs";
import { createOnboardingService } from "../app/services/onboarding-service.mjs";
import { runWithWorkspace } from "../app/tenant-context.mjs";
import { runMigrations } from "../db/migrate.mjs";
import { migration001Identity } from "../db/migrations/001_identity.mjs";
import { migration004WorkspaceManagementAudit } from "../db/migrations/004_workspace_management_audit.mjs";
import { migration005BusinessProfiles } from "../db/migrations/005_business_profiles.mjs";
import { migration006BusinessDnaVersions } from "../db/migrations/006_business_dna_versions.mjs";
import { migration007BusinessDnaImmutability } from "../db/migrations/007_business_dna_immutability.mjs";
import { migration008BrandBookVersions } from "../db/migrations/008_brand_book_versions.mjs";
import { migration009BrandBookImmutability } from "../db/migrations/009_brand_book_immutability.mjs";
import { migration010BusinessContextVersions } from "../db/migrations/010_business_context_versions.mjs";
import { migration011BusinessContextImmutability } from "../db/migrations/011_business_context_immutability.mjs";
import { migration012BusinessContextLifecycleGuards } from "../db/migrations/012_business_context_lifecycle_guards.mjs";

test("MVP onboarding HTTP flow reuses domain APIs and is tenant-safe", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "loadder-onboarding-"));
  const db = new Database(join(directory, "onboarding.sqlite"));
  db.pragma("foreign_keys = ON");
  runMigrations(db, [migration001Identity, migration004WorkspaceManagementAudit, migration005BusinessProfiles, migration006BusinessDnaVersions, migration007BusinessDnaImmutability, migration008BrandBookVersions, migration009BrandBookImmutability, migration010BusinessContextVersions, migration011BusinessContextImmutability, migration012BusinessContextLifecycleGuards]);
  const identities = createIdentityRepository(db);
  const authService = createAuthService({ repository: identities, otpHashSecret: "onboarding-http-secret" });
  const profileService = createBusinessProfileService({ repository: createBusinessProfileRepository(db), auditRepository: identities });
  const dnaService = createBusinessDnaService({ repository: createBusinessDnaRepository(db), auditRepository: identities });
  const brandService = createBrandBookService({ repository: createBrandBookRepository(db), auditRepository: identities });
  const contextService = createBusinessContextService({ repository: createBusinessContextRepository(db), auditRepository: identities });
  const onboardingService = createOnboardingService({ businessProfileService: profileService, businessDnaService: dnaService, brandBookService: brandService, businessContextService: contextService });
  const app = express(); app.use(express.json());
  app.use("/api/auth", createAuthRouter({ authService, nodeEnv: "test", exposeDevelopmentOtp: true }));
  app.use(createRequireAuth(authService)); app.use("/api/workspaces", createWorkspaceRouter({ authService }));
  app.use(createRequireWorkspace(identities)); app.use((req, _res, next) => runWithWorkspace(req.workspace.id, next));
  app.use("/api/business-profile", createBusinessProfileRouter({ businessProfileService: profileService }));
  app.use("/api/business-dna", createBusinessDnaRouter({ businessDnaService: dnaService }));
  app.use("/api/brand-book", createBrandBookRouter({ brandBookService: brandService }));
  app.use("/api/onboarding", createOnboardingRouter({ onboardingService }));
  const server = await new Promise((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  const request = (path, options = {}) => fetch(`http://127.0.0.1:${server.address().port}${path}`, options);
  const sent = await request("/api/auth/send-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mobile: "09124445566", name: "Onboarding Owner" }) });
  const otp = await sent.json();
  const verified = await request("/api/auth/verify-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mobile: "09124445566", code: otp.developmentOtp }) });
  const identity = await verified.json(); const headers = { Cookie: verified.headers.get("set-cookie").split(";")[0], "Content-Type": "application/json" };
  const post = (path, body = {}) => request(path, { method: "POST", headers, body: JSON.stringify(body) });

  await t.test("status is authenticated, bounded, and starts at BUSINESS", async () => {
    assert.equal((await request("/api/onboarding/status")).status, 401);
    const result = await (await request("/api/onboarding/status", { headers })).json();
    assert.equal(result.onboarding.currentStep, "BUSINESS"); assert.equal(Object.hasOwn(result.onboarding, "profile"), false);
  });
  await t.test("existing domain APIs persist the four setup stages", async () => {
    await post("/api/business-profile", { name: "فروشگاه نمونه", industry: "فروشگاه اینترنتی", description: "فروش محصولات کاربردی با ارسال سریع و پشتیبانی مستقیم برای مشتریان.", primaryLanguage: "فارسی" });
    let status = await (await request("/api/onboarding/status", { headers })).json(); assert.equal(status.onboarding.currentStep, "OFFERING");
    const dnaCreated = await post("/api/business-dna/versions", { offerings: ["محصولات کاربردی"], valueProposition: "خرید ساده محصولات کاربردی با ارسال سریع و پشتیبانی قابل اعتماد.", differentiators: ["ارسال سریع"] });
    const dnaDraft = (await dnaCreated.json()).version;
    await request(`/api/business-dna/versions/${dnaDraft.id}`, { method: "PATCH", headers, body: JSON.stringify({ targetAudiences: ["خانواده‌های پرمشغله"], goals: ["افزایش فروش"] }) });
    const brandCreated = await post("/api/brand-book/versions", {
      brandIdentity: { audienceProblem: "کمبود زمان برای یافتن و خرید محصولات مناسب" },
      visualDirection: "مینیمال و روشن",
      primaryColors: ["#6D28D9"],
      secondaryColors: ["#06B6D4"],
      typography: { primary: "Vazirmatn" },
      logoUsageNotes: "حاشیه امن لوگو حفظ شود",
      imageryDirection: "تصاویر واقعی و انسانی",
    });
    const brandDraft = (await brandCreated.json()).version;
    await request(`/api/brand-book/versions/${brandDraft.id}`, { method: "PATCH", headers, body: JSON.stringify({ brandPersonality: ["صمیمی", "قابل‌اعتماد"], toneOfVoice: "ساده و روشن", keyPhrases: ["خرید آسان"], prohibitedPatterns: ["تضمین نتیجه قطعی"] }) });
    status = await (await request("/api/onboarding/status", { headers })).json(); assert.equal(status.onboarding.currentStep, "REVIEW");
    assert.equal(db.prepare("SELECT COUNT(*) count FROM business_dna_versions").get().count, 1); assert.equal(db.prepare("SELECT COUNT(*) count FROM brand_book_versions").get().count, 1);
    const preservedBrand = await (await request("/api/brand-book", { headers })).json();
    assert.equal(preservedBrand.latestDraft.visualDirection, "مینیمال و روشن");
    assert.deepEqual(preservedBrand.latestDraft.primaryColors, ["#6D28D9"]);
    assert.deepEqual(preservedBrand.latestDraft.secondaryColors, ["#06B6D4"]);
    assert.deepEqual(preservedBrand.latestDraft.typography, { primary: "Vazirmatn" });
    assert.equal(preservedBrand.latestDraft.logoUsageNotes, "حاشیه امن لوگو حفظ شود");
    assert.equal(preservedBrand.latestDraft.imageryDirection, "تصاویر واقعی و انسانی");
  });
  await t.test("finalize rejects business and tenant overrides", async () => {
    const response = await post("/api/onboarding/finalize", { workspaceId: "foreign", dnaId: "foreign" });
    assert.equal(response.status, 400); assert.equal((await response.json()).code, "ONBOARDING_FIELDS_FORBIDDEN");
  });
  await t.test("finalize produces one fresh active Context and repeated calls reuse it", async () => {
    const first = await (await post("/api/onboarding/finalize")).json(); assert.equal(first.onboarding.complete, true); assert.equal(first.reusedContext, false);
    const second = await (await post("/api/onboarding/finalize")).json(); assert.equal(second.onboarding.complete, true); assert.equal(second.reusedContext, true);
    assert.equal(db.prepare("SELECT COUNT(*) count FROM business_context_versions").get().count, 1);
    assert.equal(db.prepare("SELECT COUNT(*) count FROM business_context_versions WHERE status='active'").get().count, 1);
  });
  await t.test("workspace switching derives independent onboarding state", async () => {
    const workspaceId = "workspace-onboarding-empty"; const timestamp = new Date().toISOString();
    db.prepare("INSERT INTO workspaces (id,name,slug,status,created_at,updated_at) VALUES (?,?,?,?,?,?)").run(workspaceId, "Empty", "empty-onboarding", "active", timestamp, timestamp);
    db.prepare("INSERT INTO workspace_memberships (id,workspace_id,user_id,role,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run(crypto.randomUUID(), workspaceId, identity.user.id, "admin", "active", timestamp, timestamp);
    await post("/api/workspaces/active", { workspaceId });
    const result = await (await request("/api/onboarding/status", { headers })).json(); assert.equal(result.onboarding.currentStep, "BUSINESS");
  });
  assert.equal(db.pragma("integrity_check", { simple: true }), "ok"); assert.deepEqual(db.pragma("foreign_key_check"), []);
  await new Promise((resolve) => server.close(resolve)); db.close(); rmSync(directory, { recursive: true, force: true });
});
