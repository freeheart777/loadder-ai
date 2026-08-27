import express from "express";
import { createExperimentRepository } from "../repositories/experiment-repository.mjs";
import { createExperimentRunRepository } from "../repositories/experiment-run-repository.mjs";
import { createExperimentRunService } from "../services/experiment-run-service.mjs";
import { createExperimentExecutionService, ExperimentExecutionError } from "../experiments/experiment-execution-service.mjs";
import { createOpenAICompatibleProvider } from "../experiments/providers/openai-compatible-provider.mjs";
import { db } from "../../db/workspace-database.mjs";

export function createExperimentExecutionRouter({ executionService } = {}) {
  const router = express.Router();
  const service = executionService || createDefaultExecutionService();
  router.post("/experiments/:experimentId/execute", async (req, res) => {
    try {
      if (!service) {
        return res.status(501).json({ success: false, code: "EXPERIMENT_EXECUTOR_NOT_CONFIGURED", message: "OPENAI_API_KEY and OPENAI_EXPERIMENT_MODEL are required for automatic experiment execution." });
      }
      const result = await service.execute(req.params.experimentId, { input: req.body?.input ?? req.body?.prompt ?? {} });
      return res.status(result.run.status === "COMPLETED" ? 200 : 502).json({ success: result.run.status === "COMPLETED", ...result });
    } catch (error) {
      if (error instanceof ExperimentExecutionError) return res.status(error.status).json({ success: false, code: error.code, message: error.message });
      return res.status(500).json({ success: false, code: "EXPERIMENT_EXECUTION_FAILED", message: "Experiment execution failed.", developmentDetail: process.env.NODE_ENV === "test" ? error.message : undefined });
    }
  });
  return router;
}

function createDefaultExecutionService() {
  if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_EXPERIMENT_MODEL) return null;
  const runService = createExperimentRunService({ repository: createExperimentRunRepository(db) });
  const provider = createOpenAICompatibleProvider({ apiKey: process.env.OPENAI_API_KEY, baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1", model: process.env.OPENAI_EXPERIMENT_MODEL });
  return createExperimentExecutionService({ experimentRepository: createExperimentRepository(db), runService, executor: provider });
}
