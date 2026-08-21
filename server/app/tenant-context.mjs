import { AsyncLocalStorage } from "node:async_hooks";

const tenantStorage = new AsyncLocalStorage();

export function runWithWorkspace(workspaceId, callback) {
  return tenantStorage.run({ workspaceId }, callback);
}

export function requireWorkspaceId() {
  const workspaceId = tenantStorage.getStore()?.workspaceId;
  if (!workspaceId) {
    throw new Error("Workspace context is required for domain data access.");
  }
  return workspaceId;
}

