import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/config/supabase";
export type AppRole = "citizen" | "technician" | "authority";

type Ctx = {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
};

const AuthCtx = createContext<Ctx>({
  user: null,
  session: null,
  roles: [],
  loading: true,
  signOut: async () => {},
  refreshRoles: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRoles = async (uid: string | undefined | null) => {
    if (!uid) {
      setRoles([]);
      localStorage.removeItem("sj-roles");
      return;
    }
    try {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      if (error) {
        // If it's a network error, keep using the cached roles.
        // Don't overwrite state with [] on transient failure.
        console.warn("Failed to fetch roles, using cache if available.", error);
        return;
      }
      const fetchedRoles = (data ?? []).map((r) => r.role as AppRole);
      setRoles(fetchedRoles);
      localStorage.setItem("sj-roles", JSON.stringify(fetchedRoles));
    } catch (err) {
      console.warn("Role fetch failed:", err);
    }
  };

  useEffect(() => {
    // Attempt to hydrate from cache immediately
    try {
      const cached = localStorage.getItem("sj-roles");
      if (cached) setRoles(JSON.parse(cached));
    } catch {
      // ignore
    }

    // CRITICAL: synchronous listener first, then a one-shot getSession.
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setUser(s?.user ?? null);

      if (event === "SIGNED_OUT") {
        setRoles([]);
        localStorage.removeItem("sj-roles");
      } else if (s?.user) {
        // Defer DB lookups to avoid deadlocking the callback.
        setTimeout(() => loadRoles(s.user!.id), 0);
      } else {
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        // We rely on onAuthStateChange INITIAL_SESSION for role loading
        // to avoid duplicate requests, but we ensure loading is set to false.
        setLoading(false);
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <AuthCtx.Provider
      value={{
        user,
        session,
        roles,
        loading,
        signOut: async () => {
          localStorage.removeItem("sj-roles");
          await supabase.auth.signOut();
        },
        refreshRoles: async () => {
          await loadRoles(user?.id);
        },
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}

export function useHasRole(role: AppRole): boolean {
  const { roles } = useAuth();
  return roles.includes(role);
}
