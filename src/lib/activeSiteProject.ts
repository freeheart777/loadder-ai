import { apiFetch } from "./api";

// Bootstrap for non-commerce site types. Deliberately separate from
// activeStoreProject's canonical-store singletons: a corporate site must not
// touch, cache or invalidate Commerce's active-store truth.

export type SiteProject = { id: string; name?: string; siteType?: string; content?: Record<string, unknown> };

const DEFAULT_NAMES: Record<string, string> = { BUSINESS: "سایت شرکتی شما" };

async function read(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${data.message || `HTTP ${response.status}`}${data.code ? ` (${data.code})` : ""}`);
  return data;
}

const matches = (project: SiteProject | undefined, siteType: string) =>
  Boolean(project?.id) && String(project?.siteType || "").toUpperCase() === siteType;

/** Resolve the workspace's project of this site type, creating it on first entry. */
export async function ensureSiteProject(siteType: string, fetcher = apiFetch): Promise<SiteProject> {
  const listing = await read(await fetcher("/api/site-projects"));
  const projects: SiteProject[] = Array.isArray(listing.projects) ? listing.projects : [];
  let project = projects.find((candidate) => matches(candidate, siteType));

  if (!project?.id) {
    const created = await read(await fetcher("/api/site-projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: DEFAULT_NAMES[siteType] || "سایت شما", siteType, content: {} }),
    }));
    project = created.project as SiteProject | undefined;
  }

  if (!matches(project, siteType)) throw new Error("ساخت یا انتخاب پروژه سایت کامل نشد.");
  return project as SiteProject;
}
