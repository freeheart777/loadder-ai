import express from "express";
import {
  CrmPipelineError,
  createCrmPipelineService,
} from "../services/crm-pipeline-service.mjs";

let servicePromise;

function getPipelineService() {
  if (!servicePromise) {
    servicePromise = import("../../db/workspace-database.mjs").then(
      ({ getLeads, getLeadById, updateLead }) =>
        createCrmPipelineService({ getLeads, getLeadById, updateLead })
    );
  }
  return servicePromise;
}

export function createCrmPipelineRouter() {
  const router = express.Router();

  router.get("/", async (req, res) => {
    try {
      const service = await getPipelineService();
      return res.json({ ok: true, data: service.board() });
    } catch (error) {
      console.error("CRM pipeline board error:", error);
      return res.status(500).json({
        ok: false,
        code: "CRM_PIPELINE_READ_FAILED",
        message: "خطا در دریافت Pipeline فروش.",
      });
    }
  });

  router.post("/leads/:id/transition", async (req, res) => {
    try {
      const service = await getPipelineService();
      const deal = service.transition({
        dealId: req.params.id,
        toStage: req.body?.toStage,
        expectedUpdatedAt: req.body?.expectedUpdatedAt,
      });

      return res.json({ ok: true, data: deal });
    } catch (error) {
      if (error instanceof CrmPipelineError) {
        return res.status(error.status).json({
          ok: false,
          code: error.code,
          message: error.message,
        });
      }

      console.error("CRM pipeline transition error:", error);
      return res.status(500).json({
        ok: false,
        code: "CRM_PIPELINE_TRANSITION_FAILED",
        message: "خطا در جابه‌جایی فرصت فروش.",
      });
    }
  });

  return router;
}
