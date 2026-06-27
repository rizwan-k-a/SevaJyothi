import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, BellRing, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { pushPermission, pushSupported, subscribeToPush } from "@/lib/push/client";

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  complaint_id: string | null;
  read_at: string | null;
  created_at: string;
};

const PAGE_SIZE = 30;

export function NotificationCenter() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(false);
  const [pushState, setPushState] = useState<"unsupported" | "default" | "granted" | "denied" | "busy">(
    pushSupported() ? (pushPermission() as "default" | "granted" | "denied") : "unsupported"
  );
  const rootRef = useRef<HTMLDivElement>(null);

  const unread = items.filter((n) => !n.read_at).length;

  // Initial fetch + realtime subscription scoped to this user.
  useEffect(() => {
    if (!user) { setItems([]); return; }
    let cancelled = false;

    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("notifications")
        .select("id,type,title,body,complaint_id,read_at,created_at")
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      if (!cancelled) setItems((data as Notif[]) ?? []);
      setLoading(false);
    })();

    const ch = supabase
      .channel(`notif:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => setItems((prev) => [payload.new as Notif, ...prev].slice(0, PAGE_SIZE)),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) =>
          setItems((prev) => prev.map((n) => (n.id === (payload.new as Notif).id ? (payload.new as Notif) : n))),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [user?.id]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const markAllRead = async () => {
    if (!user || unread === 0) return;
    const ids = items.filter((n) => !n.read_at).map((n) => n.id);
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })));
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
  };

  const markOne = async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  };

  if (!user) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        data-cursor="button"
        data-touch="icon"
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-full text-foreground/75 transition hover:bg-foreground/[0.06] hover:text-foreground"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-accent-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
            className="glass fixed left-2 right-2 top-[64px] z-50 overflow-hidden rounded-2xl shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-[340px]"
          >
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <div className="text-[13px] font-semibold">Notifications</div>
              <button
                type="button"
                onClick={markAllRead}
                disabled={unread === 0}
                className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground transition hover:text-foreground disabled:opacity-40"
                data-cursor="link"
              >
                <CheckCheck className="h-3 w-3" /> Mark all read
              </button>
            </div>
            {pushState !== "granted" && pushState !== "unsupported" && (
              <div className="flex items-start gap-3 border-b border-border/60 bg-accent/[0.04] px-4 py-3">
                <BellRing className="mt-0.5 h-4 w-4 flex-none text-accent" />
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-medium">Get real-time alerts</div>
                  <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                    {pushState === "denied"
                      ? "Notifications are blocked. Enable them in your browser settings to receive alerts when the app is closed."
                      : "Receive push notifications on this device even when SevaJyothi isn't open."}
                  </div>
                  {pushState !== "denied" && (
                    <button
                      type="button"
                      onClick={async () => {
                        setPushState("busy");
                        const r = await subscribeToPush();
                        setPushState(
                          r.status === "subscribed" ? "granted" : r.status === "denied" ? "denied" : "unsupported",
                        );
                      }}
                      disabled={pushState === "busy"}
                      className="mt-2 inline-flex h-9 items-center rounded-full bg-accent px-3.5 text-[12px] font-semibold text-accent-foreground transition hover:brightness-110 disabled:opacity-50"
                      data-cursor="cta"
                    >
                      {pushState === "busy" ? "Enabling…" : "Enable push"}
                    </button>
                  )}
                </div>
              </div>
            )}
            <div className="max-h-[60vh] overflow-y-auto">
              {loading && items.length === 0 && (
                <div className="px-4 py-8 text-center text-[12.5px] text-muted-foreground">Loading…</div>
              )}
              {!loading && items.length === 0 && (
                <div className="px-4 py-10 text-center text-[12.5px] text-muted-foreground">
                  You're all caught up.
                </div>
              )}
              {items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => markOne(n.id)}
                  className={`flex w-full items-start gap-3 border-b border-border/40 px-4 py-3 text-left transition hover:bg-foreground/[0.03] ${
                    !n.read_at ? "bg-accent/[0.04]" : ""
                  }`}
                  data-cursor="link"
                >
                  <span
                    className={`mt-1 h-1.5 w-1.5 flex-none rounded-full ${
                      !n.read_at ? "bg-accent" : "bg-transparent"
                    }`}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">{n.title}</div>
                    {n.body && (
                      <div className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">{n.body}</div>
                    )}
                    <div className="mt-1 text-[10.5px] uppercase tracking-wider text-muted-foreground/80">
                      {relativeTime(n.created_at)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
