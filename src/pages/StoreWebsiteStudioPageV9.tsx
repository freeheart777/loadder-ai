import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Trash, UploadSimple } from "@phosphor-icons/react";
import StoreWebsiteStudioPageV8 from "./StoreWebsiteStudioPageV8";
import { apiFetch } from "../lib/api";

type Project={id:string;content:Record<string,unknown>};
type ManualProduct={id:string;title:string;description:string;price:string;buttonText:string;imageUrl:string};

const seedProduct=(n:number):ManualProduct=>({id:`manual-product-${Date.now()}-${n}`,title:`محصول ${n}`,description:"توضیح کوتاه محصول را اینجا بنویسید.",price:"۰ تومان",buttonText:"افزودن به سبد",imageUrl:""});
async function readJson(r:Response){const t=await r.text();return t?JSON.parse(t):{}}

export default function StoreWebsiteStudioPageV9(){
  const [project,setProject]=useState<Project|null>(null);
  const [items,setItems]=useState<ManualProduct[]>([seedProduct(1)]);
  const [target,setTarget]=useState<HTMLElement|null>(null);
  const [message,setMessage]=useState("");
  const [open,setOpen]=useState(true);
  const fileRef=useRef<HTMLInputElement>(null);
  const pendingId=useRef<string|null>(null);

  useEffect(()=>{void load();},[]);
  useEffect(()=>{
    const locate=()=>{
      const canvas=[...document.querySelectorAll("section")].find(el=>el.className.includes("bg-[#252c38]"));
      const inner=canvas?.querySelector(":scope > div") as HTMLElement|null;
      if(inner)setTarget(inner);
    };
    locate();
    const observer=new MutationObserver(locate);
    observer.observe(document.body,{subtree:true,childList:true});
    return()=>observer.disconnect();
  },[]);

  async function load(){
    try{
      const rp=await apiFetch("/api/site-projects");
      const pd=await readJson(rp);
      const p=(pd.projects||[]).find((x:any)=>String(x.siteType).toUpperCase()==="STORE")||pd.projects?.[0];
      if(!p)return;
      const rr=await apiFetch(`/api/site-projects/${p.id}`);
      const rd=await readJson(rr);
      if(!rr.ok)return;
      setProject(rd.project);
      const saved=rd.project?.content?.manualProductBlocksV9 as ManualProduct[]|undefined;
      if(Array.isArray(saved)&&saved.length)setItems(saved);
    }catch{}
  }

  async function save(){
    if(!project)return setMessage("پروژه هنوز آماده نیست");
    try{
      const r=await apiFetch(`/api/site-projects/${project.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({content:{...project.content,manualProductBlocksV9:items}})});
      const d=await readJson(r);
      if(!r.ok)throw new Error(d.message||"ذخیره نشد");
      setProject(d.project);
      setMessage("محصولات روی پروژه ذخیره شدند");
    }catch(e){setMessage(e instanceof Error?e.message:"خطا در ذخیره")}
  }

  function add(){setItems(x=>[...x,seedProduct(x.length+1)])}
  function update(id:string,patch:Partial<ManualProduct>){setItems(x=>x.map(p=>p.id===id?{...p,...patch}:p))}
  function remove(id:string){setItems(x=>x.filter(p=>p.id!==id))}
  function pick(id:string){pendingId.current=id;fileRef.current?.click()}
  async function onFile(file:File){
    if(!file.type.startsWith("image/"))return setMessage("فقط فایل تصویری انتخاب کن");
    if(file.size>3*1024*1024)return setMessage("حداکثر حجم تصویر ۳ مگابایت است");
    const url=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(new Error("خواندن تصویر ناموفق بود"));r.readAsDataURL(file)});
    if(pendingId.current)update(pendingId.current,{imageUrl:url});
  }

  const preview=<section dir="rtl" className="border-t border-slate-200 bg-white px-8 py-10 text-slate-900">
    <div className="mb-6 flex items-center justify-between"><div><div className="text-xs font-bold text-violet-600">Product Blocks</div><h2 className="mt-1 text-3xl font-black">محصولات انتخابی</h2></div><button onClick={add} className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-black text-white">+ افزودن محصول</button></div>
    <div className="grid grid-cols-4 gap-4">{items.map(p=><article key={p.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button onClick={()=>pick(p.id)} className="group grid aspect-square w-full place-items-center overflow-hidden bg-slate-100">{p.imageUrl?<img src={p.imageUrl} className="h-full w-full object-cover"/>:<span className="flex items-center gap-2 text-xs font-bold text-slate-400"><UploadSimple/> آپلود عکس محصول</span>}</button>
      <div className="p-4"><h3 className="text-base font-black">{p.title}</h3><p className="mt-2 min-h-10 text-xs leading-5 text-slate-500">{p.description}</p><div className="mt-4 flex items-center justify-between gap-3"><b className="text-sm">{p.price}</b><button className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-black text-white">{p.buttonText}</button></div></div>
    </article>)}</div>
  </section>;

  return <>
    <StoreWebsiteStudioPageV8/>
    <input ref={fileRef} hidden type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(f)void onFile(f);e.target.value=""}}/>
    {target&&createPortal(preview,target)}
    <div dir="rtl" className="fixed left-5 top-20 z-[120] w-[330px] max-h-[calc(100vh-100px)] overflow-y-auto rounded-2xl border border-white/15 bg-[#101722]/98 text-white shadow-2xl">
      <button onClick={()=>setOpen(v=>!v)} className="flex w-full items-center justify-between p-4 text-right"><div><div className="text-sm font-black">محصولات دستی</div><div className="mt-1 text-[10px] text-white/45">باکس استاندارد + عکس + متن + قیمت</div></div><span className="text-xs">{open?"بستن":"باز کردن"}</span></button>
      {open&&<div className="border-t border-white/10 p-4">
        <button onClick={add} className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 p-3 text-xs font-black"><Plus/> افزودن محصول</button>
        <div className="mt-4 space-y-4">{items.map((p,i)=><div key={p.id} className="rounded-xl border border-white/10 p-3">
          <div className="flex items-center justify-between"><b className="text-xs">محصول {i+1}</b><button onClick={()=>remove(p.id)} className="text-red-400"><Trash/></button></div>
          <button onClick={()=>pick(p.id)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 p-3 text-xs"><UploadSimple/>{p.imageUrl?"تغییر عکس":"آپلود عکس"}</button>
          <input value={p.title} onChange={e=>update(p.id,{title:e.target.value})} placeholder="نام محصول" className="mt-3 w-full rounded-lg border border-white/10 bg-black/20 p-3 text-xs"/>
          <textarea value={p.description} onChange={e=>update(p.id,{description:e.target.value})} placeholder="توضیح محصول" className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 p-3 text-xs" rows={3}/>
          <input value={p.price} onChange={e=>update(p.id,{price:e.target.value})} placeholder="قیمت" className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 p-3 text-xs"/>
          <input value={p.buttonText} onChange={e=>update(p.id,{buttonText:e.target.value})} placeholder="متن دکمه" className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 p-3 text-xs"/>
        </div>)}</div>
        <button onClick={()=>void save()} className="mt-4 w-full rounded-xl border border-violet-400/40 bg-violet-500/10 p-3 text-xs font-black">ذخیره محصولات روی پروژه</button>
        {message&&<div className="mt-3 rounded-lg bg-white/5 p-3 text-[11px] leading-5">{message}</div>}
      </div>}
    </div>
  </>;
}
