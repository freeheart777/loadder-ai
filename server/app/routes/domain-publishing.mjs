import express from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { DomainPublishingError } from "../services/domain-publishing-service.mjs";

const actor = (request) => ({ userId: request.user.id, role: request.membership.role, workspaceId: request.workspace.id });
const handle = (error, response) => response.status(error instanceof DomainPublishingError ? error.status : 500).json({ success: false, code: error instanceof DomainPublishingError ? error.code : "DOMAIN_OPERATION_FAILED", message: "Domain publishing operation could not be completed." });
const run = async (response, operation, status = 200) => { try { const result = await operation(); return response.status(result?.reusedResult ? 200 : status).json({ success: true, ...result }); } catch (error) { return handle(error, response); } };
const limiter = (max, keyGenerator) => rateLimit({ windowMs: 60000, max, standardHeaders: true, legacyHeaders: false, keyGenerator, handler: (_request, response) => response.status(429).json({ success: false, code: "DOMAIN_RATE_LIMITED", message: "Domain publishing request limit exceeded." }) });

export function createDomainPublishingRouter({ service }) {
  const router = express.Router(), mutationLimit = limiter(20, (request) => `${request.workspace.id}:${ipKeyGenerator(request.ip)}`), verifyLimit = limiter(10, (request) => `${request.workspace.id}:${request.params.id}:${ipKeyGenerator(request.ip)}`);
  router.get("/domains/readiness", (_request, response) => response.json({ success: true, ...service.readiness() }));
  router.get("/domains", (request, response) => run(response, () => service.list(actor(request))));
  router.post("/domains", mutationLimit, (request, response) => run(response, () => service.addDomain(request.body, actor(request), request.headers["idempotency-key"]), 201));
  router.post("/domains/:id/verify", verifyLimit, (request, response) => run(response, () => service.verify(request.params.id, actor(request))));
  router.post("/domains/:id/tls/recheck", verifyLimit, (request, response) => run(response, () => service.refreshTls(request.params.id, actor(request))));
  router.post("/domains/:id/verification/rotate", verifyLimit, (request, response) => run(response, () => service.rotateVerification(request.params.id, actor(request))));
  router.post("/domains/:id/disable", mutationLimit, (request, response) => run(response, () => service.disable(request.params.id, actor(request))));
  router.post("/domains/:id/bindings", mutationLimit, (request, response) => run(response, () => service.createBinding(request.params.id, request.body, actor(request)), 201));
  router.post("/domain-bindings/:id/publish", mutationLimit, (request, response) => run(response, () => service.publish(request.params.id, request.body, actor(request)), 201));
  router.post("/domain-bindings/:id/rollback", mutationLimit, (request, response) => run(response, () => service.rollback(request.params.id, request.body, actor(request)), 201));
  router.get("/domain-bindings/:id/history", (request, response) => run(response, () => service.history(request.params.id, actor(request))));
  router.post("/content-assets/:id/publish", mutationLimit, (request, response) => run(response, () => service.publishAsset(request.params.id, actor(request)), 201));
  return router;
}

export function createPublicHostRouter({ service }) {
  const router = express.Router(), misses = limiter(120, (request) => ipKeyGenerator(request.ip));
  router.use(misses, (request, response, next) => { const host = request.headers.host, artifact = service.resolve(host, request.path); if (!artifact) { if (request.path.startsWith("/api/")) return next(); return response.status(404).set("Cache-Control", "public,max-age=30").json({ success: false, code: "PUBLICATION_NOT_FOUND", message: "Published experience was not found." }); } return response.status(200).set("Content-Type", artifact.contentType).set("X-Content-Type-Options", "nosniff").set("Content-Security-Policy", artifact.csp || "default-src 'none'; style-src 'unsafe-inline'; img-src https:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'").set("Cache-Control", "public,max-age=300").send(artifact.body); });
  return router;
}
