import { spawn } from "node:child_process";

const children = [
  spawn(process.execPath, ["index.mjs"], { stdio: "inherit", env: process.env }),
  spawn(process.execPath, ["public-site-server.mjs"], { stdio: "inherit", env: process.env }),
];

let shuttingDown = false;
const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill(signal);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

for (const child of children) {
  child.on("exit", (code, signal) => {
    if (!shuttingDown && (code ?? 0) !== 0) {
      shutdown("SIGTERM");
      process.exitCode = code ?? 1;
    }
    if (shuttingDown && children.every((candidate) => candidate.exitCode !== null)) {
      process.exit(process.exitCode ?? 0);
    }
  });
}
