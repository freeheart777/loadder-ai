import express from "express";
import { IntegrationError } from "../services/integration-service.mjs";

export function createIntegrationRouter({ service }) {
  const router = express.Router();

  const handle = (error, res) => {
    if (error instanceof IntegrationError) {
      return res.status(error.status || 400).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }
    console.error("Integration operation failed:", error);
    return res.status(500).json({
      success: false,
      message: "Integration operation failed.",
    });
  };

  router.get("/connector-definitions", (req, res) => {
    try {
      return res.json({ success: true, connectors: service.definitions(req.query.region) });
    } catch (error) {
      return handle(error, res);
    }
  });

  router.post("/connections", (req, res) => {
    try {
      return res.status(201).json({
        success: true,
        connection: service.createConnection(req.body || {}, req.user.id),
      });
    } catch (error) {
      return handle(error, res);
    }
  });

  router.get("/connections", (req, res) =>
    res.json({ success: true, connections: service.connections() })
  );

  router.get("/connections/:id", (req, res) => {
    try {
      return res.json({ success: true, connection: service.connection(req.params.id) });
    } catch (error) {
      return handle(error, res);
    }
  });

  router.post("/imports", (req, res) => {
    try {
      return res.status(201).json({
        success: true,
        ...service.import(req.body || {}, req.user.id),
      });
    } catch (error) {
      return handle(error, res);
    }
  });

  router.get("/imports", (req, res) =>
    res.json({ success: true, batches: service.batches() })
  );

  router.get("/imports/:id", (req, res) => {
    try {
      return res.json({ success: true, ...service.batch(req.params.id) });
    } catch (error) {
      return handle(error, res);
    }
  });

  return router;
}
