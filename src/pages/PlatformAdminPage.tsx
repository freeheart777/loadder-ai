import { useState } from "react";
import { Link } from "react-router-dom";
import { useAdminRead } from "../components/platform-admin/useAdminRead";

type Overview={overview:{users?:{total?:number;active?:number};workspaces?:{total?:number;active?:number};sessions?:{active?:number};projects?:{status:string};readiness?:{status:string}}};
type Item={id:string;name:string;status:string;createdAt:string;workspaceCount?:number;activeWorkspaceCount?:number;memberCount?:number;activeMemberCount?:number;ownerCount?:number;lastActivity?:{status:string;at:string|null}};
type Inventory={items:Item[];pagination:{page:number;total:number;totalPages:number}};
const num=(v:number|undefined)=>v===undefined?"نامشخص":v.toLocaleString("fa-IR");
const date=(v:string|null)=>v&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleString("fa-IR"):"نامشخص";
const button="min-h-11 rounded-xl border border-white/20 px-4 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300 disabled:opacity-40";
function Status({value}:{value:string}){
  const labels:Record<string,string>={active:"فعال",inactive:"غیرفعال",disabled:"غیرفعال",unknown:"نامشخص",unavailable:"در دسترس نیست",blocked:"مسدود",healthy:"سالم",ready:"آماده"};
  return <span className={`inline-block rounded-lg border px-2 py-1 text-xs ${value==="active"?"border-emerald-300/30 text-emerald-200":"border-amber-300/30 text-amber-200"}`}>{labels[value]||value}</span>;
}
export default function PlatformAdminPage(){
  const [tab,setTab]=useState<"overview"|"users"|"workspaces">("overview");
  const [page,setPage]=useState(1);
  const [revision,setRevision]=useState(0);
  const overview=useAdminRead<Overview>("/api/platform-admin/overview",revision);
  const inventory=useAdminRead<Inventory>(tab==="overview"?null:`/api/platform-admin/${tab}?page=${page}&pageSize=25`,revision);
  const current=tab==="overview"?overview:inventory;
  const stats=overview.data?.overview;
  const navigate=(target:typeof tab)=>{setPage(1);setTab(target);};
  return <main dir="rtl" className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-8"><div className="mx-auto max-w-7xl">
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-6"><div><p className="text-xs tracking-widest text-emerald-300">LOADDER / CONTROL PLANE</p><h1 className="mt-2 text-2xl font-bold sm:text-3xl">مرکز فرمان پلتفرم</h1><p className="mt-2 text-sm text-slate-400">فقط مشاهده · خواندن داده‌های بین‌فضایی در سرور ثبت می‌شود.</p></div><Link className={button} to="/dashboard">بازگشت به داشبورد</Link></header>
    {overview.denied||inventory.denied?<section role="alert" className="mt-6 rounded-2xl border border-rose-400 p-6"><h2 className="font-bold">دسترسی مجاز نیست</h2><p>نقش مالک یا مدیر فضای کاری، دسترسی مدیریت پلتفرم ایجاد نمی‌کند.</p></section>:<>
      <nav aria-label="بخش‌های مدیریت پلتفرم" className="my-5 flex flex-wrap gap-2">{([["overview","نمای کلی"],["users","کاربران"],["workspaces","فضاهای کاری"]] as const).map(([key,label])=><button key={key} className={`${button} ${tab===key?"bg-emerald-300/10":""}`} aria-current={tab===key?"page":undefined} onClick={()=>navigate(key)}>{label}</button>)}</nav>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400"><p>دریافت این نما: {date(current.receivedAt)} · زمان دریافت است، نه تضمین تازگی منبع.</p><button className={button} disabled={current.loading} onClick={()=>setRevision(v=>v+1)}>تازه‌سازی داده‌ها</button></div>
      {current.loading?<p role="status" className="rounded-2xl border border-white/10 p-6">در حال دریافت داده‌های معتبر…</p>:null}
      {current.error?<section role="alert" className="rounded-2xl border border-rose-400/50 bg-rose-500/10 p-5"><h2 className="font-bold">نیازمند توجه · دریافت داده متوقف شد</h2><p className="mt-2">{current.error}</p><p className="mt-2 text-sm">وضعیت نامعلوم است؛ خطا به معنای سلامت یا صفر بودن آمار نیست.</p><button className={`${button} mt-3`} onClick={()=>setRevision(v=>v+1)}>تلاش دوباره</button></section>:null}
      {tab==="overview"&&stats&&!current.loading&&!current.error?<>
        <section aria-label="آمار ثبت‌شده" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{([["کاربران",stats.users?.total,"users"],["کاربران فعال",stats.users?.active,"users"],["فضاهای کاری",stats.workspaces?.total,"workspaces"],["فضاهای فعال",stats.workspaces?.active,"workspaces"],["نشست‌های فعال",stats.sessions?.active,null]] as const).map(([title,value,target])=><article key={title} className="rounded-2xl border border-white/10 bg-white/[.03] p-5"><h2 className="text-sm text-slate-300">{title}</h2><p className="my-3 text-3xl font-bold tabular-nums">{num(value)}</p><p className="text-xs text-slate-400">منبع: overview سرور / داده ثبت‌شده</p>{target?<button className={`${button} mt-4`} onClick={()=>navigate(target)}>مشاهده {target==="users"?"کاربران":"فضاهای کاری"}</button>:null}</article>)}</section>
        <section aria-label="وضعیت شواهد عملیاتی" className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-300/[.04] p-5"><h2 className="font-bold text-amber-100">چه چیزی نیازمند توجه است؟</h2><p className="my-3 text-sm leading-7 text-slate-300">این نما شواهد کامل سلامت کل پلتفرم را در اختیار ندارد.</p><div className="flex flex-wrap gap-5"><p>آمادگی پلتفرم: <Status value={stats.readiness?.status||"unknown"}/></p><p>پروژه‌ها: <Status value={stats.projects?.status||"unavailable"}/></p></div><p className="mt-4 text-xs text-slate-400">تاریخچه audit و پایش سرویس‌ها API خواندنی متصل ندارند؛ داده‌ای برای آن‌ها ساخته نمی‌شود.</p></section>
      </>:null}
      {tab!=="overview"&&inventory.data&&!current.loading&&!current.error?<section aria-label={tab==="users"?"فهرست کاربران":"فهرست فضاهای کاری"}>
        <p className="mb-3 text-sm leading-7 text-slate-400">{tab==="users"?"آخرین فعالیت مستند از sessions.last_seen_at است؛ زمان آخرین ورود نیست و ممکن است متعلق به نشست منقضی یا لغوشده باشد.":"اعضای فعال: عضویت و کاربر فعال. تعداد مالکان شامل همه عضویت‌های owner است، نه فقط مالکان فعال."}</p>
        {inventory.data.items.length===0?<p role="status" className="rounded-xl border border-white/10 p-6">در این صفحه رکوردی وجود ندارد.</p>:<div className="overflow-x-auto rounded-xl border border-white/10" tabIndex={0} aria-label="جدول قابل پیمایش"><table className="w-full min-w-[720px] text-right text-sm"><caption className="sr-only">{tab==="users"?"کاربران پلتفرم":"فضاهای کاری پلتفرم"}</caption><thead className="bg-white/5 text-slate-300"><tr>{["نام / شناسه","وضعیت","ایجاد",...(tab==="users"?["فضاها / فعال","آخرین فعالیت مستند"]:["اعضا / فعال","مالکان"])].map(label=><th scope="col" className="p-4" key={label}>{label}</th>)}</tr></thead><tbody>{inventory.data.items.map(item=><tr key={item.id} className="border-t border-white/10"><td className="p-4"><span className="font-medium">{item.name}</span><bdi className="mt-1 block text-xs text-slate-400">{item.id}</bdi></td><td className="p-4"><Status value={item.status}/></td><td className="p-4 whitespace-nowrap">{date(item.createdAt)}</td><td className="p-4 tabular-nums">{num(tab==="users"?item.workspaceCount:item.memberCount)} / {num(tab==="users"?item.activeWorkspaceCount:item.activeMemberCount)}</td><td className="p-4">{tab==="users"?(item.lastActivity?.status==="evidenced"?date(item.lastActivity.at):"نامشخص؛ بدون شاهد نشست"):num(item.ownerCount)}</td></tr>)}</tbody></table></div>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p aria-live="polite" className="text-sm text-slate-300">صفحه {num(inventory.data.pagination.page)} · کل رکوردها: {num(inventory.data.pagination.total)}</p><div className="flex gap-2"><button className={button} disabled={page<=1} onClick={()=>setPage(v=>v-1)}>صفحه قبل</button><button className={button} disabled={page>=inventory.data.pagination.totalPages} onClick={()=>setPage(v=>v+1)}>صفحه بعد</button></div></div>
      </section>:null}
    </>}
  </div></main>;
}
