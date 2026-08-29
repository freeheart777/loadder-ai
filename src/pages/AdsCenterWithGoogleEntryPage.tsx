import { Link } from "react-router-dom";
import { MagnifyingGlass, ArrowLeft } from "@phosphor-icons/react";
import AdsCenterPage from "./AdsCenterPage";

export default function AdsCenterWithGoogleEntryPage() {
  return (
    <div className="relative">
      <AdsCenterPage />
      <Link
        to="/dashboard/ads/google"
        className="fixed bottom-6 right-6 z-[120] flex items-center gap-3 rounded-2xl border border-blue-300/20 bg-[#0a1530]/95 px-5 py-4 text-sm font-semibold text-white shadow-[0_18px_60px_rgba(37,99,235,.28)] backdrop-blur-xl transition hover:-translate-y-1 hover:border-blue-300/40"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-200">
          <MagnifyingGlass size={20} weight="duotone" />
        </span>
        <span>
          <span className="block">ساخت کمپین Google Ads</span>
          <span className="mt-0.5 block text-xs font-normal text-white/45">فرم فارسی Search Campaign</span>
        </span>
        <ArrowLeft size={16} className="text-blue-200" />
      </Link>
    </div>
  );
}
