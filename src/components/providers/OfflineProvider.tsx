import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  flushPendingComplaints,
  getPendingComplaints,
  type StoredComplaint,
} from "@/lib/offline/db";
import { useAuth } from "@/components/providers/AuthProvider";
import { toast } from "sonner";

type Ctx = {
  online: boolean;
  pending: StoredComplaint[];
  refresh: () => Promise<void>;
  flushNow: (force?: boolean) => Promise<number>;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  checkConnection: () => Promise<boolean>;
};

const OfflineCtx = createContext<Ctx>({
  online: true,
  pending: [],
  refresh: async () => {},
  flushNow: async () => 0,
  isSyncing: false,
  lastSyncTime: null,
  checkConnection: async () => false,
});

export function OfflineProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [online, setOnline] = useState<boolean>(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [pending, setPending] = useState<StoredComplaint[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(() => {
    try {
      const stored = localStorage.getItem("sj-last-sync");
      return stored ? new Date(parseInt(stored)) : null;
    } catch {
      return null;
    }
  });

  // Re-entry guard: prevents the 5s ticker and the `online` event from
  // racing the same flush against the same IndexedDB rows.
  const flushing = useRef(false);

  const refresh = async () => {
    try {
      const newPending = await getPendingComplaints();
      setPending((prev) => {
        if (prev.length !== newPending.length) return newPending;
        // Compare IDs to see if they are genuinely different
        const prevIds = prev.map((p) => p.id).join(",");
        const newIds = newPending.map((p) => p.id).join(",");
        if (prevIds !== newIds) return newPending;
        // Compare statuses
        const prevStatus = prev.map((p) => p.status).join(",");
        const newStatus = newPending.map((p) => p.status).join(",");
        if (prevStatus !== newStatus) return newPending;
        return prev; // Same data, prevent re-render
      });
    } catch (err) {
      // IndexedDB unavailable (private mode) or corrupt — fail closed, never crash UI.
      if (import.meta.env.DEV) console.warn("[offline] queue read failed", err);
    }
  };

  const checkConnection = async (): Promise<boolean> => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return false;
    try {
      // Lightweight backend ping
      const { error } = await supabase.from("profiles").select("id").limit(1);
      return !error || error.code !== "FETCH_ERROR";
    } catch {
      return false;
    }
  };

  const flushNow = async (force = false) => {
    if (flushing.current) return 0;
    if (!user) {
      await refresh();
      return 0;
    }
    
    // Always verify true backend connectivity before flushing
    const isReachable = await checkConnection();
    if (!isReachable) {
      setOnline(false);
      await refresh();
      return 0;
    }
    setOnline(true);

    flushing.current = true;
    setIsSyncing(true);
    try {
      const n = await flushPendingComplaints(force);
      await refresh();
      if (n > 0) {
        const now = new Date();
        setLastSyncTime(now);
        localStorage.setItem("sj-last-sync", now.getTime().toString());
        toast.success(`${n} report${n > 1 ? "s" : ""} synced`, {
          description: "Your queued complaints reached the network.",
        });
      }
      return n;
    } finally {
      flushing.current = false;
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    refresh();

    // Request persistent storage to protect IndexedDB queue & offline images
    // from browser eviction (Chromium + Firefox honour this; Safari ignores).
    if (typeof navigator !== "undefined" && navigator.storage?.persist) {
      navigator.storage
        .persisted()
        .then((already) => {
          if (!already) navigator.storage.persist().catch(() => {});
        })
        .catch(() => {});
    }

    const handleOnline = async () => {
      const isReachable = await checkConnection();
      if (isReachable) {
        setOnline(true);
        flushNow(true);
      }
    };
    const handleOffline = () => {
      setOnline(false);
      toast.message("Signal lost", {
        description: "New reports will be stored securely and synced automatically.",
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Service worker → client message bridge (BackgroundSync wakeup).
    const onSwMessage = (e: MessageEvent) => {
      if (e.data?.type === "sj:sync-pending") flushNow();
    };
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", onSwMessage);
    }

    // Sync immediately whenever a session appears (user just logged in).
    if (user && navigator.onLine) flushNow(true);

    // Register service worker unconditionally for offline support in dev & prod.
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      window === window.parent &&
      !/^(id-preview--|preview--)/.test(location.hostname) &&
      !/\.lovableproject(-dev)?\.com$/.test(location.hostname) &&
      !location.search.includes("sw=off")
    ) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", onSwMessage);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // Only runs on mount and when user identity changes

  useEffect(() => {
    // Intelligent backoff retry scheduler:
    // Only schedule a flush if there are pending items and we are online.
    let syncTimer: number | undefined;
    if (online && user && pending.length > 0) {
      const now = Date.now();
      let earliestRetry = Infinity;
      for (const item of pending) {
        if (!item.next_retry_at) {
          earliestRetry = now; // Ready now
          break;
        }
        if (item.next_retry_at < earliestRetry) {
          earliestRetry = item.next_retry_at;
        }
      }

      const delay = Math.max(0, earliestRetry - now);
      // Wait until the earliest retry time, but cap at 1 minute just in case of state drift.
      const timeoutMs = Math.min(delay, 60000);
      syncTimer = window.setTimeout(() => flushNow(), timeoutMs);
    }

    return () => window.clearTimeout(syncTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, online, pending]);

  return (
    <OfflineCtx.Provider value={{ online, pending, refresh, flushNow, isSyncing, lastSyncTime, checkConnection }}>
      {children}
    </OfflineCtx.Provider>
  );
}

export function useOffline() {
  return useContext(OfflineCtx);
}
