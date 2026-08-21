import express from "express";

export function createLegacyAttributionRouter({
  getAttributionTouchpoints,
  createAttributionTouchpoint,
}) {
  const router = express.Router();

  router.get("/marketing/attribution", (req, res) => {
    try {
      const { customerId = null, leadId = null, campaignId = null } = req.query;
      const data = getAttributionTouchpoints({ customerId, leadId, campaignId });
      return res.json({ ok: true, count: data.length, data });
    } catch (error) {
      console.error("Attribution error:", error);
      return res.status(500).json({ ok: false, message: "خطا در دریافت Attribution." });
    }
  });

  router.post("/marketing/attribution", (req, res) => {
    const { touchType } = req.body;
    if (!touchType) return res.status(400).json({ ok: false, message: "touchType الزامی است." });
    try {
      const data = createAttributionTouchpoint(req.body);
      return res.status(201).json({ ok: true, data });
    } catch (error) {
      console.error("Create attribution error:", error);
      return res.status(500).json({ ok: false, message: "خطا در ثبت Attribution." });
    }
  });

  return router;
}
