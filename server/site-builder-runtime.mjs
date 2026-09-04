import express from "express";
import { db } from "./db/database.mjs";
import { createIdentityRepository } from "./app/repositories/identity-repository.mjs";
import { createBusinessContextRepository } from "./app/repositories/business-context-repository.mjs";
import { createBusinessContextService } from "./app/services/business-context-service.mjs";
import { mountSiteBuilderControlPlane } from "./app/site-builder-control-plane.mjs";

const router = express.Router();
const identityRepository = createIdentityRepository(db);
const businessContextService = createBusinessContextService({
  repository: createBusinessContextRepository(db),
  auditRepository: null,
});

mountSiteBuilderControlPlane({
  app: router,
  db,
  businessContextService,
  auditRepository: identityRepository,
  basePath: "/",
});

export default router;
