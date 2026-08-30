import { useEffect, useState } from "react";
import StoreWebsiteStudioPageV7 from "./StoreWebsiteStudioPageV7";

const STORAGE_KEY = "loadder:store-studio:hero-overlay";
function clamp(value:number){return Math.max(0,Math.min(100,value));}

export default function StoreWebsiteStudioPageV8(){
  const [overlay,setOverlay]=useState(()=>{
    const saved=Number(globalThis.localStorage?.getItem(STORAGE_KEY));
    return Number.isFinite(saved)?clamp(saved):18;
  });
  const [open,setOpen]=useState(false);

  useEffect(()=>{
    globalThis.localStorage?.setItem(STORAGE_KEY,String(overlay));
    const apply=()=>{
      const heroButton=[...document.querySelectorAll("button")].find((node)=>node.textContent?.includes("تصویر Hero"));
      const hero=heroButton?.closest("section") as HTMLElement|null;
      if(!hero)return;
      const current=hero.style.background || getComputedStyle(hero).background;
      const match=current.match(/url\(([^)]+)\)/i);
      if(!match)return;
      const image=`url(${match[1]})`;
      const strong=(overlay/100).toFixed(2);
      const soft=(overlay/300).toFixed(2);
      const next=`linear-gradient(90deg,rgba(10,15,25,${strong}),rgba(10,15,25,${soft})),${image} center / cover`;
      if(hero.style.background!==next)hero.style.background=next;
    };
    apply();
    const observer=new MutationObserver(()=>requestAnimationFrame(apply));
    observer.observe(document.body,{subtree:true,childList:true});
    window.addEventListener("resize",apply);
    return()=>{observer.disconnect();window.removeEventListener("resize",apply)};
  },[overlay]);

  return <>
    <StoreWebsiteStudioPageV7/>
    <div dir="rtl" className="fixed bottom-4 right-[270px] z-[100] text-white">
      {!open?<button onClick={()=>setOpen(true)} className="rounded-xl border border-white/10 bg-[#101722]/95 px-3 py-2 text-[11px] font-bold shadow-lg">تیرگی Hero · {overlay}%</button>:
      <div className="w-56 rounded-2xl border border-white/10 bg-[#101722]/95 p-3 shadow-xl backdrop-blur">
        <div className="flex items-center justify-between"><b className="text-[11px]">تیرگی Hero</b><button onClick={()=>setOpen(false)} className="text-[10px] text-white/50">بستن</button></div>
        <div className="mt-2 flex items-center gap-2"><input aria-label="تیرگی Hero" type="range" min="0" max="100" value={overlay} onChange={e=>setOverlay(Number(e.target.value))} className="w-full"/><b className="w-8 text-left text-[11px]">{overlay}%</b></div>
        <button onClick={()=>setOverlay(18)} className="mt-2 text-[10px] text-white/45">بازگشت به ۱۸٪</button>
      </div>}
    </div>
  </>;
}
