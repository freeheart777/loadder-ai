import { useEffect, useMemo, useState } from "react";
import { MagnifyingGlass, Plus, Trash } from "@phosphor-icons/react";
import { apiFetch } from "../../lib/api";

type Field={id:string;type:string;required?:boolean;options?:string[];references?:string};
type Entity={id:string;name:string;fields:Field[]};
type Definition={id:string;name:string;entities:Entity[];workflows:Array<{id:string;name:string}>};
type Props={projectId:string;definition:Definition};

type RecordRow={id:string;createdAt?:string;updatedAt?:string;[key:string]:unknown};

function inputType(field:Field){
  if(field.type==="email")return "email";
  if(field.type==="date")return "date";
  if(field.type==="datetime")return "datetime-local";
  if(["integer","decimal","money"].includes(field.type))return "number";
  return "text";
}

export default function GeneratedAppRuntime({projectId,definition}:Props){
  const [entityId,setEntityId]=useState(definition.entities[0]?.id||"");
  const [records,setRecords]=useState<RecordRow[]>([]);
  const [query,setQuery]=useState("");
  const [form,setForm]=useState<Record<string,unknown>>({});
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const entity=useMemo(()=>definition.entities.find(x=>x.id===entityId)||definition.entities[0],[definition,entityId]);
  const visible=useMemo(()=>!query.trim()?records:records.filter(r=>JSON.stringify(r).toLowerCase().includes(query.toLowerCase())),[records,query]);

  async function load(){
    if(!entity)return;
    const r=await apiFetch(`/api/business-builder/projects/${projectId}/data/${entity.id}`);
    const b=await r.json();
    if(r.ok&&b.success)setRecords(b.records||[]);
  }
  useEffect(()=>{setForm({});load().catch(()=>{});},[entity?.id,projectId]);

  async function create(){
    if(!entity)return; setBusy(true); setMessage("");
    try{
      const payload:Object=Object.fromEntries(Object.entries(form).filter(([,v])=>v!==""&&v!==undefined));
      const r=await apiFetch(`/api/business-builder/projects/${projectId}/data/${entity.id}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const b=await r.json(); if(!r.ok||!b.success)throw new Error(b.message||"ثبت رکورد ناموفق بود."); setForm({}); await load(); setMessage("رکورد ثبت شد.");
    }catch(e){setMessage(e instanceof Error?e.message:"خطا");}finally{setBusy(false);}
  }
  async function remove(id:string){if(!entity)return;await apiFetch(`/api/business-builder/projects/${projectId}/data/${entity.id}/${id}`,{method:"DELETE"});await load();}
  async function runWorkflow(workflowId:string){
    const r=await apiFetch(`/api/business-builder/projects/${projectId}/workflows/${workflowId}/run`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({entityId})});
    const b=await r.json(); setMessage(r.ok&&b.success?`Workflow اجرا شد: ${b.result.status}`:(b.message||"اجرای Workflow ناموفق بود."));
  }

  if(!entity)return <div className="rounded-2xl border border-white/10 p-5 text-white/40">هیچ Entity برای اجرا وجود ندارد.</div>;
  return <div className="grid gap-4 xl:grid-cols-[220px_1fr_320px]">
    <aside className="rounded-2xl border border-white/10 bg-black/20 p-3"><p className="px-2 py-2 text-xs text-white/35">داده‌های اپ</p>{definition.entities.map(x=><button key={x.id} onClick={()=>setEntityId(x.id)} className={`mb-1 w-full rounded-lg px-3 py-2 text-right text-sm ${entity.id===x.id?"bg-white/10 text-white":"text-white/55 hover:bg-white/5"}`}>{x.name}</button>)}<div className="mt-5 border-t border-white/10 pt-3"><p className="px-2 pb-2 text-xs text-white/35">Workflowها</p>{definition.workflows.map(w=><button key={w.id} onClick={()=>runWorkflow(w.id)} className="mb-1 w-full rounded-lg border border-white/8 px-3 py-2 text-right text-xs text-white/55 hover:bg-white/5">{w.name}</button>)}</div></aside>
    <section className="rounded-2xl border border-white/10 bg-black/15 p-4"><div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-xs text-white/35">Live entity</p><h3 className="text-xl font-medium">{entity.name}</h3></div><div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3"><MagnifyingGlass size={15} className="text-white/35"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="جست‌وجو" className="w-40 bg-transparent py-2 text-sm outline-none"/></div></div><div className="overflow-auto"><table className="w-full min-w-[620px] text-sm"><thead><tr className="border-b border-white/10 text-white/40">{entity.fields.map(f=><th key={f.id} className="px-3 py-3 text-right font-normal">{f.id}</th>)}<th className="px-3 py-3"></th></tr></thead><tbody>{visible.map(row=><tr key={row.id} className="border-b border-white/5">{entity.fields.map(f=><td key={f.id} className="max-w-48 truncate px-3 py-3 text-white/70">{String(row[f.id]??"—")}</td>)}<td className="px-3 py-3"><button onClick={()=>remove(row.id)} className="text-white/30 hover:text-red-300"><Trash size={16}/></button></td></tr>)}</tbody></table>{!visible.length&&<div className="py-14 text-center text-sm text-white/30">هنوز داده‌ای ثبت نشده است.</div>}</div></section>
    <aside className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"><div className="mb-4 flex items-center gap-2"><Plus size={16}/><h3 className="font-medium">رکورد جدید</h3></div><div className="space-y-3">{entity.fields.filter(f=>f.type!=="reference").map(field=><label key={field.id} className="block"><span className="mb-1 block text-xs text-white/45">{field.id}{field.required?" *":""}</span>{field.type==="enum"?<select value={String(form[field.id]??"")} onChange={e=>setForm(v=>({...v,[field.id]:e.target.value}))} className="w-full rounded-xl border border-white/10 bg-[#0b0c0f] px-3 py-2 text-sm"><option value="">انتخاب</option>{field.options?.map(o=><option key={o} value={o}>{o}</option>)}</select>:field.type==="boolean"?<input type="checkbox" checked={Boolean(form[field.id])} onChange={e=>setForm(v=>({...v,[field.id]:e.target.checked}))}/>:<input type={inputType(field)} value={String(form[field.id]??"")} onChange={e=>setForm(v=>({...v,[field.id]:["integer","decimal","money"].includes(field.type)&&e.target.value!==""?Number(e.target.value):e.target.value}))} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"/>}</label>)}</div><button disabled={busy} onClick={create} className="mt-5 w-full rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-40">{busy?"در حال ثبت...":"ثبت رکورد"}</button>{message&&<p className="mt-3 text-xs leading-5 text-white/50">{message}</p>}</aside>
  </div>;
}
