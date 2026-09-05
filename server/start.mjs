import { spawn } from "node:child_process";
import { createProcessSupervisor } from "./process-supervisor.mjs";

const children = [
  { name: "api", child: spawn(process.execPath, ["--import", "./http-upload-limit-preload.mjs", "index.mjs"], { stdio: "inherit", env: process.env }) },
  { name: "public-site", child: spawn(process.execPath, ["public-site-server.mjs"], { stdio: "inherit", env: process.env }) },
  { name: "commerce-outbox-worker", child: spawn(process.execPath, ["commerce-outbox-worker.mjs"], { stdio: "inherit", env: process.env }) },
];

const supervisor = createProcessSupervisor({
  children,
  shutdownGraceMs: Number(process.env.PROCESS_SHUTDOWN_GRACE_MS || 30_000),
});

process.on("SIGINT", () => supervisor.shutdown("SIGINT"));
process.on("SIGTERM", () => supervisor.shutdown("SIGTERM"));
