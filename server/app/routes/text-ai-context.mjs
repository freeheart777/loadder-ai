import express from "express";

const STATUS_BY_STATE = {
  READY: 200,
  MISSING_CONTEXT: 409,
  STALE_CONTEXT: 409,
  UNSUPPORTED_SCHEMA: 422,
};

export function createTextAiContextRouter({ textAiContextConsumer }) {
  const router = express.Router();
  router.post("/prepare", (req, res) => {
    try {
      const result = textAiContextConsumer.prepareInput({
        operation: "prepare_context",
        executionRequestId: req.body?.executionRequestId || null,
        userId: req.user.id,
      });
      return res.status(STATUS_BY_STATE[result.state] || 500).json({ success: result.state === "READY", ...result });
    } catch (error) {
      console.error("Text AI context preparation error:", error);
      return res.status(400).json({ success: false, message: "Unable to prepare Text AI context." });
    }
  });
  return router;
}
