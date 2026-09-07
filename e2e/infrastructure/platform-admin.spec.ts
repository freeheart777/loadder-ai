import { test, expect } from "@playwright/test";
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
test.use({channel:process.env.E2E_USE_INSTALLED_CHROME==="1"?"chrome":undefined});

let directory:string;
let backend:ChildProcess;
let frontend:ChildProcess;
const api="http://127.0.0.1:3297";
const web="http://127.0.0.1:4297";
test.beforeAll(async()=>{
  directory=mkdtempSync(join(tmpdir(),"loadder-admin-e2e-"));
  execFileSync(process.execPath,["--input-type=module","-e",`
    import {db} from './server/db/database.mjs';
    import {runMigrations} from './server/db/migrate.mjs';
    import {createHash} from 'node:crypto';
    runMigrations(db);
    const now=new Date().toISOString();
    for(let i=0;i<28;i++){
      const id='admin-fixture-'+String(i).padStart(2,'0');
      db.prepare('INSERT INTO users (id,mobile,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?)').run(id,'09000000'+String(i).padStart(3,'0'),'کاربر تست '+i,'active',now,now);
      db.prepare('INSERT INTO workspaces (id,name,slug,status,created_at,updated_at) VALUES (?,?,?,?,?,?)').run(id,'فضای تست '+i,id,'active',now,now);
    }
    for(const [token,id] of [['admin-browser','admin-fixture-00'],['owner-browser','admin-fixture-01']]){
      db.prepare('INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at,last_seen_at) VALUES (?,?,?,?,?,?)').run(token,id,createHash('sha256').update(token).digest('hex'),new Date(Date.now()+3600000).toISOString(),now,now);
    }
    db.close();
  `],{env:{...process.env,DATABASE_PATH:join(directory,"test.sqlite")}});
  backend=spawn(process.execPath,["server/index.mjs"],{env:{...process.env,NODE_ENV:"test",DATABASE_PATH:join(directory,"test.sqlite"),SITE_MEDIA_LOCAL_DIR:join(directory,"media"),API_HOST:"127.0.0.1",API_PORT:"3297",AUTH_HASH_SECRET:"isolated-admin-e2e-secret",CLIENT_ORIGINS:web,LOADDER_PLATFORM_ADMIN_GRANTS:'{"admin-fixture-00":["platform_support"]}'},stdio:"ignore"});
  frontend=spawn("node_modules/.bin/vite",["--host","127.0.0.1","--port","4297","--strictPort"],{env:{...process.env,VITE_API_BASE_URL:api},stdio:"ignore"});
  await expect.poll(async()=>{try{return (await fetch(api+"/api/health")).ok&&(await fetch(web)).ok;}catch{return false;}},{timeout:20000}).toBe(true);
});
test.afterAll(async()=>{
  for(const child of [frontend,backend])if(child&&child.exitCode===null){const closed=new Promise(resolve=>child.once("exit",resolve));child.kill();await closed;}
  if(directory)rmSync(directory,{recursive:true,force:true});
});
test("real admin inventory, pagination, RTL, denied and recovery states",async({page,context})=>{
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await context.addCookies([{name:"loadder_session",value:"admin-browser",url:web}]);
  await page.goto(web+"/dashboard/platform-admin");
  await expect(page.getByRole("heading",{name:"مرکز فرمان پلتفرم"})).toBeVisible();
  await expect(page.getByLabel("آمار ثبت‌شده")).toContainText("۲۸");
  await expect(page.getByLabel("وضعیت شواهد عملیاتی")).toContainText("نامشخص");
  await page.getByRole("button",{name:"کاربران",exact:true}).click();
  await expect(page.getByRole("table")).toContainText("admin-fixture-00");
  await expect(page.getByText(/زمان آخرین ورود نیست/)).toBeVisible();
  await page.getByRole("button",{name:"صفحه بعد"}).click();
  await expect(page.getByRole("table")).toContainText("admin-fixture-25");
  await page.getByRole("button",{name:"فضاهای کاری",exact:true}).click();
  await expect(page.getByRole("table")).toContainText("فضای تست 0");
  await page.setViewportSize({width:390,height:844});
  expect(await page.locator("main").getAttribute("dir")).toBe("rtl");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  let release!:()=>void;
  const held=new Promise<void>(resolve=>{release=resolve;});
  await page.route("**/api/platform-admin/workspaces?*",async route=>{await held;await route.continue();});
  await page.getByRole("button",{name:"تازه‌سازی داده‌ها"}).click();
  await expect(page.getByRole("status")).toContainText("در حال دریافت");
  release();
  await expect(page.getByRole("table")).toBeVisible();
  await page.unroute("**/api/platform-admin/workspaces?*");
  // Transport failure injection only; successful data always comes from the real API.
  await page.route("**/api/platform-admin/workspaces?*",route=>route.abort());
  await page.getByRole("button",{name:"تازه‌سازی داده‌ها"}).click();
  await expect(page.getByRole("alert")).toContainText("دریافت داده متوقف شد");
  await expect(page.getByRole("table")).toHaveCount(0);
  await page.unroute("**/api/platform-admin/workspaces?*");
  await page.getByRole("button",{name:"تلاش دوباره"}).click();
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByRole("button",{name:"صفحه بعد"}).click();
  await expect(page.getByRole("button",{name:"صفحه قبل"})).toBeEnabled();
  // Remove only test-owned fixture rows to exercise a genuinely empty later page.
  execFileSync(process.execPath,["--input-type=module","-e",`
    import Database from './server/node_modules/better-sqlite3/lib/index.js';
    const db=new Database(process.env.TEST_DB);
    db.prepare("DELETE FROM workspaces WHERE id LIKE 'admin-fixture-%'").run();db.close();
  `],{env:{...process.env,TEST_DB:join(directory,"test.sqlite")}});
  await page.getByRole("button",{name:"تازه‌سازی داده‌ها"}).click();
  await expect(page.getByRole("status")).toContainText("رکوردی وجود ندارد");
  await context.addCookies([{name:"loadder_session",value:"owner-browser",url:web}]);
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("دسترسی مجاز نیست");
  await expect(page.getByRole("table")).toHaveCount(0);
  expect(errors).toEqual([]);
});
