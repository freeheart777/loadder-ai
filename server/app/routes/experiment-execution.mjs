import express from "express";
import { createExperimentRepository } from "../repositories/experiment-repository.mjs";
import { createExperimentRunRepository } from "../repositories/experiment-run-repository.mjs";
import { createExperimentRunService, ExperimentRunError } from "../services/experiment-run-service.mjs";
import { createExperimentExecutionService, ExperimentExecutionError } from "../experiments/experiment-execution-service.mjs";
import { createOpenAICompatibleProvider } from "../experiments/providers/openai-compatible-provider.mjs";
import { db } from "../../db/workspace-database.mjs";

export function createExperimentExecutionRouter({ executionService, experimentRunService } = {}) {
  const router = express.Router();
  const runService = experimentRunService || createExperimentRunService({ repository: createExperimentRunRepository(db) });
  const service = executionService || createDefaultExecutionService(runService);
  const handleRun = (error, res) => error instanceof ExperimentRunError ? res.status(error.status).json({ success: false, code: error.code, message: error.message }) : res.status(500).json({ success: false, code: "EXPERIMENT_RUN_FAILED", message: "Experiment run operation failed.", developmentDetail: process.env.NODE_ENV === "test" ? error.message : undefined });
  const handleExecution = (error, res) => error instanceof ExperimentExecutionError ? res.status(error.status).json({ success: false, code: error.code, message: error.message }) : res.status(500).json({ success: false, code: "EXPERIMENT_EXECUTION_FAILED", message: "Experiment execution failed.", developmentDetail: process.env.NODE_ENV === "test" ? error.message : undefined });

  router.post("/experiments/:experimentId/runs", (req, res) => { try { const run = runService.create({ experimentId: req.params.experimentId, contextVersionId: req.body?.contextVersionId }); return res.status(201).json({ success: true, run }); } catch (error) { return handleRun(error, res); } });
  router.get("/experiments/:experimentId/runs", (req, res) => { try { const page = runService.list({ experimentId: req.params.experimentId, status: req.query.status, limit: req.query.limit }); return res.json({ success: true, runs: page.items, nextCursor: page.nextCursor }); } catch (error) { return handleRun(error, res); } });
  router.post("/experiment-runs/:id/start", (req, res) => { try { return res.json({ success: true, run: runService.start(req.params.id, { contextVersionId: req.body?.contextVersionId }) }); } catch (error) { return handleRun(error, res); } });
  router.post("/experiment-runs/:id/complete", (req, res) => { try { return res.json({ success: true, run: runService.complete(req.params.id, { contextVersionId: req.body?.contextVersionId, outcome: req.body?.outcome }) }); } catch (error) { return handleRun(error, res); } });
  router.post("/experiment-runs/:id/fail", (req, res) => { try { return res.json({ success: true, run: runService.fail(req.params.id, { contextVersionId: req.body?.contextVersionId, outcome: req.body?.outcome }) }); } catch (error) { return handleRun(error, res); } });
  router.post("/experiment-runs/:id/cancel", (req, res) => { try { return res.json({ success: true, run: runService.cancel(req.params.id, { contextVersionId: req.body?.contextVersionId, outcome: req.body?.outcome }) }); } catch (error) { return handleRun(error, res); } });
  router.post("/experiments/:experimentId/execute", async (req, res) => {
    try {
      if (!service) return res.status(501).json({ success: false, code: "EXPERIMENT_EXECUTOR_NOT_CONFIGURED", message: "OPENAI_API_KEY and OPENAI_EXPERIMENT_MODEL are required for automatic experiment execution." });
      const result = await service.execute(req.params.experimentId, { input: req.body?.input ?? req.body?.prompt ?? {} });
      return res.status(result.run.status === "COMPLETED" ? 200 : 502).json({ success: result.run.status === "COMPLETED", ...result });
    } catch (error) { return handleExecution(error, res); }
  });
  return router;
}

function createDefaultExecutionService(runService) {
  if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_EXPERIMENT_MODEL) return null;
  const provider = createOpenAICompatibleProvider({ apiKey: process.env.OPENAI_API_KEY, baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1", model: process.env.OPENAI_EXPERIMENT_MODEL });
  return createExperimentExecutionService({ experimentRepository: createExperimentRepository(db), runService, executor: provider });
}
