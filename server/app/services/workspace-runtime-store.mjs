export function createWorkspaceRuntimeStore(createDefaultValue) {
  const values = new Map();

  function key(workspaceId, resourceId) {
    if (!workspaceId || !resourceId) {
      throw new Error("Workspace and resource IDs are required.");
    }
    return `${workspaceId}:${resourceId}`;
  }

  return {
    get(workspaceId, resourceId) {
      const scopedKey = key(workspaceId, resourceId);
      if (!values.has(scopedKey)) {
        values.set(scopedKey, createDefaultValue());
      }
      return values.get(scopedKey);
    },
    set(workspaceId, resourceId, value) {
      values.set(key(workspaceId, resourceId), value);
      return value;
    },
  };
}
