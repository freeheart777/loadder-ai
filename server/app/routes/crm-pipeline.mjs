import express from "express";
import {
  CrmPipelineError,
  createCrmPipelineService,
} from "../services/crm-pipeline-service.mjs";
import { createCrmPipelineAnalyticsService } from "../services/crm-pipeline-analytics-service.mjs";
import { createCrmAutomationService } from "../services/crm-automation-service.mjs";

let servicePromise;
let analyticsPromise;
let automationPromise;

function getPipelineService() {
  if (!servicePromise) {
    servicePromise = import("../repositories/crm-deal-repository.mjs").then((repository) =>
      createCrmPipelineService(repository)
    );
  }
  return servicePromise;
}

function getAnalyticsService() {
  if (!analyticsPromise) {
    analyticsPromise = import("../repositories/crm-deal-repository.mjs").then((repository) =>
      createCrmPipelineAnalyticsService(repository)
    );
  }
  return analyticsPromise;
}

function getAutomationService() {
  if (!automationPromise) {
    automationPromise = import("../repositories/crm-automation-repository.mjs").then((repository) =>
      createCrmAutomationService(repository)
    );
  }
  return automationPromise;
}

function handlePipelineError(error, res, fallbackCode, fallbackMessage) {
  if (error instanceof CrmPipelineError) {
    return res.status(error.status).json({ ok: false, code: error.code, message: error.message });
  }
  console.error(fallbackCode, error);
  return res.status(500).json({ ok: false, code: fallbackCode, message: fallbackMessage });
}

export function createCrmPipelineRouter() {
  const router = express.Router();

  router.get("/", async (_req, res) => {
    try {
      const service = await getPipelineService();
      return res.json({ ok: true, data: service.board() });
    } catch (error) {
      return handlePipelineError(error, res, "CRM_PIPELINE_READ_FAILED", "خطا در دریافت Pipeline فروش.");
    }
  });

  router.get("/analytics", async (_req, res) => {
    try {
      const service = await getAnalyticsService();
      return res.json({ ok: true, data: service.snapshot() });
    } catch (error) {
      return handlePipelineError(error, res, "CRM_PIPELINE_ANALYTICS_FAILED", "خطا در محاسبه تحلیل Pipeline.");
    }
  });

  router.get("/automation", async (_req, res) => {
    try {
      const service = await getAutomationService();
      service.processPending();
      return res.json({ ok: true, data: { summary: service.summary(), actions: service.actions() } });
    } catch (error) {
      return handlePipelineError(error, res, "CRM_AUTOMATION_READ_FAILED", "خطا در دریافت Automation فروش.");
    }
  });

  router.post("/automation/sweep", async (req, res) => {
    try {
      const service = await getAutomationService();
      const result = service.sweepStuck({ afterDays: req.body?.afterDays ?? 3 });
      return res.json({ ok: true, data: result });
    } catch (error) {
      return handlePipelineError(error, res, "CRM_AUTOMATION_SWEEP_FAILED", "خطا در اجرای بررسی Dealهای متوقف‌شده.");
    }
  });

  router.post("/automation/process", async (_req, res) => {
    try {
      const service = await getAutomationService();
      return res.json({ ok: true, data: service.processPending() });
    } catch (error) {
      return handlePipelineError(error, res, "CRM_AUTOMATION_PROCESS_FAILED", "خطا در پردازش Automation فروش.");
    }
  });

  router.get("/deals/:id/history", async (req, res) => {
    try {
      const service = await getPipelineService();
      return res.json({ ok: true, data: service.history(req.params.id) });
    } catch (error) {
      return handlePipelineError(error, res, "CRM_DEAL_HISTORY_READ_FAILED", "خطا در دریافت تاریخچه Deal.");
    }
  });

  router.patch("/deals/:id", async (req, res) => {
    try {
      const service = await getPipelineService();
      const deal = service.updateMetadata({
        dealId: req.params.id,
        expectedVersion: req.body?.expectedVersion,
        ownerId: req.body?.ownerId,
        owner: req.body?.owner,
        nextAction: req.body?.nextAction,
        nextActionDueAt: req.body?.nextActionDueAt,
      });
      return res.json({ ok: true, data: deal });
    } catch (error) {
      return handlePipelineError(error, res, "CRM_DEAL_UPDATE_FAILED", "خطا در ویرایش Deal.");
    }
  });

  router.post("/leads/:id/transition", async (req, res) => {
    try {
      const service = await getPipelineService();
      const deal = service.transition({
        dealId: req.params.id,
        toStage: req.body?.toStage,
        expectedVersion: req.body?.expectedVersion,
        expectedUpdatedAt: req.body?.expectedUpdatedAt,
        reason: req.body?.reason,
        actorType: req.body?.actorType || "user",
        actorId: req.user?.id || null,
      });
      const automation = await getAutomationService();
      const automationResult = automation.processPending();
      return res.json({ ok: true, data: deal, automation: automationResult });
    } catch (error) {
      return handlePipelineError(error, res, "CRM_PIPELINE_TRANSITION_FAILED", "خطا در جابه‌جایی فرصت فروش.");
    }
  });

  return router;
}
