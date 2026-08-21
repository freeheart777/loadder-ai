import express from "express";

import { BusinessEventError } from "../services/business-event-service.mjs";

export function createIntelligenceDataRouter({ businessEventService, intelligenceQueryService }) {
  const router = express.Router();
  function handle(error, res) {
    if (error instanceof BusinessEventError) {
      return res.status(error.status).json({ success: false, message: error.message, code: error.code });
    }
    console.error("Intelligence data error:", error);
    return res.status(500).json({ success: false, message: "Unable to process intelligence data." });
  }
  router.post("/events/ingest", (req, res) => {
    try {
      const result = businessEventService.ingest(req.body, req.user.id);
      return res.status(result.duplicate ? 200 : 201).json({ success: true, ...result });
    } catch (error) { return handle(error, res); }
  });
  router.get("/events", (req, res) => {
    try { const page = businessEventService.listPage(req.query); return res.json({ success: true, events: page.items, nextCursor: page.nextCursor }); }
    catch (error) { return handle(error, res); }
  });
  router.get("/events/:id", (req, res) => {
    try { return res.json({ success: true, event: businessEventService.get(req.params.id) }); }
    catch (error) { return handle(error, res); }
  });
  router.get("/observations", (req, res) => {
    try {
      const page = intelligenceQueryService.listObservationPage(req.query);
      return res.json({ success: true, observations: page.items, nextCursor: page.nextCursor });
    }
    catch (error) { return handle(error, res); }
  });
  router.get("/signals", (req, res) => {
    try { return res.json({ success: true, signals: intelligenceQueryService.listSignals(req.query) }); }
    catch (error) { return handle(error, res); }
  });
  return router;
}
