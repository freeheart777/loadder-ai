import {
  Desktop,
  DeviceMobile,
  DeviceTablet,
  Eye,
  FloppyDisk,
  GlobeHemisphereWest,
  Storefront,
} from "@phosphor-icons/react";
import type { DeviceMode, PageMode } from "./types";

const devices = [
  ["desktop", "دسکتاپ", Desktop],
  ["tablet", "تبلت", DeviceTablet],
  ["mobile", "موبایل", DeviceMobile],
] as const;

const pages = [
  ["storefront", "خانه فروشگاه"],
  ["collection", "دسته‌بندی / کالکشن"],
  ["product", "صفحه محصول"],
  ["cart", "سبد خرید"],
  ["checkout", "تسویه حساب"],
  ["success", "سفارش موفق"],
] as const;

export default function StudioToolbar({ device, page, busy, onDevice, onPage, onPreview, onSave }: {
  device: DeviceMode;
  page: PageMode;
  busy: boolean;
  onDevice: (device: DeviceMode) => void;
  onPage: (page: PageMode) => void;
  onPreview: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2.5">
      <div className="hidden min-h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[.035] px-3 xl:flex">
        <span className="relative grid h-7 w-7 place-items-center rounded-lg bg-emerald-400/10 text-emerald-300">
          <Storefront size={16} weight="fill" />
          <i className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-[#0a111b]" />
        </span>
        <div className="leading-tight"><b className="block text-[11px] text-white/80">Draft زنده</b><span className="text-[9px] text-white/35">همان Renderer فروشگاه</span></div>
      </div>

      <label className="relative min-w-[155px]">
        <span className="sr-only">صفحه فروشگاه</span>
        <select value={page} onChange={(event) => onPage(event.target.value as PageMode)} className="min-h-11 w-full appearance-none rounded-2xl border border-white/10 bg-white/[.045] py-2 pl-8 pr-3 text-xs font-black text-white outline-none transition hover:bg-white/[.07] focus:border-violet-400/50">
          {pages.map(([value, label]) => <option key={value} value={value} className="bg-slate-950">{label}</option>)}
        </select>
        <GlobeHemisphereWest className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-white/35" size={15} />
      </label>

      <nav aria-label="اندازه بوم" className="flex rounded-2xl border border-white/10 bg-white/[.035] p-1 shadow-inner shadow-black/20">
        {devices.map(([value, label, Icon]) => <button type="button" key={value} title={label} aria-label={label} aria-pressed={device === value} onClick={() => onDevice(value)} className={`group grid min-h-9 min-w-10 place-items-center rounded-xl transition ${device === value ? "bg-white text-slate-950 shadow-lg" : "text-white/38 hover:bg-white/[.06] hover:text-white/80"}`}><Icon size={17} weight={device === value ? "fill" : "regular"} /></button>)}
      </nav>

      <button type="button" className="flex min-h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[.035] px-3.5 text-xs font-black text-white/70 transition hover:-translate-y-px hover:bg-white/[.07] hover:text-white" onClick={onPreview}><Eye size={18} /><span className="hidden sm:inline">پیش‌نمایش</span></button>
      <button type="button" disabled={busy} onClick={onSave} className="flex min-h-11 items-center gap-2 rounded-2xl bg-emerald-400 px-4 text-xs font-black text-slate-950 shadow-[0_10px_28px_rgba(52,211,153,.18)] transition hover:-translate-y-px hover:bg-emerald-300 disabled:translate-y-0 disabled:opacity-40"><FloppyDisk size={18} weight="fill" />{busy ? "در حال ذخیره…" : "ذخیره"}</button>
    </div>
  );
}
