import express from "express";

export function createLegacyMarketingRouter({
  getMarketingChannels,
  getMarketingPlatforms,
  getAdvertisingServices,
  getMarketingCampaigns,
}) {
  const router = express.Router();

  router.get("/marketing/channels", (req, res) => {
    try {
      const data = getMarketingChannels();
      res.json({ ok: true, count: data.length, data });
    } catch (error) {
      console.error("Marketing channels error:", error);
      res.status(500).json({ ok: false, message: "خطا در دریافت کانال‌های مارکتینگ." });
    }
  });

  router.get("/marketing/platforms", (req, res) => {
    try {
      const data = getMarketingPlatforms(req.query.channelId || null);
      res.json({ ok: true, count: data.length, data });
    } catch (error) {
      console.error("Marketing platforms error:", error);
      res.status(500).json({ ok: false, message: "خطا در دریافت پلتفرم‌های تبلیغاتی." });
    }
  });

  router.get("/marketing/services", (req, res) => {
    try {
      const data = getAdvertisingServices(req.query.platformId || null);
      res.json({ ok: true, count: data.length, data });
    } catch (error) {
      console.error("Advertising services error:", error);
      res.status(500).json({ ok: false, message: "خطا در دریافت سرویس‌های تبلیغاتی." });
    }
  });

  router.get("/marketing/structure", (req, res) => {
    try {
      const channels = getMarketingChannels();
      const platforms = getMarketingPlatforms();
      const services = getAdvertisingServices();
      const data = channels.map((channel) => ({
        ...channel,
        platforms: platforms
          .filter((platform) => platform.channelId === channel.id)
          .map((platform) => ({
            ...platform,
            services: services.filter((service) => service.platformId === platform.id),
          })),
      }));
      res.json({ ok: true, count: data.length, data });
    } catch (error) {
      console.error("Marketing structure error:", error);
      res.status(500).json({ ok: false, message: "خطا در دریافت ساختار تبلیغات." });
    }
  });

  router.get("/marketing/campaigns", (req, res) => {
    try {
      const data = getMarketingCampaigns();
      res.json({ ok: true, count: data.length, data });
    } catch (error) {
      console.error("Marketing campaigns error:", error);
      res.status(500).json({ ok: false, message: "خطا در دریافت کمپین‌ها." });
    }
  });

  return router;
}
