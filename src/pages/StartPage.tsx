import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react";
import HomeChrome from "../components/home/HomeChrome";
import { FallbackIcon, HOME_ICONS } from "../components/home/icons";
import { START_COPY, START_PATHS, TOOLS, TOOLS_COPY } from "../lib/homeCopy";

/**
 * THE ENTRY.
 *
 * One question, three answers. Someone who knows what they need reaches a tool
 * in two taps and never passes through Home. Someone who does not lands on
 * Home, where the first zone says plainly that Loadder has not learned the
 * business yet and offers the smallest ways to fix that.
 *
 * No goal, no plan and no diagnosis is required on any of the three paths.
 * `?view=tools` deep-links the capability list.
 */
export default function StartPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const showTools = params.get("view") === "tools";

  if (showTools) {
    return (
      <HomeChrome>
        <button type="button" data-start-back onClick={() => setParams({})} className="mb-7 inline-flex min-h-11 items-center gap-2 text-[13.5px] text-white/35 transition hover:text-white/65">
          <ArrowRight size={15} />
          {START_COPY.back}
        </button>
        <h1 className="text-[26px] font-bold leading-[1.55] sm:text-[31px]">{START_COPY.toolsTitle}</h1>
        <p className="mt-4 max-w-[56ch] text-[15px] leading-[2] text-white/50">{START_COPY.toolsLead}</p>
        <div className="mt-8 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {TOOLS.map((tool) => {
            const Icon = HOME_ICONS[tool.icon] ?? FallbackIcon;
            return (
              <Link
                key={tool.route + tool.label}
                to={tool.route}
                data-start-tool={tool.route}
                className="group flex min-h-[60px] items-center gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] px-4 py-3 transition hover:border-white/[0.14] hover:bg-white/[0.05]"
              >
                <Icon size={18} className="shrink-0 text-white/35 transition group-hover:text-violet-200" />
                <span className="truncate text-[14px] text-white/75">{tool.label}</span>
              </Link>
            );
          })}
        </div>
        <p className="mt-4 text-[12.5px] text-white/25">{TOOLS_COPY.hint}</p>
        <Link to="/dashboard" data-start-home className="mt-9 inline-flex min-h-11 items-center text-[13.5px] text-white/35 underline decoration-white/15 underline-offset-[6px] transition hover:text-white/65">
          {START_COPY.skip}
        </Link>
      </HomeChrome>
    );
  }

  return (
    <HomeChrome>
      <h1 data-start-title className="text-[27px] font-bold leading-[1.55] sm:text-[34px] sm:leading-[1.45]">{START_COPY.title}</h1>
      <p className="mt-5 max-w-[58ch] text-[15.5px] leading-[2] text-white/50">{START_COPY.lead}</p>
      <div className="mt-9 grid gap-3">
        {START_PATHS.map((path) => {
          const Icon = HOME_ICONS[path.icon] ?? FallbackIcon;
          return (
            <button
              key={path.title}
              type="button"
              data-start-path={path.id}
              onClick={() => (path.id === "tools" ? setParams({ view: "tools" }) : navigate("/dashboard"))}
              className="group flex min-h-[88px] items-center gap-5 rounded-[24px] border border-white/[0.08] bg-white/[0.025] px-6 py-5 text-right transition hover:border-violet-300/30 hover:bg-white/[0.05]"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/[0.05] transition group-hover:bg-violet-400/15">
                <Icon size={20} className="text-white/45 transition group-hover:text-violet-200" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[17.5px] font-bold leading-[1.6] sm:text-[19px]">{path.title}</span>
                <span className="mt-1.5 block text-[13.5px] leading-[1.8] text-white/40">{path.hint}</span>
              </span>
              <ArrowLeft size={18} className="hidden shrink-0 text-white/20 transition group-hover:text-white/50 sm:block" />
            </button>
          );
        })}
      </div>
    </HomeChrome>
  );
}
