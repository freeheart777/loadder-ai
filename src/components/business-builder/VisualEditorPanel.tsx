import { useMemo, useState } from "react";

type Props={disabled?:boolean;ui?:any;onPatch:(patch:any)=>Promise<void>|void};
const groups=[{title:"چیدمان",key:"density",items:[["compact","فشرده"],["comfortable","متعادل"],["spacious","باز"]]},{title:"گردی",key:"radius",items:[["small","کم"],["medium","متوسط"],["large","زیاد"]]},{title:"استایل",key:"shell",items:[["loadder-business","لودر"],["minimal","مینیمال"],["dashboard","داشبورد"]]}] as const;

export default function VisualEditorPanel({disabled,ui,onPatch}:Props){
  const [rename,setRename]=useState("");
  const firstNav=ui?.navigation?.find((item:any)=>item.id!=="dashboard");
  const firstResourceView=useMemo(()=>ui?.views?.find((view:any)=>view.resource&&view.blocks?.some((block:any)=>block.type==="data-table")),[ui]);
  const firstColumn=firstResourceView?.blocks?.find((block:any)=>block.type==="data-table")?.columns?.[0];
  return <aside className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-3">
    <div><p className="text-xs text-white/35">VISUAL EDITOR</p><h3 className="mt-1 text-sm font-semibold">ویرایش سریع اپ</h3><p className="mt-1 text-[11px] leading-5 text-white/35">هر تغییر ذخیره و نسخه‌گذاری می‌شود.</p></div>
    {groups.map(g=><div key={g.key}><p className="mb-2 text-[11px] text-white/40">{g.title}</p><div className="grid grid-cols-3 gap-1">{g.items.map(([value,label])=><button disabled={disabled} key={value} onClick={()=>onPatch({theme:{[g.key]:value}})} className="rounded-lg border border-white/10 px-2 py-2 text-[10px] text-white/60 hover:bg-white/8 disabled:opacity-40">{label}</button>)}</div></div>)}
    {firstNav?<div className="border-t border-white/10 pt-3"><p className="mb-2 text-[11px] text-white/40">نام منو</p><div className="flex gap-1"><input value={rename} onChange={e=>setRename(e.target.value)} placeholder={firstNav.label} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-xs outline-none"/><button disabled={disabled||!rename.trim()} onClick={async()=>{await onPatch({navigation:[{id:firstNav.id,label:rename}]});setRename("")}} className="rounded-lg border border-white/10 px-2 text-[10px] disabled:opacity-30">ثبت</button></div></div>:null}
    {firstResourceView&&firstColumn?<div className="border-t border-white/10 pt-3"><p className="mb-2 text-[11px] text-white/40">فیلدها</p><button disabled={disabled} onClick={()=>onPatch({fields:[{entityId:firstResourceView.resource,fieldId:firstColumn.id,visible:false}]})} className="w-full rounded-lg border border-white/10 px-2 py-2 text-right text-[10px] text-white/55 disabled:opacity-30">مخفی کردن «{firstColumn.label||firstColumn.id}»</button></div>:null}
    <div className="border-t border-white/10 pt-3"><p className="text-[10px] leading-5 text-white/30">بعدی: Drag & Drop بلوک‌ها و تنظیم صفحه.</p></div>
  </aside>
}
