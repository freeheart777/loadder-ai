import express from "express";
import {
  getLeads,
  getLeadById,
  updateLead,
} from "../../db/workspace-database.mjs";
import {
  CrmPipelineError,
  createCrmPipelineService,
} from "../services/crm-pipeline-service.mjs";

const service = createCrmPipelineService({
  getLeads,
  getLeadById,
  updateLead,
});

export function createCrmPipelineRouter() {
  const router = express.Router();

  router.get("/", (req, res) => {
    try {
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

  router.post("/leads/:id/transition", (req, res) => {
    try {
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
