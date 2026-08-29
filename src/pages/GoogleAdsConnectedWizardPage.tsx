import { useCallback, useEffect, useState } from "react";
import { CheckCircle, LinkSimple, PlugsConnected, SignOut, WarningCircle } from "@phosphor-icons/react";
import GoogleAdsSearchWizardPage from "./GoogleAdsSearchWizardPage";

type Connection = {
  status: string;
  selectedCustomerId: string | null;
  loginCustomerId: string | null;
  accessibleCustomers: string[];
};

type StatusResponse = {
  success: boolean;
  configured: boolean;
  connected: boolean;
  connection: Connection | null;
};

const OAUTH_API = "/api/google-ads/oauth";
const ACCOUNTS_API = "/api/google-ads/accounts";

async function json(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.message || "ارتباط با Google Ads انجام نشد.");
  return body;
}

function formatCustomerId(value: string) {
  const id = value.replace(/\D/g, "");
  return id.length === 10 ? `${id.slice(0, 3)}-${id.slice(3, 6)}-${id.slice(6)}` : id;
}

export default function GoogleAdsConnectedWizardPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const next = await json(await fetch(`${OAUTH_API}/status`));
      setStatus(next);
      if (next.connected) {
        const accountBody = await json(await fetch(ACCOUNTS_API));
        setAccounts(accountBody.accounts || []);
        setSelected(accountBody.connection?.selectedCustomerId || "");
      } else {
        setAccounts([]);
        setSelected("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "خواندن وضعیت اتصال Google Ads ناموفق بود.");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const connect = async () => {
    setBusy(true);
    setError("");
    try {
      const body = await json(await fetch(`${OAUTH_API}/start`, { method: "POST" }));
      window.location.assign(body.authorizationUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "شروع اتصال Google Ads ناموفق بود.");
      setBusy(false);
    }
  };

  const selectAccount = async () => {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await json(await fetch(`${ACCOUNTS_API}/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: selected }),
      }));
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "انتخاب حساب تبلیغاتی ناموفق بود.");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    setError("");
    try {
      await json(await fetch(`${OAUTH_API}/connection`, { method: "DELETE" }));
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "قطع اتصال Google Ads ناموفق بود.");
    } finally {
      setBusy(false);
    }
  };

  const ready = status?.connection?.status === "READY";

  return (
    <div className="relative">
      <GoogleAdsSearchWizardPage />
      <aside dir="rtl" className="fixed bottom-5 left-5 z-[140] w-[min(390px,calc(100vw-40px))] rounded-[24px] border border-white/10 bg-[#061026]/95 p-5 text-white shadow-[0_24px_80px_rgba(0,0,0,.45)] backdrop-blur-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 font-bold">
              <PlugsConnected size={20} className="text-blue-300" />
              اتصال Google Ads
            </div>
            <p className="mt-1 text-xs leading-6 text-white/45">حساب گوگل را متصل کن و Customer ID تبلیغاتی را انتخاب کن.</p>
          </div>
          {ready && <span className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-200">آماده</span>}
        </div>

        {!status?.configured && (
          <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/[0.07] p-3 text-xs leading-6 text-amber-100/80">
            <div className="flex items-center gap-2 font-semibold"><WarningCircle size={16} /> تنظیمات OAuth سرور کامل نیست.</div>
            <div className="mt-1 text-amber-100/55">Client ID، Client Secret، Developer Token، Redirect URI و کلید رمزنگاری باید روی سرور تنظیم شوند.</div>
          </div>
        )}

        {status?.configured && !status.connected && (
          <button type="button" disabled={busy} onClick={connect} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold transition hover:bg-blue-500 disabled:opacity-50">
            <LinkSimple size={18} /> اتصال حساب Google Ads
          </button>
        )}

        {status?.connected && (
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/[0.06] p-3 text-xs text-emerald-100/80">
              <div className="flex items-center gap-2 font-semibold"><CheckCircle size={16} /> حساب Google متصل است</div>
              <div className="mt-1 text-emerald-100/50">انتخاب Customer ID هنوز هیچ کمپینی را منتشر نمی‌کند.</div>
            </div>

            <label className="block">
              <span className="mb-2 block text-xs text-white/50">حساب تبلیغاتی قابل دسترس</span>
              <select className="input" dir="ltr" value={selected} onChange={(event) => setSelected(event.target.value)}>
                <option value="">یک حساب انتخاب کن</option>
                {accounts.map((account) => <option key={account} value={account}>{formatCustomerId(account)}</option>)}
              </select>
            </label>

            <div className="grid grid-cols-[1fr_auto] gap-2">
              <button type="button" disabled={busy || !selected} onClick={selectAccount} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold disabled:opacity-40">
                {ready && status?.connection?.selectedCustomerId === selected ? "حساب انتخاب شده" : "انتخاب این حساب"}
              </button>
              <button type="button" disabled={busy} onClick={disconnect} title="قطع اتصال" className="flex h-11 w-11 items-center justify-center rounded-xl border border-rose-400/15 bg-rose-500/[0.06] text-rose-300 disabled:opacity-40">
                <SignOut size={17} />
              </button>
            </div>
          </div>
        )}

        {error && <div className="mt-3 rounded-xl border border-rose-400/15 bg-rose-500/[0.06] p-3 text-xs leading-6 text-rose-200">{error}</div>}
      </aside>
    </div>
  );
}
