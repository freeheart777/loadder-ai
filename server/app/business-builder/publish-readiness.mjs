import { validateLoadderAppDefinition } from "./loadder-app-schema.mjs";

const check=(id,label,ok,detail=null)=>({id,label,ok,detail});
export function evaluatePublishReadiness({version,productionApproved=false,providerConfigured=false}){
  const checks=[];
  let definitionValid=false;
  try{validateLoadderAppDefinition(version?.definition);definitionValid=true;}catch(error){checks.push(check("definition","تعریف اپ معتبر است",false,error?.details||[error?.message]));}
  if(definitionValid)checks.push(check("definition","تعریف اپ معتبر است",true));
  const ui=version?.ui;
  const uiContract=ui?.renderContract||ui?.contract;
  const uiValid=!!ui&&typeof ui==="object"&&uiContract==="loadder.ui.v1"&&ui.appId===version?.definition?.id&&Array.isArray(ui.views)&&ui.views.length>0;
  checks.push(check("ui-contract","قرارداد رابط کاربری معتبر و متعلق به همین اپ است",uiValid,uiValid?null:"UI renderContract/appId/views invalid"));
  const bundle=version?.bundle;
  const portable=!!bundle&&typeof bundle==="object"&&bundle.contract==="loadder.source-bundle.v1"&&bundle.appId===version?.definition?.id&&bundle.portable===true&&!!bundle.manifest&&Array.isArray(bundle.files)&&bundle.files.some(f=>f.path==="app.definition.json")&&bundle.files.some(f=>f.path==="ui.definition.json");
  checks.push(check("portable-bundle","باندل مستقل و قابل خروج موجود است",portable,portable?null:"Loadder source bundle is missing or mismatched"));
  const hasAdmin=Array.isArray(version?.definition?.roles)&&version.definition.roles.some(role=>role.id==="admin");
  checks.push(check("admin-role","نقش مدیر وجود دارد",hasAdmin));
  checks.push(check("production-approval","تأیید انسانی Production ثبت شده",!!productionApproved));
  checks.push(check("deploy-provider","آداپتور استقرار Production تنظیم شده",!!providerConfigured));
  const blockers=checks.filter(item=>!item.ok);
  return {ready:blockers.length===0,status:blockers.length===0?"ready":"blocked",checks,blockers:blockers.map(({id,label,detail})=>({id,label,detail})),versionId:version?.id||null};
}
