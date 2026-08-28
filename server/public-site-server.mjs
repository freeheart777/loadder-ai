import express from "express";
import { environment } from "./app/config/environment.mjs";
import { createSiteProjectRepository } from "./app/repositories/site-project-repository.mjs";
import { db } from "./db/workspace-database.mjs";
import { createPublicSitesRouter } from "./app/routes/public-sites.mjs";

const app = express();
const repository = createSiteProjectRepository(db);

app.disable("x-powered-by");
app.use(createPublicSitesRouter({ repository }));

const port = Number(process.env.PUBLIC_SITE_PORT || Number(environment.apiPort) + 1);
const host = process.env.PUBLIC_SITE_HOST || environment.apiHost;

app.listen(port, host, () => {
  console.log(`Loadder Public Site Runtime listening on http://${host}:${port}`);
});
