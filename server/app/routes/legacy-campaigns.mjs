import express from "express";

const NOT_FOUND = "کمپین پیدا نشد.";

export function createLegacyCampaignsRouter({
  getCampaignById,
  createMarketingCampaign,
  getCampaignMetrics,
  saveCampaignMetric,
  calculateCampaignKPIs,
  getAttributionTouchpoints,
  getCampaignAttributedPerformance,
  getCampaignRuntimeConfig,
  updateCampaignRuntimeConfig,
  defaultControlMode,
}) {
  const router = express.Router();

  router.post("/marketing/campaigns", (req, res) => {
    const {
      channelId, platformId, serviceId = null, name, strategy = "acquisition",
      objective = null, status = "draft", budget = 0, currency = "IRR",
      externalId = null, startedAt = null, endedAt = null,
      controlMode = defaultControlMode, guardrails = null, targets = null,
    } = req.body;
    if (!channelId || !platformId || !name) {
      return res.status(400).json({ ok: false, message: "channelId، platformId و name الزامی هستند." });
    }
    try {
      const campaign = createMarketingCampaign({
        channelId, platformId, serviceId, name, strategy, objective, status,
        budget: Number(budget) || 0, currency, externalId, startedAt, endedAt,
      });
      updateCampaignRuntimeConfig(campaign.id, {
        controlMode,
        ...(guardrails ? { guardrails } : {}),
        ...(targets ? { targets } : {}),
      });
      return res.status(201).json({
        ok: true,
        data: { campaign, control: getCampaignRuntimeConfig(campaign.id) },
      });
    } catch (error) {
      console.error("Create campaign error:", error);
      return res.status(500).json({ ok: false, message: "خطا در ساخت کمپین." });
    }
  });

  router.get("/marketing/campaigns/:id/performance", (req, res) => {
    try {
      const campaign = getCampaignById(req.params.id);
      if (!campaign) return res.status(404).json({ ok: false, message: NOT_FOUND });
      const performance = getCampaignAttributedPerformance(campaign.id);
      return res.json({ ok: true, data: { campaign, performance } });
    } catch (error) {
      console.error("Campaign performance error:", error);
      return res.status(500).json({ ok: false, message: "خطا در محاسبه عملکرد واقعی کمپین." });
    }
  });

  router.get("/marketing/campaigns/:id/metrics", (req, res) => {
    try {
      const campaign = getCampaignById(req.params.id);
      if (!campaign) return res.status(404).json({ ok: false, message: NOT_FOUND });
      const data = getCampaignMetrics(campaign.id);
      return res.json({ ok: true, count: data.length, data });
    } catch (error) {
      console.error("Campaign metrics error:", error);
      return res.status(500).json({ ok: false, message: "خطا در دریافت داده‌های کمپین." });
    }
  });

  router.post("/marketing/campaigns/:id/metrics", (req, res) => {
    const campaign = getCampaignById(req.params.id);
    if (!campaign) return res.status(404).json({ ok: false, message: NOT_FOUND });
    try {
      const metric = saveCampaignMetric({ campaignId: campaign.id, ...req.body });
      const metrics = getCampaignMetrics(campaign.id);
      const kpis = calculateCampaignKPIs(metrics);
      return res.status(201).json({ ok: true, data: { metric, kpis } });
    } catch (error) {
      console.error("Save campaign metrics error:", error);
      return res.status(500).json({ ok: false, message: "خطا در ذخیره داده کمپین." });
    }
  });

  router.get("/marketing/campaigns/:id/kpis", (req, res) => {
    try {
      const campaign = getCampaignById(req.params.id);
      if (!campaign) return res.status(404).json({ ok: false, message: NOT_FOUND });
      const data = calculateCampaignKPIs(getCampaignMetrics(campaign.id));
      return res.json({ ok: true, data });
    } catch (error) {
      console.error("Campaign KPI error:", error);
      return res.status(500).json({ ok: false, message: "خطا در محاسبه KPI کمپین." });
    }
  });

  router.get("/marketing/campaigns/:id", (req, res) => {
    try {
      const campaign = getCampaignById(req.params.id);
      if (!campaign) return res.status(404).json({ ok: false, message: NOT_FOUND });
      const metrics = getCampaignMetrics(campaign.id);
      const kpis = calculateCampaignKPIs(metrics);
      const touchpoints = getAttributionTouchpoints({ campaignId: campaign.id });
      const performance = getCampaignAttributedPerformance(campaign.id);
      const control = getCampaignRuntimeConfig(campaign.id);
      return res.json({
        ok: true,
        data: {
          campaign, metrics, kpis, performance, control,
          attribution: { count: touchpoints.length, touchpoints },
        },
      });
    } catch (error) {
      console.error("Campaign detail error:", error);
      return res.status(500).json({ ok: false, message: "خطا در دریافت جزئیات کمپین." });
    }
  });

  return router;
}
