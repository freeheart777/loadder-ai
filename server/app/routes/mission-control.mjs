import express from "express";

export function createMissionControlRouter({ service }) {
  const router = express.Router();
  router.get("/mission-control", (_req, res) => {
    try { return res.json({ success: true, missionControl: service.getMissionControl() }); }
    catch (error) { return res.status(500).json({ success: false, code: "MISSION_CONTROL_READ_FAILED", message: "Mission Control is temporarily unavailable.", developmentDetail: process.env.NODE_ENV === "test" ? error.message : undefined }); }
  });
  return router;
}
