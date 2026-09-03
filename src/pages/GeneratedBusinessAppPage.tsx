import { useEffect, useState } from "react";
import { ArrowLeft, Cube, Sparkle } from "@phosphor-icons/react";
import { Link, useParams } from "react-router-dom";
import GeneratedAppRuntime from "../components/business-builder/GeneratedAppRuntime";
import { apiFetch } from "../lib/api";

type Project={id:string;name:string;activeVersionId:string|null;versions:Array<{id:string;definition:{id:string;name:string;entities:any[];workflows:any[]}}>};

export default function GeneratedBusinessAppPage(){
  const {projectId=""}=useParams();
  const [project,setProject]=useState<Project|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
  useEffect(()=>{(async()=>{try{const r=await apiFetch(`/api/business-builder/projects/${projectId}`);const b=await r.json();if(!r.ok||!b.success)throw new Error("اپلیکیشن پیدا نشد.");setProject(b.project);}catch(e){setError(e instanceof Error?e.message:"خطا");}finally{setLoading(false);}})();},[projectId]);
  const version=project?.versions?.find(v=>v.id===project.activeVersionId);
  return <main dir="rtl" className="min-h-screen bg-[#08090b] text-white"><div className="mx-auto max-w-[1700px] px-5 py-6 lg:px-10"><header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5"><div><div className="mb-2 flex items-center gap-2 text-xs text-white/40"><Sparkle size={14}/> LOADDER GENERATED APPLICATION / LIVE RUNTIME</div><h1 className="text-2xl font-semibold lg:text-4xl">{project?.name||"اپلیکیشن لودر"}</h1></div><Link to="/dashboard/business-builder" className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-white/65 hover:bg-white/5"><ArrowLeft size={16}/>بازگشت به سازنده</Link></header>{loading?<div className="py-24 text-center text-white/35">در حال بارگذاری Runtime...</div>:error?<div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-5 text-red-200">{error}</div>:!version?<div className="flex min-h-[500px] flex-col items-center justify-center text-white/35"><Cube size={48}/><p className="mt-4">نسخه فعال برای این اپ وجود ندارد.</p></div>:<GeneratedAppRuntime projectId={projectId} definition={version.definition}/>}</div></main>;
}
