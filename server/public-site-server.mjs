import express from "express";
import { environment } from "./app/config/environment.mjs";
import { createSiteProjectRepository } from "./app/repositories/site-project-repository.mjs";
import { db } from "./db/workspace-database.mjs";
import { createPublicSitesRouter } from "./app/routes/public-sites.mjs";
import { createEcommerceService } from "./app/services/ecommerce-service.mjs";

const app = express();
const repository = createSiteProjectRepository(db);

app.disable("x-powered-by");
// Lazy: no ecommerce service at startup; created on the first STORE request.
app.use(createPublicSitesRouter({ repository, createEcommerceService: () => createEcommerceService({ db }) }));

const { publicSitePort: port, publicSiteHost: host, publicSiteBaseUrl } = environment;

app.listen(port, host, (error) => {
  // Express 5 reports listen errors here; never claim to be running without a port.
  if (error) {
    console.error(`Loadder Public Site Runtime could not listen on http://${host}:${port}: ${error.code || error.message}. Another process is probably using the port; stop it and start again.`);
    process.exit(1);
  }
  console.log(`Loadder Public Site Runtime listening on http://${host}:${port} (public base URL ${publicSiteBaseUrl})`);
});
