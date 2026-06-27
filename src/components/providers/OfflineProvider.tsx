import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { flushPendingComplaints, getPendingComplaints, type StoredComplaint } from "@/lib/offline/db";
import { useAuth } from "@/components/providers/AuthProvider";
import { toast } from "sonner";

type Ctx = {
  online: boolean;
  pending: StoredComplaint[];
  refresh: () => Promise<void>;
  flushNow: () => Promise<number>;
};

const OfflineCtx = createContext<Ctx>({
  online: true,
  pending: [],
  refresh: async () => {},
  flushNow: async () => 0,
});

export function OfflineProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [online, setOnline] = useState<boolean>(typeof navigator === "undefined" ? true : navigator.onLine);
  const [pending, setPending] = useState<StoredComplaint[]>([]);
  // Re-entry guard: prevents the 5s ticker and the `online` event from
  // racing the same flush against the same IndexedDB rows.
  const flushing = useRef(false);

  const refresh = async () => {
    try {
      setPending(await getPendingComplaints());
    } catch (err) {
      // IndexedDB unavailable (private mode) or corrupt — fail closed, never crash UI.
      if (import.meta.env.DEV) console.warn("[offline] queue read failed", err);
    }
  };

  const flushNow = async () => {
    if (flushing.current) return 0;
    if (!navigator.onLine || !user) { await refresh(); return 0; }
    flushing.current = true;
    try {
      const n = await flushPendingComplaints();
      await refresh();
      if (n > 0) {
        toast.success(`${n} report${n > 1 ? "s" : ""} synced`, {
          description: "Your queued complaints reached the network.",
        });
      }
      return n;
    } finally {
      flushing.current = false;
    }
  };

  useEffect(() => {
    refresh();

    // Request persistent storage to protect IndexedDB queue & offline images
    // from browser eviction (Chromium + Firefox honour this; Safari ignores).
    if (typeof navigator !== "undefined" && navigator.storage?.persist) {
      navigator.storage.persisted().then((already) => {
        if (!already) navigator.storage.persist().catch(() => {});
      }).catch(() => {});
    }

    const handleOnline = () => { setOnline(true); flushNow(); };
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
    if (user && navigator.onLine) flushNow();

    // Backoff retry ticker: every 5s, attempt to flush — pushOne respects
    // each item's next_retry_at so this is cheap and correct.
    const tick = window.setInterval(() => {
      if (navigator.onLine && user) flushNow();
    }, 5000);


    // Register service worker (prod only).
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      import.meta.env.PROD &&
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
      window.clearInterval(tick);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", onSwMessage);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <OfflineCtx.Provider value={{ online, pending, refresh, flushNow }}>
      {children}
    </OfflineCtx.Provider>
  );
}

export function useOffline() {
  return useContext(OfflineCtx);
}
