import { createSiteProjectRepository } from "./repositories/site-project-repository.mjs";
import { createSiteMediaRepository } from "./repositories/site-media-repository.mjs";
import { createSiteProjectService } from "./services/site-project-service.mjs";
import { createSiteDomainService } from "./services/site-domain-service.mjs";
import { createSiteMediaService } from "./services/site-media-service.mjs";
import { createSiteMediaStorageAdapter } from "./services/site-media-storage-adapter.mjs";
import { createSupabaseStorageService } from "./storage/supabase-storage-service.mjs";
import { createSiteProjectsRouter } from "./routes/site-projects.mjs";
import { createSiteStorageRouter } from "./routes/site-storage.mjs";
import { createSiteMediaRouter } from "./routes/site-media.mjs";

export function mountSiteBuilderControlPlane({ app, db, businessContextService, basePath = "/api" }) {
  const projectRepository = createSiteProjectRepository(db);
  const domainService = createSiteDomainService(db);
  const projectService = createSiteProjectService({
    repository: projectRepository,
    businessContextService,
    domainService,
  });

  const mediaRepository = createSiteMediaRepository(db);
  const mediaStorage = createSiteMediaStorageAdapter();
  const mediaService = createSiteMediaService({
    repository: mediaRepository,
    siteProjectService: projectService,
    storage: mediaStorage,
  });

  const mountPath = basePath || "/";
  app.use(mountPath, createSiteProjectsRouter({ service: projectService }));
  app.use(mountPath, createSiteStorageRouter({ storage: createSupabaseStorageService(), siteService: projectService }));
  app.use(mountPath, createSiteMediaRouter({ service: mediaService }));

  return Object.freeze({ projectService, mediaService });
}
