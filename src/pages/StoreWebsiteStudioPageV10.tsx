import { useEffect,useState } from "react";
import { GearSix,MagicWand,Storefront } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import StoreWebsiteStudioPageV9 from "./StoreWebsiteStudioPageV9";

const OVERLAY_KEY="loadder:store-studio:hero-overlay";

export default function StoreWebsiteStudioPageV10(){
 const[overlay,setOverlay]=useState(()=>{const n=Number(localStorage.getItem(OVERLAY_KEY));return Number.isFinite(n)?Math.max(0,Math.min(100,n)):18});
 const[productsOpen,setProductsOpen]=useState(false);
 useEffect(()=>{localStorage.setItem(OVERLAY_KEY,String(overlay));window.dispatchEvent(new StorageEvent("storage",{key:OVERLAY_KEY,newValue:String(overlay)}));},[overlay]);
 useEffect(()=>{
  const tidy=()=>{
   const version=[...document.querySelectorAll("div")].find(x=>x.textContent?.includes("Store Studio V7 · Design System + Multi Banner"));if(version)version.textContent="Loadder Store Studio · Visual Commerce Builder";
   const overlayCard=[...document.querySelectorAll("div.fixed")].find(x=>x.textContent?.includes("تیرگی تصویر Hero"));if(overlayCard)(overlayCard as HTMLElement).style.display="none";
   const productCard=[...document.querySelectorAll("div.fixed")].find(x=>x.textContent?.includes("محصولات دستی"));if(productCard){const el=productCard as HTMLElement;el.style.left="20px";el.style.top="76px";el.style.width="360px";el.style.maxHeight="calc(100vh - 96px)";el.style.display=productsOpen?"block":"none";}
  };
  tidy();const o=new MutationObserver(tidy);o.observe(document.body,{subtree:true,childList:true});return()=>o.disconnect();
 },[productsOpen]);
 return <div className="studio-v10"><StoreWebsiteStudioPageV9/>
 <nav dir="rtl" className="fixed left-1/2 top-[72px] z-[210] flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-white/15 bg-[#101722]/95 p-1.5 text-white shadow-2xl backdrop-blur"><Link to="/dashboard/websites/setup" className="flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-black hover:bg-white/10"><MagicWand/>راه‌اندازی</Link><Link to="/dashboard/websites/admin" className="flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-[11px] font-black"><Storefront/>پنل فروشگاه</Link><Link to="/dashboard/websites/commerce" className="flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-black hover:bg-white/10"><GearSix/>محصولات</Link></nav>
 <div dir="rtl" className="fixed bottom-5 left-5 z-[200] flex items-center gap-2 rounded-2xl border border-white/15 bg-[#0d131d]/95 p-2 text-white shadow-2xl backdrop-blur"><button onClick={()=>setProductsOpen(v=>!v)} className={`rounded-xl px-4 py-2 text-xs font-black ${productsOpen?"bg-violet-600":"bg-white/10"}`}>محصولات انتخابی</button><div className="h-8 w-px bg-white/10"/><div className="min-w-56 px-2"><div className="mb-1 flex items-center justify-between text-[10px]"><span>تیرگی Hero</span><b>{overlay}%</b></div><input aria-label="تیرگی Hero" type="range" min="0" max="100" value={overlay} onChange={e=>setOverlay(Number(e.target.value))} className="w-full"/></div></div><style>{`.studio-v10 textarea,.studio-v10 input,.studio-v10 select{box-sizing:border-box}.studio-v10 aside{scrollbar-width:thin}.studio-v10 article{min-width:0}.studio-v10 button{white-space:normal}.studio-v10 [class*="grid-cols-4"]{grid-template-columns:repeat(auto-fit,minmax(190px,1fr))!important}`}</style></div>;
}
