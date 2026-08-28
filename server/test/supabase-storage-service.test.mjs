import assert from "node:assert/strict";
import test from "node:test";
import { createSupabaseStorageService } from "../app/storage/supabase-storage-service.mjs";

test("storage service creates tenant-scoped signed upload URLs", async () => {
  const calls=[];
  const service=createSupabaseStorageService({
    projectUrl:"https://example.supabase.co",
    serviceRoleKey:"service-key",
    fetchImpl:async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify({url:"/object/upload/sign/site-assets/ws-1/project-1/logo.png?token=abc"}),{status:200});},
  });
  const result=await service.createUploadUrl({workspaceId:"ws-1",siteProjectId:"project-1",filename:"logo.png",contentType:"image/png"});
  assert.equal(result.bucket,"site-assets");
  assert.equal(result.path,"ws-1/project-1/logo.png");
  assert.equal(new URL(result.signedUrl).searchParams.get("token"),"abc");
  assert.equal(calls[0].options.headers.Authorization,"Bearer service-key");
});

test("storage service rejects traversal and can issue signed downloads", async () => {
  const service=createSupabaseStorageService({projectUrl:"https://example.supabase.co",serviceRoleKey:"service-key",fetchImpl:async()=>new Response(JSON.stringify({signedURL:"/object/sign/site-assets/ws-1/project-1/a.png?token=xyz"}),{status:200})});
  await assert.rejects(()=>service.createDownloadUrl({path:"ws-1/../other/a.png"}),/Storage path is invalid/);
  const result=await service.createDownloadUrl({path:"ws-1/project-1/a.png",expiresIn:600});
  assert.equal(new URL(result.signedUrl).searchParams.get("token"),"xyz");
});

test("unconfigured storage fails closed", async () => {
  const service=createSupabaseStorageService({projectUrl:null,serviceRoleKey:null});
  assert.equal(service.configured,false);
  await assert.rejects(()=>service.createUploadUrl({workspaceId:"ws",siteProjectId:"p",filename:"x.png"}),(error)=>error.code==="SITE_STORAGE_NOT_CONFIGURED");
});
