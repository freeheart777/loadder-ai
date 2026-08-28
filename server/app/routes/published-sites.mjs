import express from "express";

export function createPublishedSitesRouter({ service }) {
  const router = express.Router();
  router.get("/published-sites/:id", (req, res) => {
    const html = service.render(req.params.id);
    if (!html) return res.status(404).type("text/plain").send("Published site not found");
    res.set({ "Cache-Control": "public, max-age=60, s-maxage=300", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin" });
    return res.status(200).type("html").send(html);
  });
  return router;
}
