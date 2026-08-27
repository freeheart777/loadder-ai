import express from "express";
import { createExperimentRunRepository } from "../repositories/experiment-run-repository.mjs";
import { createExperimentRunService, ExperimentRunError } from "../services/experiment-run-service.mjs";
import { db } from "../../db/workspace-database.mjs";

export function createExperimentRunsRouter({ experimentRunService: injected } = {}) {
  const router = express.Router();
  const experimentRunService = injected || createExperimentRunService({ repository: createExperimentRunRepository(db) });
  const handle = (error, res) => error instanceof ExperimentRunError
    ? res.status(error.status).json({ success: false, code: error.code, message: error.message })
    : res.status(500).json({ success: false, code: "EXPERIMENT_RUN_FAILED", message: "Experiment run operation failed.", developmentDetail: process.env.NODE_ENV === "test" ? error.message : undefined });

  router.post("/experiments/:experimentId/runs", (req, res) => { try { const run = experimentRunService.create({ experimentId: req.params.experimentId, contextVersionId: req.body?.contextVersionId }); return res.status(201).json({ success: true, run }); } catch (error) { return handle(error, res); } });
  router.get("/experiments/:experimentId/runs", (req, res) => { try { const page = experimentRunService.list({ experimentId: req.params.experimentId, status: req.query.status, limit: req.query.limit }); return res.json({ success: true, runs: page.items, nextCursor: page.nextCursor }); } catch (error) { return handle(error, res); } });
  router.post("/experiment-runs/:id/start", (req, res) => { try { return res.json({ success: true, run: experimentRunService.start(req.params.id, { contextVersionId: req.body?.contextVersionId }) }); } catch (error) { return handle(error, res); } });
  router.post("/experiment-runs/:id/complete", (req, res) => { try { return res.json({ success: true, run: experimentRunService.complete(req.params.id, { contextVersionId: req.body?.contextVersionId, outcome: req.body?.outcome }) }); } catch (error) { return handle(error, res); } });
  router.post("/experiment-runs/:id/fail", (req, res) => { try { return res.json({ success: true, run: experimentRunService.fail(req.params.id, { contextVersionId: req.body?.contextVersionId, outcome: req.body?.outcome }) }); } catch (error) { return handle(error, res); } });
  router.post("/experiment-runs/:id/cancel", (req, res) => { try { return res.json({ success: true, run: experimentRunService.cancel(req.params.id, { contextVersionId: req.body?.contextVersionId, outcome: req.body?.outcome }) }); } catch (error) { return handle(error, res); } });

  return router;
}
