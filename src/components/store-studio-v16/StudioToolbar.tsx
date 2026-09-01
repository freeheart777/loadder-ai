import {
  Desktop,
  DeviceMobile,
  DeviceTablet,
  Eye,
  FloppyDisk,
} from "@phosphor-icons/react";
import type { DeviceMode, PageMode } from "./types";

const devices = [
  ["desktop", "دسکتاپ", Desktop],
  ["tablet", "تبلت", DeviceTablet],
  ["mobile", "موبایل", DeviceMobile],
] as const;

const pages = [
  ["storefront", "فروشگاه"],
  ["cart", "سبد"],
  ["checkout", "تسویه"],
  ["success", "موفقیت"],
] as const;

export default function StudioToolbar({
  device,
  page,
  busy,
  onDevice,
  onPage,
  onSave,
}: {
  device: DeviceMode;
  page: PageMode;
  busy: boolean;
  onDevice: (device: DeviceMode) => void;
  onPage: (page: PageMode) => void;
  onSave: () => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
      <nav aria-label="اندازه بوم" className="flex rounded-xl border border-white/10 bg-white/5 p-1">
        {devices.map(([value, label, Icon]) => (
          <button
            type="button"
            key={value}
            aria-pressed={device === value}
            onClick={() => onDevice(value)}
            className={`flex min-h-10 items-center gap-1 rounded-lg px-3 text-xs font-bold ${device === value ? "bg-emerald-400 text-slate-950" : "text-white/55"}`}
          >
            <Icon /> {label}
          </button>
        ))}
      </nav>
      <nav aria-label="صفحه پیش‌نمایش" className="flex max-w-full overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-1">
        {pages.map(([value, label]) => (
          <button
            type="button"
            key={value}
            aria-pressed={page === value}
            onClick={() => onPage(value)}
            className={`min-h-10 whitespace-nowrap rounded-lg px-3 text-xs font-bold ${page === value ? "bg-violet-600 text-white" : "text-white/55"}`}
          >
            {label}
          </button>
        ))}
      </nav>
      <button
        type="button"
        className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-bold text-white/70"
        onClick={() => onPage("storefront")}
      >
        <Eye /> پیش‌نمایش فروشگاه
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onSave}
        className="flex min-h-11 items-center gap-2 rounded-xl bg-emerald-400 px-4 text-xs font-black text-slate-950 disabled:opacity-40"
      >
        <FloppyDisk /> ذخیره V16
      </button>
    </div>
  );
}
