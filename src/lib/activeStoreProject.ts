import { apiFetch } from "./api";

export type ActiveStoreProject = {
  id: string;
  name?: string;
  siteType?: string;
  content?: Record<string, unknown>;
};

type Fetcher = typeof apiFetch;

async function read(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = data.code ? ` (${data.code})` : "";
    throw new Error(`${data.message || `HTTP ${response.status}`}${code}`);
  }
  return data;
}

export async function ensureActiveStoreProject(fetcher: Fetcher = apiFetch): Promise<ActiveStoreProject> {
  const listing = await read(await fetcher("/api/site-projects"));
  const projects = Array.isArray(listing.projects) ? listing.projects : [];
  const existing = projects.find((project: ActiveStoreProject) => String(project?.siteType || "").toUpperCase() === "STORE");
  if (existing?.id) return existing;

  const created = await read(await fetcher("/api/site-projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "فروشگاه شما",
      siteType: "STORE",
      content: {},
    }),
  }));
  if (!created.project?.id) throw new Error("ساخت پروژه فروشگاهی کامل نشد.");
  return created.project as ActiveStoreProject;
}

export async function loadActiveStoreProject(fetcher: Fetcher = apiFetch) {
  const project = await ensureActiveStoreProject(fetcher);
  const detail = await read(await fetcher(`/api/site-projects/${project.id}`));
  if (!detail.project?.id) throw new Error("جزئیات پروژه فروشگاهی دریافت نشد.");
  return detail as { project: ActiveStoreProject; assets?: unknown[]; versions?: unknown[]; domains?: unknown[] };
}
