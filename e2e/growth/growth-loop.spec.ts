import { expect, request, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';
import { execFileSync } from 'node:child_process';

const apiBaseURL=process.env.E2E_API_BASE_URL,dbPath=process.env.E2E_DATABASE_PATH;
if(!apiBaseURL||!dbPath)throw Error('Growth E2E URLs/database are required');
let api:APIRequestContext,workspaceId='',experimentId='',candidateId='',leadId='',authCookies:Awaited<ReturnType<APIRequestContext['storageState']>>['cookies']=[];
const observe=(page:Page)=>{const network:{status:number;url:string}[]=[],errors:string[]=[];page.on('response',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))network.push({status:r.status(),url:r.url()});});page.on('pageerror',e=>errors.push(e.message));return{network,errors};};
async function json(response:Awaited<ReturnType<APIRequestContext['get']>>){const body=await response.json();expect(response.ok(),JSON.stringify(body)).toBeTruthy();return body;}

test.describe.serial('human-governed Growth Loop',()=>{
 test.beforeAll(async({},info)=>{
  api=await request.newContext({baseURL:apiBaseURL});const mobile=`090${String(Date.now()+info.workerIndex).slice(-8)}`;
  const otp=await json(await api.post('/api/auth/send-otp',{data:{mobile,name:'Growth Loop E2E'}}));
  const auth=await json(await api.post('/api/auth/verify-otp',{data:{mobile,code:otp.developmentOtp}}));
  const membership=auth.memberships.find((x:{workspace:{id:string}})=>x.workspace.id===auth.activeWorkspace.id);
  workspaceId=auth.activeWorkspace.id;const output=execFileSync(process.execPath,['e2e/growth/seed-growth-loop.mjs',workspaceId,auth.user.id,membership.id],{cwd:process.cwd(),env:{...process.env,DATABASE_PATH:dbPath},encoding:'utf8'}).trim().split('\n').at(-1)!;
  ({experimentId,candidateId,leadId}=JSON.parse(output));authCookies=(await api.storageState()).cookies;
 });
 test.afterAll(async()=>api?.dispose());
 test('completes canonical evidence, assessment and adoption without execution, then reloads',async({page},info)=>{
  test.setTimeout(60_000);const evidence=observe(page);await page.setViewportSize({width:390,height:844});await page.context().addCookies(authCookies);
  await page.goto(`/dashboard/growth-loop/${experimentId}`);await expect(page.getByRole('heading',{name:'چرخهٔ رشد قابل توضیح'})).toBeVisible();
  await expect(page.getByText('نامشخص').first()).toBeVisible();await page.getByRole('button',{name:'خواندن شواهد موجود'}).click();await expect(page.getByText('نامشخص').last()).toBeVisible();
  await page.getByLabel('شناسه سرنخ در CRM').fill(leadId);await page.getByRole('button',{name:'ثبت تبدیل در CRM'}).click();await expect(page.getByText('مشاهده‌شده')).toBeVisible();
  await page.getByRole('button',{name:'ارزیابی شواهد'}).click();await expect(page.getByText('شواهد ناکافی')).toBeVisible();await expect(page.getByText('خط مبنا معتبر یا قابل مقایسه نیست')).toBeVisible();
  await page.getByRole('button',{name:'پذیرش برای بررسی'}).click();await expect(page.getByText('پیشنهاد پذیرفته شد؛ هیچ اقدام خارجی هنوز اجرا نشده است.')).toBeVisible();
  await page.reload();await expect(page.getByText('پیشنهاد پذیرفته شد؛ هیچ اقدام خارجی هنوز اجرا نشده است.')).toBeVisible();
  const duplicate=await json(await api.post(`/api/growth/leads/${leadId}/convert`,{data:{candidateId,experimentId,contextVersionId:(await json(await api.get(`/api/experiments/${experimentId}`))).experiment.goalContextVersionId,goalRef:'/strategy/goals/0',idempotencyKey:`growth-ui-convert:${leadId}`}}));expect(duplicate.result.duplicate).toBe(true);
  const counts=JSON.parse(execFileSync(process.execPath,['e2e/growth/seed-growth-loop.mjs','inspect',workspaceId,candidateId,leadId],{cwd:process.cwd(),env:{...process.env,DATABASE_PATH:dbPath},encoding:'utf8'}).trim().split('\n').at(-1)!);expect(counts).toEqual({events:1,evidence:1,financial:0});
  expect(evidence.errors).toEqual([]);expect(evidence.network.filter(x=>x.status>=400)).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await info.attach('growth-network.json',{body:Buffer.from(JSON.stringify(evidence.network,null,2)),contentType:'application/json'});
 });
});
