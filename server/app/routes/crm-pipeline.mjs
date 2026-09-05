import express from "express";
import {
  CrmPipelineError,
  createCrmPipelineService,
} from "../services/crm-pipeline-service.mjs";

let servicePromise;

function getPipelineService() {
  if (!servicePromise) {
    servicePromise = import("../repositories/crm-deal-repository.mjs").then((repository) =>
      createCrmPipelineService(repository)
    );
  }
  return servicePromise;
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
        reason: req.body?.reason,
        actorType: req.body?.actorType || "user",
        actorId: req.user?.id || null,
      });
      return res.json({ ok: true, data: deal });
    } catch (error) {
      return handlePipelineError(error, res, "CRM_PIPELINE_TRANSITION_FAILED", "خطا در جابه‌جایی فرصت فروش.");
    }
  });

  return router;
}
