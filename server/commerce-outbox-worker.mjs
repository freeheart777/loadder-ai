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
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Commerce outbox worker received ${signal}; draining current batch`);
  try {
    await worker.shutdown();
    console.log("Commerce outbox worker drained and stopped");
  } catch (error) {
    console.error("Commerce outbox worker shutdown failed", error);
    process.exitCode = 1;
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
