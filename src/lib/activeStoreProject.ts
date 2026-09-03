import { apiFetch, setCanonicalStoreProjectId } from "./api";

export type ActiveStoreProject = {
  id: string;
  name?: string;
  siteType?: string;
  content?: Record<string, unknown>;
};

export type ActiveStoreProjectDetail = {
  project: ActiveStoreProject;
  assets?: unknown[];
  versions?: unknown[];
  domains?: unknown[];
};

type Fetcher = typeof apiFetch;

let canonicalProjectPromise: Promise<ActiveStoreProjectDetail> | null = null;

async function read(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = data.code ? ` (${data.code})` : "";
    throw new Error(`${data.message || `HTTP ${response.status}`}${code}`);
  }
  return data;
}

function isStore(project: ActiveStoreProject | null | undefined) {
  return Boolean(project?.id) && String(project?.siteType || "").toUpperCase() === "STORE";
}

async function resolveActiveStoreProject(fetcher: Fetcher): Promise<ActiveStoreProjectDetail> {
  const listing = await read(await fetcher("/api/site-projects"));
  const projects = Array.isArray(listing.projects) ? listing.projects : [];
  let project = projects.find((candidate: ActiveStoreProject) => isStore(candidate)) as ActiveStoreProject | undefined;

  if (!project?.id) {
    const created = await read(await fetcher("/api/site-projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "فروشگاه شما", siteType: "STORE", content: {} }),
    }));
    project = created.project as ActiveStoreProject | undefined;
  }

  if (!isStore(project)) throw new Error("ساخت یا انتخاب پروژه فروشگاهی کامل نشد.");

  const detail = await read(await fetcher(`/api/site-projects/${project.id}`));
  if (!isStore(detail.project)) throw new Error("جزئیات پروژه فروشگاهی معتبر دریافت نشد.");
  if (fetcher === apiFetch) setCanonicalStoreProjectId(detail.project.id);
  return detail as ActiveStoreProjectDetail;
}

export function invalidateActiveStoreProject() {
  canonicalProjectPromise = null;
  setCanonicalStoreProjectId("");
}

export async function loadActiveStoreProject(fetcher: Fetcher = apiFetch): Promise<ActiveStoreProjectDetail> {
  if (fetcher !== apiFetch) return resolveActiveStoreProject(fetcher);
  if (!canonicalProjectPromise) {
    canonicalProjectPromise = resolveActiveStoreProject(apiFetch).catch((error) => {
      canonicalProjectPromise = null;
      setCanonicalStoreProjectId("");
      throw error;
    });
  }
  return canonicalProjectPromise;
}

export async function ensureActiveStoreProject(fetcher: Fetcher = apiFetch): Promise<ActiveStoreProject> {
  return (await loadActiveStoreProject(fetcher)).project;
}
