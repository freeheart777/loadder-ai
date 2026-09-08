import express from "express";

export function createSitePublicRuntimeRouter({ service }) {
  const router = express.Router();

  router.get("/sites/:slug", (req, res) => {
    const result = service.getPublished(req.params.slug);
    if (!result) return res.status(404).json({ success: false, code: "SITE_NOT_FOUND", message: "Published site not found." });

    res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    res.set("X-Content-Type-Options", "nosniff");
    return res.json({ success: true, ...result });
  });

  return router;
}
