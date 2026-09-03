import { getCommercialBuilderCatalog } from "./commercial-catalog.mjs";

const normalize=(value)=>String(value||"").toLowerCase();

function recommendCatalog(goal){
  const {catalog}=getCommercialBuilderCatalog();
  const q=normalize(goal);
  const scored=catalog.map(item=>{
    const hay=[item.id,item.category,item.title,...(item.examples||[])].join(" ").toLowerCase();
    const terms=q.split(/\s+/).filter(Boolean);
    const score=terms.reduce((s,t)=>s+(hay.includes(t)?1:0),0);
    return {item,score};
  }).sort((a,b)=>b.score-a.score);
  return scored.filter(x=>x.score>0).slice(0,3).map(x=>x.item);
}

export function navigateLoadder({goal="",screen="builder",project=null}={}){
  const recommendations=recommendCatalog(goal);
  const steps=[];
  if(screen==="builder"){
    if(!project)steps.push({id:"describe",title:"نیازت را در یک جمله بنویس",action:"focus-intent"});
    else steps.push({id:"preview",title:"پیش‌نمایش را بررسی کن",action:"open-preview"},{id:"edit",title:"اگر لازم است ظاهر را از پنل کنار ویرایش کن",action:"open-visual-editor"},{id:"live",title:"اپ زنده را با داده واقعی تست کن",action:"open-live-app"});
  } else if(screen==="live-app"){
    steps.push({id:"data",title:"اول چند رکورد واقعی وارد کن",action:"create-record"},{id:"workflow",title:"Workflowهای اصلی را اجرا و نتیجه را بررسی کن",action:"test-workflow"},{id:"approval",title:"قبل از انتشار Gateهای تایید را کامل کن",action:"open-approval"});
  } else if(screen==="deploy"){
    steps.push({id:"gates",title:"Gateهای امنیت، تست و تایید را کامل کن",action:"check-readiness"});
  }
  return Object.freeze({mode:"deterministic",tokenCost:0,recommendations,steps,aiRequired:false});
}
