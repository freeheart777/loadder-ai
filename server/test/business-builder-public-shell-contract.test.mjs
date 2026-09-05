import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("public app exposure is feature gated and isolated from management auth", () => {
  const auth = read("../app/routes/auth.mjs");
  const app = read("../../src/App.tsx");
  const page = read("../../src/pages/PublicBusinessAppPage.tsx");

  assert.match(auth, /BUSINESS_BUILDER_PUBLIC_APPS_ENABLED===\"true\"/);
  assert.match(auth, /router\.use\(createPublicBusinessAppRouter\(\{db\}\)\)/);

  const publicRoute = app.search(/path=\"\/app\/:projectId\"/);
  const protectedRoute = app.search(/element=\{<RequireAuth\s*\/>\}/);
  assert.ok(
    publicRoute >= 0 && protectedRoute > publicRoute,
    "public customer shell must stay outside management RequireAuth",
  );

  assert.match(page, /credentials:\"omit\"/);
  assert.match(page, /sessionStorage\.getItem/);
  assert.match(page, /sessionStorage\.setItem/);
  assert.doesNotMatch(page, /localStorage/);
  assert.match(page, /\/api\/auth\/public\/apps\//);
});
