import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ChevronDown, CloudOff, CloudUpload, LogOut, MapPin, Plus, RefreshCw, Wifi } from "lucide-react";
import { getAllComplaints, type StoredComplaint } from "@/lib/offline/db";
import { useOffline } from "@/components/providers/OfflineProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORY_META } from "@/lib/complaints/meta";
import { LifecycleTimeline } from "@/components/complaints/LifecycleTimeline";
import { lazy, Suspense } from "react";
const ComplaintMap = lazy(() => import("@/components/map/ComplaintMap").then((m) => ({ default: m.ComplaintMap })));
function CitizenMiniMap(p: { id: string; lat: number; lng: number; priority: "low"|"normal"|"high"|"critical"; label: string; category: string }) {
  return (
    <Suspense fallback={<div className="grid h-[180px] place-items-center rounded-2xl bg-muted/30 text-[11px] text-muted-foreground">Loading map…</div>}>
      <ComplaintMap single height={180} points={[{ id: p.id, lat: p.lat, lng: p.lng, priority: p.priority, label: p.label, category: p.category }]} />
    </Suspense>
  );
}
import { DEMO_COMPLAINTS, isDemoMode } from "@/lib/demo/fixtures";

export const Route = createFileRoute("/citizen/")({
  head: () => ({ meta: [{ title: "Citizen dashboard · SevaJyothi" }] }),
  component: CitizenDashboard,
});

type RemoteRow = {
  id: string;
  client_id: string | null;
  category: keyof typeof CATEGORY_META;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  lat: number | null;
  lng: number | null;
};

function CitizenDashboard() {
  const { online, pending, refresh, flushNow } = useOffline();
  const { user, signOut } = useAuth();
  const [local, setLocal] = useState<StoredComplaint[]>([]);
  const [remote, setRemote] = useState<RemoteRow[]>([]);
  const [loadingRemote, setLoadingRemote] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const list = await getAllComplaints();
      if (!cancel) setLocal(list);
    })();
    return () => { cancel = true; };
  }, [pending.length]);

  const loadRemote = async () => {
    if (isDemoMode()) {
      setRemote(DEMO_COMPLAINTS.map((c) => ({
        id: c.id, client_id: c.client_id, category: c.category as any,
        description: c.description, status: c.status, priority: c.priority,
        created_at: c.created_at, lat: c.lat, lng: c.lng,
      })));
      setLoadingRemote(false);
      return;
    }
    if (!user) return;
    setLoadingRemote(true);
    const { data } = await supabase
      .from("complaints")
      .select("id,client_id,category,description,status,priority,created_at,lat,lng")
      .eq("reporter_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setRemote((data ?? []) as RemoteRow[]);
    setLoadingRemote(false);
  };

  useEffect(() => { loadRemote(); /* eslint-disable-next-line */ }, [user?.id, pending.length]);

  // Realtime updates for this citizen's complaints.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`citizen-complaints-${user.id}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "complaints",
        filter: `reporter_id=eq.${user.id}`,
      }, () => loadRemote())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Merge: pending local items that haven't been synced yet + remote rows.
  const items = useMemo(() => {
    const syncedClientIds = new Set(remote.map((r) => r.client_id).filter(Boolean));
    const unsynced = local.filter((c) => !syncedClientIds.has(c.id) && c.status === "pending_sync");
    return { unsynced, remote };
  }, [local, remote]);

  const resolved = remote.filter((c) => c.status === "resolved" || c.status === "closed").length;
  const inProgress = remote.filter((c) => !["submitted", "resolved", "closed"].includes(c.status)).length;
  const submitted = remote.filter((c) => c.status === "submitted").length;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-20 pb-28 sm:px-6 sm:pt-32 sm:pb-24" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 96px)", WebkitOverflowScrolling: "touch" }}>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 sm:mb-10 sm:gap-6">
        <div className="min-w-0">
          <div className="text-mono-data text-[11px] uppercase tracking-[0.16em] text-accent">Citizen workspace</div>
          <h1 className="mt-2 text-display text-[clamp(1.75rem,6vw,3rem)]">
            Good to see you,{" "}
            <span className="text-accent-script text-accent text-[1.25em] leading-[0.6]">
              {(user?.user_metadata?.display_name as string)?.split(" ")[0] || user?.email?.split("@")[0] || "friend"}
            </span>.
          </h1>
          <p className="mt-2 max-w-xl text-[14px] text-muted-foreground sm:text-[14.5px]">
            Report a new failure, or check the status of what you've already raised. Everything you log here is safe — even without signal.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NetworkBadge online={online} />
          <button
            onClick={() => signOut()}
            className="glass inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 py-2 text-[12px] text-muted-foreground hover:text-foreground"
            data-cursor="button"
          >
            <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:mb-8 sm:grid-cols-4">
        <StatTile label="Queued" value={pending.length} accent="warning" icon={CloudOff} />
        <StatTile label="Received" value={submitted} accent="accent" icon={CloudUpload} />
        <StatTile label="In progress" value={inProgress} accent="accent" icon={RefreshCw} />
        <StatTile label="Resolved" value={resolved} accent="success" icon={Wifi} />
      </div>

      {/* Desktop / tablet hero CTA */}
      <Link
        to="/citizen/report"
        data-cursor="cta"
        className="group glass relative mb-8 hidden items-center justify-between overflow-hidden rounded-3xl p-7 transition hover:bg-white/80 sm:flex"
      >
        <div>
          <div className="text-display text-[26px]">Report an infrastructure failure</div>
          <div className="mt-1 text-[14px] text-muted-foreground">Photo · GPS · Category · Sync. Two taps.</div>
        </div>
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform group-hover:scale-105">
          <Plus className="h-5 w-5" />
        </span>
      </Link>

      {items.unsynced.length > 0 && (
        <section className="mb-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-display text-2xl">Pending sync queue</h2>
            <button onClick={() => { refresh(); flushNow(); }} className="text-mono-data text-[11px] uppercase tracking-[0.14em] text-accent hover:underline" data-cursor="link">
              Retry sync
            </button>
          </div>
          <div className="glass rounded-3xl p-2">
            {items.unsynced.map((c) => <LocalRow key={c.id} c={c} />)}
          </div>
          <p className="mt-3 px-2 text-[12.5px] text-muted-foreground">
            <span className="text-foreground">Stored securely in IndexedDB.</span> {online ? "Reconnecting now…" : "Waiting for signal. We'll sync automatically."}
          </p>
        </section>
      )}

      <section>
        <h2 className="mb-4 text-display text-2xl">Complaint history</h2>
        <div className="glass rounded-3xl p-2">
          {loadingRemote ? (
            <div className="px-6 py-12 text-center text-[13px] text-muted-foreground">Loading from the network…</div>
          ) : items.remote.length === 0 && items.unsynced.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/5 text-primary">
                <MapPin className="h-5 w-5" />
              </div>
              <div className="text-[14px] text-muted-foreground">No reports yet — your queue is clear.</div>
            </div>
          ) : (
            items.remote.map((c) => <RemoteRow key={c.id} c={c} />)
          )}
        </div>
      </section>

      {/* Thumb-reach bottom dock — mobile only. Primary action lives at the bottom
          of the screen so one-handed field users never stretch to the top nav. */}
      <Link
        to="/citizen/report"
        data-cursor="cta"
        className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-between gap-3 rounded-full bg-primary px-5 py-3.5 text-primary-foreground shadow-2xl mb-safe sm:hidden"
        style={{ paddingBottom: "calc(0.875rem + env(safe-area-inset-bottom))" }}
      >
        <span className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-white/15">
            <Plus className="h-5 w-5" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Report a failure</span>
        </span>
        <span className="text-mono-data text-[11px] uppercase tracking-[0.16em] opacity-80">Two taps</span>
      </Link>
    </div>
  );
}

function NetworkBadge({ online }: { online: boolean }) {
  return (
    <motion.div
      animate={{ scale: [1, 1.02, 1] }}
      transition={{ duration: 3, repeat: Infinity }}
      className="glass inline-flex items-center gap-2.5 rounded-full px-4 py-2 text-[12.5px] font-medium"
    >
      <span className="relative inline-flex h-2.5 w-2.5">
        <span className="absolute inset-0 animate-sj-pulse-ring rounded-full"
          style={{ background: online ? "oklch(0.70 0.16 162)" : "oklch(0.62 0.23 27)", opacity: 0.6 }} />
        <span className="relative inline-block h-2.5 w-2.5 rounded-full"
          style={{ background: online ? "oklch(0.70 0.16 162)" : "oklch(0.62 0.23 27)" }} />
      </span>
      {online ? "Network connected" : "Offline — safe mode"}
    </motion.div>
  );
}

function StatTile({ label, value, accent, icon: Icon }:
  { label: string; value: number; accent: "warning" | "accent" | "success"; icon: any }) {
  const color =
    accent === "warning" ? "oklch(0.78 0.15 75)" :
    accent === "success" ? "oklch(0.70 0.16 162)" :
                            "oklch(0.58 0.21 264)";
  return (
    <motion.div whileHover={{ y: -3 }} data-cursor="card" className="glass relative overflow-hidden rounded-2xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[12px] font-medium text-muted-foreground">{label}</div>
          <div className="mt-2 text-mono-data text-[32px] leading-none text-ink">{value.toString().padStart(2, "0")}</div>
        </div>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background: color.replace(")", " / 0.12)"), color }}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </motion.div>
  );
}

function LocalRow({ c }: { c: StoredComplaint }) {
  const meta = CATEGORY_META[c.category];
  const time = new Date(c.createdAt).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  return (
    <div className="group flex items-center gap-4 rounded-2xl p-4 transition hover:bg-white/60" data-cursor="card">
      <div className="grid h-12 w-12 place-items-center rounded-xl" style={{ background: `${meta.color}1A`, color: meta.color }}>
        <meta.icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[14.5px] font-medium text-foreground">{meta.label}</span>
          <StatusPill label="Queued" tone="warn" />
          {c.syncError && (
            <span className="inline-flex items-center gap-1 text-[10.5px] text-danger">
              <AlertCircle className="h-3 w-3" /> {c.syncError}
              {c.attempt_count ? ` · attempt ${c.attempt_count}` : ""}
              {c.next_retry_at && c.next_retry_at > Date.now()
                ? ` · retry in ${Math.max(1, Math.round((c.next_retry_at - Date.now()) / 1000))}s`
                : ""}
            </span>
          )}
        </div>
        <div className="truncate text-[13px] text-muted-foreground">{c.description || "No description provided."}</div>
      </div>
      <div className="text-right text-mono-data text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        {time}
        {c.lat != null && (
          <div className="mt-0.5 inline-flex items-center gap-1 text-[10.5px]">
            <MapPin className="h-3 w-3" /> {c.lat.toFixed(3)}, {c.lng?.toFixed(3)}
          </div>
        )}
      </div>
    </div>
  );
}

function RemoteRow({ c }: { c: RemoteRow }) {
  const meta = CATEGORY_META[c.category];
  const time = new Date(c.created_at).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const tone =
    c.status === "resolved" || c.status === "closed" ? "ok" :
    c.status === "submitted" ? "info" : "progress";
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl transition hover:bg-white/60" data-cursor="card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-4 rounded-2xl p-4 text-left"
        aria-expanded={open}
      >
        <div className="grid h-12 w-12 place-items-center rounded-xl" style={{ background: `${meta.color}1A`, color: meta.color }}>
          <meta.icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[14.5px] font-medium text-foreground">{meta.label}</span>
            <StatusPill label={statusLabel(c.status)} tone={tone} />
            {c.priority !== "normal" && (
              <span className="text-mono-data text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                · {c.priority}
              </span>
            )}
          </div>
          <div className="truncate text-[13px] text-muted-foreground">{c.description}</div>
        </div>
        <div className="text-right text-mono-data text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          {time}
          {c.lat != null && (
            <div className="mt-0.5 inline-flex items-center gap-1 text-[10.5px]">
              <MapPin className="h-3 w-3" /> {c.lat.toFixed(3)}, {c.lng?.toFixed(3)}
            </div>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-border/60 p-3">
          {c.lat != null && c.lng != null && (
            <CitizenMiniMap
              id={c.id}
              lat={c.lat}
              lng={c.lng}
              priority={(c.priority as "low"|"normal"|"high"|"critical") ?? "normal"}
              label={c.description}
              category={meta.label}
            />
          )}
          <LifecycleTimeline complaintId={c.id} createdAt={c.created_at} />
        </div>
      )}
    </div>
  );
}

function statusLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function StatusPill({ label, tone }: { label: string; tone: "warn" | "info" | "progress" | "ok" }) {
  const map = {
    warn:     { bg: "oklch(0.78 0.15 75 / 0.15)",  fg: "oklch(0.55 0.15 75)" },
    info:     { bg: "oklch(0.58 0.21 264 / 0.12)", fg: "oklch(0.42 0.18 264)" },
    progress: { bg: "oklch(0.58 0.21 264 / 0.18)", fg: "oklch(0.38 0.18 264)" },
    ok:       { bg: "oklch(0.70 0.16 162 / 0.18)", fg: "oklch(0.42 0.14 162)" },
  } as const;
  const s = map[tone];
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-mono-data text-[10px] uppercase tracking-[0.12em]"
      style={{ background: s.bg, color: s.fg }}>
      {label}
    </span>
  );
}
