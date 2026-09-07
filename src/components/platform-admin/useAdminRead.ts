import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";

export function useAdminRead<T>(path:string|null, revision:number) {
  const [state,setState]=useState<{path:string|null;data:T|null;loading:boolean;error:string;denied:boolean;receivedAt:string|null}>({path:null,data:null,loading:true,error:"",denied:false,receivedAt:null});
  useEffect(()=>{
    const controller=new AbortController();
    let active=true;
    let timedOut=false;
    setState({path,data:null,loading:Boolean(path),error:"",denied:false,receivedAt:null});
    if (!path) return ()=>controller.abort();
    const timer=window.setTimeout(()=>{timedOut=true;controller.abort();},15000);
    void (async()=>{
      try {
        const response=await apiFetch(path,{signal:controller.signal,cache:"no-store"});
        if(response.status===401||response.status===403){if(active)setState({path,data:null,loading:false,error:"دسترسی توسط سرور رد شد.",denied:true,receivedAt:null});return;}
        if(!response.ok)throw new Error(`دریافت داده ناموفق بود (HTTP ${response.status}).`);
        const body=await response.json();
        if(body.success!==true||body.mode!=="read-only")throw new Error("پاسخ معتبر دریافت نشد.");
        if(active)setState({path,data:body,loading:false,error:"",denied:false,receivedAt:new Date().toISOString()});
      }catch(error){if(active)setState({path,data:null,loading:false,error:timedOut?"مهلت دریافت تمام شد.":error instanceof Error?error.message:"ارتباط برقرار نشد.",denied:false,receivedAt:null});}
      finally{window.clearTimeout(timer);}
    })();
    return ()=>{active=false;window.clearTimeout(timer);controller.abort();};
  },[path,revision]);
  return state.path===path?state:{...state,data:null,loading:true,error:"",denied:false};
}
