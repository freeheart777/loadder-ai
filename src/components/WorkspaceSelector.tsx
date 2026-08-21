import { useState } from "react";

import { useAuth } from "../lib/auth";

export default function WorkspaceSelector() {
  const { workspaces, activeWorkspace, switchWorkspace } = useAuth();
  const [switching, setSwitching] = useState(false);

  if (!activeWorkspace) return null;

  async function handleChange(workspaceId: string) {
    if (workspaceId === activeWorkspace?.id) return;
    setSwitching(true);
    try {
      await switchWorkspace(workspaceId);
      window.location.reload();
    } finally {
      setSwitching(false);
    }
  }

  return (
    <label className="block">
      <span className="sr-only">فضای کاری فعال</span>
      <select
        aria-label="فضای کاری فعال"
        value={activeWorkspace.id}
        disabled={switching || workspaces.length < 2}
        onChange={(event) => void handleChange(event.target.value)}
        className="w-full rounded-xl border border-white/[0.08] bg-[#111118] px-3 py-2 text-sm text-white outline-none disabled:cursor-default disabled:opacity-70"
      >
        {workspaces.map((workspace) => (
          <option key={workspace.id} value={workspace.id}>
            {workspace.name}
          </option>
        ))}
      </select>
    </label>
  );
}
