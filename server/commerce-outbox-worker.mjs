import { db } from "./db/database.mjs";
import { createBusinessBuilderRepository } from "./app/repositories/business-builder-repository.mjs";
import { createBusinessBuilderProjectService } from "./app/business-builder/project-service.mjs";
import { createCommerceOutboxWorker } from "./app/business-builder/commerce-outbox-worker.mjs";

const repository = createBusinessBuilderRepository(db);
const projects = createBusinessBuilderProjectService({ repository });
const worker = createCommerceOutboxWorker({
  db,
  projects,
  intervalMs: Number(process.env.COMMERCE_OUTBOX_POLL_MS || 1000),
  batchSize: Number(process.env.COMMERCE_OUTBOX_BATCH_SIZE || 50),
});

worker.start();
console.log("Commerce outbox worker started");

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  worker.stop();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
