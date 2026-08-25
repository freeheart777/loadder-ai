import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dashboard=readFileSync(new URL("../../src/pages/DashboardPage.tsx",import.meta.url),"utf8");
const app=readFileSync(new URL("../../src/App.tsx",import.meta.url),"utf8");

test("mobile shell removes desktop offset and keeps desktop sidebar",()=>{
  assert.match(dashboard,/hidden h-screen w-\[260px\].*lg:flex/);
  assert.match(dashboard,/min-h-screen w-full lg:mr-\[260px\] lg:w-\[calc\(100%-260px\)\]/);
  assert.doesNotMatch(dashboard,/className="mr-\[260px\] min-h-screen"/);
});

test("mobile drawer is RTL-side, accessible, closable, and scroll-safe",()=>{
  for(const contract of [/aria-expanded=\{mobileMenuOpen\}/,/aria-controls="mobile-dashboard-navigation"/,/event\.key === "Escape"/,/document\.body\.style\.overflow = "hidden"/,/document\.body\.style\.overflow = previousOverflow/,/window\.addEventListener\("resize"/,/onClick=\{closeMobileMenu\}/,/inset-y-0 right-0/]) assert.match(dashboard,contract);
});

test("desktop and mobile reuse one controlled launch navigation source",()=>{
  assert.equal((dashboard.match(/<DashboardNavigation/g)||[]).length,2);
  for(const path of ["/dashboard","/dashboard/onboarding","/dashboard/growth","/dashboard/content","/dashboard/websites","/dashboard/landings","/dashboard/forms","/dashboard/crm","/dashboard/improvement"]) assert.match(dashboard,new RegExp(path.replaceAll("/","\\/")));
  assert.doesNotMatch(dashboard,/\/dashboard\/(catalog|integrations|domains)|\/store\/(cart|payment)|\/intelligence/);
});

test("workspace and logout remain available in both navigation modes",()=>{
  assert.match(dashboard,/<WorkspaceSelector/);
  assert.match(dashboard,/خروج از حساب/);
  assert.match(dashboard,/await logout\(\)/);
});

test("hidden production routes remain redirected by the controlled launch policy",()=>{
  for(const path of ["catalog","integrations","domains"]) assert.match(app,new RegExp(`path="/dashboard/${path}" element=\\{controlledLaunchEnabled \\? <Navigate`));
});
