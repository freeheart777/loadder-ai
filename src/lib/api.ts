const configuredBaseUrl = String(
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3001"
).trim();

export const API_BASE_URL = configuredBaseUrl.replace(/\/+$/, "");

const nativeFetch = globalThis.fetch.bind(globalThis);
const API_FETCH_PATCH_FLAG = "__loadderApiFetchPatched__";
let canonicalStoreProjectId = "";
let canonicalStoreProjectSnapshot: Record<string, unknown> | null = null;

export function setCanonicalStoreProjectId(projectId: string | null | undefined) {
  canonicalStoreProjectId = String(projectId || "").trim();
  if (!canonicalStoreProjectId) canonicalStoreProjectSnapshot = null;
}

export function setCanonicalStoreProjectSnapshot(snapshot: Record<string, unknown> | null | undefined) {
  canonicalStoreProjectSnapshot = snapshot ? structuredClone(snapshot) : null;
  const project = canonicalStoreProjectSnapshot?.project as { id?: string } | undefined;
  canonicalStoreProjectId = String(project?.id || "").trim();
}

export function getCanonicalStoreProjectId() {
  return canonicalStoreProjectId;
}

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

if (!(globalThis as typeof globalThis & Record<string, unknown>)[API_FETCH_PATCH_FLAG]) {
  (globalThis as typeof globalThis & Record<string, unknown>)[API_FETCH_PATCH_FLAG] = true;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(input);
    const targetsApi = url === API_BASE_URL || url.startsWith(`${API_BASE_URL}/`);
    if (!targetsApi || init?.credentials) return nativeFetch(input, init);
    return nativeFetch(input, { ...init, credentials: "include" });
  }) as typeof globalThis.fetch;
}

export function apiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function canonicalCachedResponse(path: string, method: string) {
  if (method !== "GET" || !canonicalStoreProjectSnapshot || !canonicalStoreProjectId) return null;
  const normalized = path.replace(/\/+$/, "");
  const detailProject = canonicalStoreProjectSnapshot.project as Record<string, unknown> | undefined;
  if (normalized === "/api/site-projects" && detailProject) {
    return jsonResponse({ projects: [detailProject] });
  }
  if (normalized === `/api/site-projects/${canonicalStoreProjectId}`) {
    return jsonResponse(canonicalStoreProjectSnapshot);
  }
  return null;
}

async function normalizeCanonicalStoreListing(response: Response) {
  if (!canonicalStoreProjectId || !response.ok) return response;
  const data = await response.clone().json().catch(() => null);
  if (!data || !Array.isArray(data.projects)) return response;
  const index = data.projects.findIndex((project: { id?: string }) => project?.id === canonicalStoreProjectId);
  if (index <= 0) return response;
  const projects = [...data.projects];
  const [active] = projects.splice(index, 1);
  projects.unshift(active);
  return new Response(JSON.stringify({ ...data, projects }), {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

export async function apiFetch(
  path: string,
  init?: RequestInit
) {
  const method = String(init?.method || "GET").toUpperCase();
  const cached = canonicalCachedResponse(path, method);
  if (cached) return cached;

  const response = await nativeFetch(apiUrl(path), {
    ...init,
    credentials: "include",
    headers: {
      ...init?.headers,
    },
  });
  if (method === "GET" && path.replace(/\/+$/, "") === "/api/site-projects") {
    return normalizeCanonicalStoreListing(response);
  }
  return response;
}