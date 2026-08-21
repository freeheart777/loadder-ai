import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { apiFetch } from "./api";

export type AuthUser = {
  id: string;
  mobile: string;
  name: string;
  email: string | null;
  status: string;
};

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

export type Membership = {
  id: string;
  role: "owner" | "admin" | "member";
  status: string;
  workspace: Workspace;
};

type AuthState = {
  user: AuthUser | null;
  memberships: Membership[];
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  loading: boolean;
  refreshSession: () => Promise<boolean>;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeWorkspace, setActiveWorkspace] =
    useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  const clearIdentity = useCallback(() => {
    setUser(null);
    setMemberships([]);
    setActiveWorkspace(null);
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const response = await apiFetch("/api/auth/me");
      if (!response.ok) {
        clearIdentity();
        return false;
      }

      const data = await response.json();
      setUser(data.user);
      setMemberships(data.memberships || []);
      setActiveWorkspace(data.activeWorkspace || null);
      return true;
    } catch {
      clearIdentity();
      return false;
    } finally {
      setLoading(false);
    }
  }, [clearIdentity]);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } finally {
      clearIdentity();
    }
  }, [clearIdentity]);

  const switchWorkspace = useCallback(async (workspaceId: string) => {
    const response = await apiFetch("/api/workspaces/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "Unable to switch workspace.");
    }
    setMemberships(data.memberships || []);
    setActiveWorkspace(data.activeWorkspace || null);
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const value = useMemo(
    () => ({
      user,
      memberships,
      workspaces: memberships.map((membership) => membership.workspace),
      activeWorkspace,
      loading,
      refreshSession,
      switchWorkspace,
      logout,
    }),
    [
      user,
      memberships,
      activeWorkspace,
      loading,
      refreshSession,
      switchWorkspace,
      logout,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
}

export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-[#03040b] text-sm text-white/60"
      >
        در حال بررسی نشست کاربری…
      </main>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/signup"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  return <Outlet />;
}
