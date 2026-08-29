import { useEffect, useState } from "react";
import StoreWebsiteStudioPageV7 from "./StoreWebsiteStudioPageV7";

const STORAGE_KEY = "loadder:store-studio:hero-overlay";

function clamp(value:number){return Math.max(0,Math.min(100,value));}

export default function StoreWebsiteStudioPageV8(){
  const [overlay,setOverlay]=useState(()=>{
    const saved=Number(globalThis.localStorage?.getItem(STORAGE_KEY));
    return Number.isFinite(saved)?clamp(saved):18;
  });

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
      hero.style.background=`linear-gradient(90deg,rgba(10,15,25,${strong}),rgba(10,15,25,${soft})),${image} center / cover`;
    };

    apply();
    const observer=new MutationObserver(()=>requestAnimationFrame(apply));
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["style"]});
    window.addEventListener("resize",apply);
    return()=>{observer.disconnect();window.removeEventListener("resize",apply)};
  },[overlay]);

  return <>
    <StoreWebsiteStudioPageV7/>
    <div dir="rtl" className="fixed bottom-5 right-[370px] z-[100] w-72 rounded-2xl border border-white/15 bg-[#101722]/95 p-4 text-white shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between gap-3"><div><div className="text-xs font-black">تیرگی تصویر Hero</div><div className="mt-1 text-[10px] text-white/45">۰ یعنی تصویر خام و بدون لایه</div></div><b className="text-sm">{overlay}%</b></div>
      <input aria-label="تیرگی تصویر Hero" type="range" min="0" max="100" value={overlay} onChange={e=>setOverlay(Number(e.target.value))} className="mt-3 w-full"/>
      <div className="mt-2 flex justify-between text-[10px] text-white/35"><span>بدون لایه</span><button onClick={()=>setOverlay(18)} className="rounded-lg border border-white/10 px-2 py-1 text-white/70">پیش‌فرض ۱۸٪</button><span>تیره</span></div>
    </div>
  </>;
}
