// Test-only preload: records every route the real server mounts (method + full path) so boundary
// tests can probe the actual surface instead of a hand-maintained list. Writes the inventory to
// $ROUTE_INVENTORY_FILE once the process is listening. Never imported by application code.
import express from "express";
import fs from "node:fs";

const Router = express.Router.prototype;
const mounts = new Map();   // child router -> { parent, prefix }
const routes = [];          // { router, path, route }

const origUse = Router.use;
Router.use = function patchedUse(...args) {
  const prefix = typeof args[0] === "string" ? args[0] : "/";
  for (const fn of args) if (fn && typeof fn === "function" && Array.isArray(fn.stack)) mounts.set(fn, { parent: this, prefix });
  return origUse.apply(this, args);
};
const origRoute = Router.route;
Router.route = function patchedRoute(path) {
  const route = origRoute.call(this, path);
  routes.push({ router: this, path: String(path), route });
  return route;
};

const join = (a, b) => `${a}/${b}`.replace(/\/+/g, "/").replace(/(.)\/$/, "$1");
function fullPath(router, path) {
  let p = path, cur = router, guard = 0;
  while (mounts.has(cur) && guard++ < 20) { const m = mounts.get(cur); p = join(m.prefix, p); cur = m.parent; }
  return p;
}

const origListen = express.application.listen;
express.application.listen = function patchedListen(...args) {
  const out = routes.flatMap(({ router, path, route }) => Object.keys(route.methods || {}).filter((m) => m !== "_all").map((m) => ({ method: m.toUpperCase(), path: fullPath(router, path) })));
  if (process.env.ROUTE_INVENTORY_FILE) fs.writeFileSync(process.env.ROUTE_INVENTORY_FILE, JSON.stringify(out));
  return origListen.apply(this, args);
};
