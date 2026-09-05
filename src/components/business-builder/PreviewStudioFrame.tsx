import { useState } from "react";
import { ArrowClockwise, Desktop, DeviceMobile, DeviceTablet, ShieldCheck, X } from "@phosphor-icons/react";

type Viewport = "desktop" | "tablet" | "mobile";
const viewportWidth: Record<Viewport,string>={desktop:"100%",tablet:"820px",mobile:"390px"};

export default function PreviewStudioFrame({url,onRefresh,onApprove,onClose,approving=false,approveDisabled=false}:{url:string;onRefresh:()=>void|Promise<void>;onApprove:()=>void|Promise<void>;onClose:()=>void;approving?:boolean;approveDisabled?:boolean}){
  const [viewport,setViewport]=useState<Viewport>("desktop");
  const [frameKey,setFrameKey]=useState(0);
  const refresh=async()=>{await onRefresh();setFrameKey(v=>v+1)};
  return <section data-preview-studio="true" className="overflow-hidden rounded-2xl border border-amber-300/20 bg-[#08090b]">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-amber-300/[0.06] px-4 py-3">
      <div className="flex items-center gap-2 text-sm text-amber-100"><ShieldCheck size={18}/><strong>حالت پیش‌نمایش</strong><span className="rounded-full border border-amber-300/20 px-2 py-0.5 text-[11px] text-amber-100/70">منتشر نشده</span></div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-white/10 bg-black/20 p-1" aria-label="اندازه پیش‌نمایش">
          <button aria-label="Desktop preview" onClick={()=>setViewport("desktop")} className={`rounded-lg p-2 ${viewport==="desktop"?"bg-white text-black":"text-white/55"}`}><Desktop size={16}/></button>
          <button aria-label="Tablet preview" onClick={()=>setViewport("tablet")} className={`rounded-lg p-2 ${viewport==="tablet"?"bg-white text-black":"text-white/55"}`}><DeviceTablet size={16}/></button>
          <button aria-label="Mobile preview" onClick={()=>setViewport("mobile")} className={`rounded-lg p-2 ${viewport==="mobile"?"bg-white text-black":"text-white/55"}`}><DeviceMobile size={16}/></button>
        </div>
        <button onClick={refresh} className="flex items-center gap-1 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/65"><ArrowClockwise size={14}/>تازه‌سازی</button>
        <button disabled={approving||approveDisabled} onClick={onApprove} title={approveDisabled?"ابتدا Quality Gate را کامل کنید":""} className="rounded-xl bg-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-950 disabled:cursor-not-allowed disabled:opacity-35">{approving?"در حال تأیید...":approveDisabled?"Quality Gate ناقص است":"تأیید پیش‌نمایش"}</button>
        <button aria-label="Close preview" onClick={onClose} className="rounded-xl border border-white/10 p-2 text-white/55"><X size={16}/></button>
      </div>
    </div>
    <div className="border-b border-white/10 px-4 py-2 text-[11px] text-white/40">این محیط داخلی لودر است. Preview به معنی Publish نیست و هیچ تأیید Production را جایگزین نمی‌کند.</div>
    <div className="flex min-h-[720px] justify-center overflow-auto bg-[#111318] p-4">
      <div data-preview-viewport={viewport} style={{width:viewportWidth[viewport],maxWidth:"100%"}} className="h-[700px] overflow-hidden rounded-xl border border-white/10 bg-white shadow-2xl transition-[width] duration-200">
        <iframe key={frameKey} title="Loadder internal preview" src={url} sandbox="allow-same-origin" referrerPolicy="same-origin" className="h-full w-full bg-white"/>
      </div>
    </div>
  </section>;
}
