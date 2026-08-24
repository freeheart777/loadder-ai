import express from "express";
import { WebsiteError } from "../services/website-service.mjs";
export function createWebsiteRouter({ service }) {
  const r = express.Router(),
    actor = (req) => ({ userId: req.user.id, role: req.membership.role }),
    handle = (e, res) =>
      e instanceof WebsiteError
        ? res.status(e.status).json({
            success: false,
            code: e.code,
            message: "Website operation could not be completed.",
          })
        : res.status(500).json({
            success: false,
            code: "WEBSITE_INVALID",
            message: "Website operation could not be completed.",
          }),
    run = (res, fn, status = 200) => {
      try {
        const x = fn();
        return res
          .status(x.reusedResult ? 200 : status)
          .json({ success: true, ...x });
      } catch (e) {
        return handle(e, res);
      }
    };
  r.get("/websites/readiness", (_q, res) =>
    res.json({ success: true, ...service.readiness() }),
  );
  r.get("/websites/presets", (_q, res) =>
    res.json({ success: true, ...service.presets() }),
  );
  r.post("/websites", (q, s) =>
    run(
      s,
      () =>
        service.createProject(q.body, actor(q), q.headers["idempotency-key"]),
      201,
    ),
  );
  r.get("/websites", (q, s) =>
    run(s, () => service.listProjects(q.query, actor(q))),
  );
  r.get("/websites/:id", (q, s) =>
    run(s, () => service.getProject(q.params.id, actor(q))),
  );
  r.get("/websites/:id/visual-components", (q, s) =>
    run(s, () => service.visualCatalog(q.params.id, actor(q))),
  );
  r.post("/websites/:id/pages", (q, s) =>
    run(
      s,
      () =>
        service.createPage(
          q.params.id,
          q.body,
          actor(q),
          q.headers["idempotency-key"],
        ),
      201,
    ),
  );
  r.get("/websites/:id/pages", (q, s) =>
    run(s, () => service.listPages(q.params.id, actor(q))),
  );
  r.post("/websites/:id/pages/:pageId/sections/:sectionId/visual", (q, s) =>
    run(
      s,
      () =>
        service.changeSectionVisual(
          q.params.id,
          q.params.pageId,
          q.params.sectionId,
          q.body,
          actor(q),
          q.headers["idempotency-key"],
        ),
      201,
    ),
  );
  r.post(
    "/websites/:id/pages/:pageId/sections/:sectionId/visual-recommendation",
    (q, s) =>
      run(s, () =>
        service.visualRecommendation(
          q.params.id,
          q.params.pageId,
          q.params.sectionId,
          q.body,
          actor(q),
        ),
      ),
  );
  r.post("/website-pages/:id/blueprints", (q, s) =>
    run(
      s,
      () =>
        service.createBlueprint(
          q.params.id,
          q.body,
          actor(q),
          q.headers["idempotency-key"],
        ),
      201,
    ),
  );
  r.get("/website-pages/:id/blueprints", (q, s) =>
    run(s, () => service.listBlueprints(q.params.id, actor(q))),
  );
  r.post("/websites/:id/publish", (q, s) =>
    run(
      s,
      () =>
        service.publish(
          q.params.id,
          q.body,
          actor(q),
          q.headers["idempotency-key"],
        ),
      201,
    ),
  );
  return r;
}
