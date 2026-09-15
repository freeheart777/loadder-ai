import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { CaretDown } from "@phosphor-icons/react";
import WorkspaceSelector from "../WorkspaceSelector";
import { useAuth } from "../../lib/auth";
import { NAV } from "../../lib/homeCopy";

/**
 * The whole of Loadder's navigation: Home, Tools, Account.
 *
 * There is no module sidebar. Depth is reached from the thing you are looking
 * at — «چرا این را می‌گویم؟» on the item, the details surface behind it — not
 * from a permanent rail of destinations. A command menu can land later without
 * changing anything here.
 */
export default function HomeChrome({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <div dir="rtl" className="relative min-h-screen overflow-x-hidden bg-[#07070B] text-[#F5F5F7]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[380px] bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.09),transparent_66%)]" />

      <header data-home-chrome className="relative border-b border-white/[0.06]">
        <div className="mx-auto flex w-full max-w-[960px] flex-wrap items-center gap-x-5 gap-y-2 px-6 py-4 sm:px-8">
          <Link to="/dashboard" dir="ltr" className="text-[15px] font-semibold text-white/70">Loadder</Link>
          <nav className="flex items-center gap-1">
            <Link data-nav="home" to="/dashboard" className="inline-flex min-h-10 items-center rounded-xl px-3 text-[13.5px] text-white/70 transition hover:bg-white/[0.06]">
              {NAV.home}
            </Link>
            <a data-nav="tools" href="#tools" className="inline-flex min-h-10 items-center rounded-xl px-3 text-[13.5px] text-white/45 transition hover:bg-white/[0.06] hover:text-white/70">
              {NAV.tools}
            </a>
          </nav>

          <div className="mr-auto">
            <button
              type="button"
              data-nav="account"
              aria-expanded={accountOpen}
              onClick={() => setAccountOpen((open) => !open)}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-[13.5px] text-white/45 transition hover:bg-white/[0.06] hover:text-white/70"
            >
              {user?.name || NAV.account}
              <CaretDown size={13} />
            </button>
          </div>

          {accountOpen && (
            <div data-account-panel className="w-full rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
              <div className="text-[12px] text-white/35">{NAV.workspace}</div>
              <div className="mt-2"><WorkspaceSelector /></div>
              <button
                type="button"
                data-account-signout
                onClick={() => { void logout(); }}
                className="mt-4 inline-flex min-h-11 items-center text-[13.5px] text-white/45 transition hover:text-white/75"
              >
                {NAV.signOut}
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-[960px] px-6 py-10 sm:px-8 sm:py-14">{children}</main>
    </div>
  );
}
