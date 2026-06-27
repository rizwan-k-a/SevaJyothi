import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Activity, Filter, MapPin, ShieldOff, Users, Flame } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORY_META } from "@/lib/complaints/meta";
import type { ComplaintCategory } from "@/lib/offline/db";
import { DEMO_COMPLAINTS, DEMO_STATS, isDemoMode, resetDemoMode } from "@/lib/demo/fixtures";

const ComplaintMap = lazy(() => import("@/components/map/ComplaintMap").then((m) => ({ default: m.ComplaintMap })));

type StatsV2 = {
  total: number; open: number; resolved: number; critical_open: number; last_24h: number;
  mtta_hours: number; mttr_hours: number; sla_pct_within_24h: number;
  by_district: Record<string, number>; by_category: Record<string, number>;
  workload: Array<{ technician_id: string; display_name: string | null; open_jobs: number }>;
  aging: { under_24h: number; one_to_three_days: number; three_to_seven_days: number; over_seven_days: number };
  failed_syncs_7d: number; active_technicians: number;
};

type AuditRow = { id: number; created_at: string; actor_id: string | null; event_type: string; complaint_id: string | null; metadata: any };


export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Authority command centre · SevaJyothi" }] }),
  component: AdminPage,
});

type Row = {
  id: string;
  category: ComplaintCategory;
  description: string;
  status: "submitted" | "triaged" | "assigned" | "en_route" | "on_site" | "resolved" | "closed";
  priority: "low" | "normal" | "high" | "critical";
  priority_score: number;
  created_at: string;
  lat: number | null;
  lng: number | null;
  accuracy?: number | null;
  village: string | null;
  reporter_id: string;
  assigned_to: string | null;
};

type Tech = { id: string; display_name: string | null; village: string | null };

const STATUSES: Row["status"][] = ["submitted", "triaged", "assigned", "en_route", "on_site", "resolved", "closed"];
const PRIORITIES: Row["priority"][] = ["low", "normal", "high", "critical"];

function AdminPage() {
  const navigate = useNavigate();
  const { user, roles, loading } = useAuth();
  const demo = isDemoMode();
  const isAuthority = demo || roles.includes("authority");
  const [rows, setRows] = useState<Row[]>([]);
  const [techs, setTechs] = useState<Tech[]>([]);
  const [stats, setStats] = useState<StatsV2 | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [filterCat, setFilterCat] = useState<"all" | ComplaintCategory>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | Row["status"]>("all");
  const [mapPriorities, setMapPriorities] = useState<Set<Row["priority"]>>(
    () => new Set(["critical", "high", "normal", "low"] as Row["priority"][]),
  );
  const [mapAssignee, setMapAssignee] = useState<"all" | "unassigned" | string>("all");
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [hotspots, setHotspots] = useState<Array<{ lat: number; lng: number; incidents: number; total_priority: number }>>([]);
  const [risk, setRisk] = useState<Array<{ village: string; category: string; incidents_90d: number; recurrence_rate: number; avg_priority: number; risk_score: number }>>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const togglePriority = (p: Row["priority"]) => {
    setMapPriorities((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p); else next.add(p);
      // never empty — re-enable all if user clears the last one
      return next.size === 0 ? new Set(["critical", "high", "normal", "low"] as Row["priority"][]) : next;
    });
  };

  useEffect(() => {
    if (demo) return;
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate, demo]);

  const load = async () => {
    if (demo) {
      setRows(DEMO_COMPLAINTS as Row[]);
      setStats({
        ...DEMO_STATS,
        critical_open: DEMO_STATS.critical,
        last_24h: DEMO_STATS.last24h,
        mtta_hours: 1.8, mttr_hours: DEMO_STATS.avg_resolution_hours,
        sla_pct_within_24h: 75,
        by_district: { Anekal: 2, Sarjapur: 1, Hesaraghatta: 1, Bannerghatta: 1, Yelahanka: 1 },
        by_category: { transformer: 1, network_tower: 1, water_pipe: 1, sewage_leak: 1, road_damage: 1, street_light: 1 },
        workload: [
          { technician_id: "demo-tech-1", display_name: "Ravi Kumar", open_jobs: 2 },
          { technician_id: "demo-tech-2", display_name: "Lakshmi Devi", open_jobs: 2 },
        ],
        aging: { under_24h: 4, one_to_three_days: 1, three_to_seven_days: 1, over_seven_days: 0 },
        failed_syncs_7d: 0,
      } as StatsV2);
      setTechs([
        { id: "demo-tech-1", display_name: "Ravi Kumar",   village: "Anekal" },
        { id: "demo-tech-2", display_name: "Lakshmi Devi", village: "Sarjapur" },
      ]);
      setAudit([]);
      return;
    }
    const [complaints, techRoles, statsRes, auditRes, hotspotsRes, riskRes] = await Promise.all([
      supabase.from("complaints").select("*")
        .order("priority_score", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("user_roles").select("user_id").eq("role", "technician"),
      supabase.rpc("admin_complaint_stats_v2" as any),
      supabase.from("system_audit_logs" as any).select("*").order("created_at", { ascending: false }).limit(40),
      supabase.rpc("admin_complaint_hotspots" as any, { _min_incidents: 2 } as any),
      supabase.rpc("admin_predictive_risk" as any),
    ]);
    if (complaints.data) setRows(complaints.data as Row[]);
    if (statsRes.data) setStats(statsRes.data as StatsV2);
    setAudit((auditRes.data ?? []) as unknown as AuditRow[]);
    setHotspots(((hotspotsRes.data ?? []) as unknown as Array<{ lat: number; lng: number; incidents: number; total_priority: number }>));
    setRisk(((riskRes.data ?? []) as unknown as typeof risk));
    const techIds = (techRoles.data ?? []).map((r) => r.user_id);
    if (techIds.length) {
      const { data } = await supabase.from("profiles").select("id,display_name,village").in("id", techIds);
      setTechs((data ?? []) as Tech[]);
    } else {
      setTechs([]);
    }
  };

  useEffect(() => {
    if (!isAuthority) return;
    load();
    if (demo) return;
    const ch = supabase
      .channel("admin-complaints")
      .on("postgres_changes", { event: "*", schema: "public", table: "complaints" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isAuthority, demo]);

  const filtered = useMemo(
    () => rows
      .filter((r) =>
        (filterCat === "all" || r.category === filterCat) &&
        (filterStatus === "all" || r.status === filterStatus),
      )
      .sort((a, b) => (b.priority_score ?? 0) - (a.priority_score ?? 0) ||
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [rows, filterCat, filterStatus],
  );

  const setStatus = async (id: string, status: Row["status"]) => {
    if (demo) { setRows((r) => r.map((x) => x.id === id ? { ...x, status } : x)); return; }
    setBusyId(id);
    const patch: any = { status };
    if (status === "resolved") patch.resolved_at = new Date().toISOString();
    const { error } = await supabase.from("complaints").update(patch).eq("id", id);
    if (!error) await supabase.from("complaint_events").insert({ complaint_id: id, event: `status:${status}`, actor_id: user?.id });
    setBusyId(null);
  };
  const setPriority = async (id: string, priority: Row["priority"]) => {
    if (demo) { setRows((r) => r.map((x) => x.id === id ? { ...x, priority } : x)); return; }
    setBusyId(id);
    await supabase.from("complaints").update({ priority }).eq("id", id);
    await supabase.from("complaint_events").insert({ complaint_id: id, event: `priority:${priority}`, actor_id: user?.id });
    setBusyId(null);
  };
  const assign = async (id: string, tech: string | null) => {
    if (demo) { setRows((r) => r.map((x) => x.id === id ? { ...x, assigned_to: tech, status: tech ? "assigned" : "triaged" } : x)); return; }
    setBusyId(id);
    await supabase.from("complaints").update({
      assigned_to: tech,
      status: tech ? "assigned" : "triaged",
    }).eq("id", id);
    await supabase.from("complaint_events").insert({ complaint_id: id, event: tech ? `assigned:${tech}` : "unassigned", actor_id: user?.id });
    setBusyId(null);
  };

  if (loading) return <Shell><div className="text-muted-foreground">Loading…</div></Shell>;
  if (!isAuthority) {
    return (
      <Shell>
        <div className="glass mx-auto max-w-md rounded-3xl p-10 text-center">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-danger/10 text-danger">
            <ShieldOff className="h-6 w-6" />
          </div>
          <div className="text-mono-data text-[11px] uppercase tracking-[0.18em] text-danger">Restricted</div>
          <h1 className="mt-2 text-display text-3xl">Authority access required</h1>
          <p className="mt-3 text-[14px] text-muted-foreground">
            Your account does not have the <span className="text-foreground">authority</span> role.
            Ask a SevaJyothi administrator to grant access to this command centre.
          </p>
          <div className="mt-4 text-mono-data text-[11px] text-muted-foreground">
            UID · <span className="text-foreground">{user?.id}</span>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {demo && (
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-3 py-1 text-mono-data text-[10.5px] uppercase tracking-[0.16em] text-accent">
          Demo mode · seeded Karnataka data · no writes
          <button onClick={() => resetDemoMode()} className="ml-2 rounded-full bg-accent/10 px-2 py-0.5 text-accent hover:bg-accent/20">Exit</button>
        </div>
      )}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-mono-data text-[11px] uppercase tracking-[0.16em] text-accent">Authority workspace</div>
          <h1 className="mt-2 text-display text-[clamp(2rem,4vw,3rem)]">
            Incident{" "}
            <span className="text-accent-script text-accent text-[1.25em] leading-[0.6]">command</span>.
          </h1>
        </div>
        <div className="flex items-center gap-2 text-[12px]">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <select value={filterCat} onChange={(e) => setFilterCat(e.target.value as any)}
            className="glass rounded-full px-3 py-1.5">
            <option value="all">All categories</option>
            {Object.entries(CATEGORY_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}
            className="glass rounded-full px-3 py-1.5">
            <option value="all">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="mb-6 grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
        <Stat label="Open" value={stats?.open ?? 0} />
        <Stat label="Critical" value={stats?.critical_open ?? 0} tone="danger" />
        <Stat label="New 24h" value={stats?.last_24h ?? 0} tone="accent" />
        <Stat label="MTTA (h)" value={stats?.mtta_hours ?? 0} />
        <Stat label="MTTR (h)" value={stats?.mttr_hours ?? 0} />
        <Stat label="SLA ≤24h %" value={stats?.sla_pct_within_24h ?? 0} tone="accent" />
        <Stat label="Sync fails 7d" value={stats?.failed_syncs_7d ?? 0} tone={stats?.failed_syncs_7d ? "danger" : "neutral"} />
      </div>

      <div className="mb-6 grid gap-3 lg:grid-cols-[1.6fr_1fr]">
        <div className="glass rounded-3xl p-3">
          <div className="mb-2 px-2 flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 text-[12px] font-medium text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> Infrastructure map
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {(["critical","high","normal","low"] as Row["priority"][]).map((p) => {
                const c = p === "critical" ? "#ef4444" : p === "high" ? "#f97316" : p === "normal" ? "#3b82f6" : "#94a3b8";
                const on = mapPriorities.has(p);
                return (
                  <button key={p} onClick={() => togglePriority(p)}
                    className={`text-mono-data inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] uppercase tracking-[0.12em] transition ${on ? "border-foreground/20 bg-white text-foreground" : "border-border/60 bg-transparent text-muted-foreground opacity-55"}`}
                    aria-pressed={on}>
                    <span className="h-2 w-2 rounded-full" style={{ background: c, boxShadow: on && p === "critical" ? `0 0 8px ${c}` : undefined }} />
                    {p}
                  </button>
                );
              })}
              <select value={mapAssignee} onChange={(e) => setMapAssignee(e.target.value)}
                className="rounded-full border border-border/60 bg-white px-2 py-0.5 text-[11px]"
                aria-label="Filter map by technician">
                <option value="all">All technicians</option>
                <option value="unassigned">Unassigned</option>
                {techs.map((t) => <option key={t.id} value={t.id}>{t.display_name ?? t.id.slice(0, 8)}</option>)}
              </select>
              <button onClick={() => setShowHeatmap((v) => !v)}
                aria-pressed={showHeatmap}
                className={`text-mono-data inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] uppercase tracking-[0.12em] transition ${showHeatmap ? "border-accent/40 bg-accent/10 text-accent" : "border-border/60 bg-transparent text-muted-foreground"}`}>
                heatmap
              </button>
            </div>
          </div>
          {(() => {
            const mapPts = filtered
              .filter((r) => r.lat != null && r.lng != null)
              .filter((r) => mapPriorities.has(r.priority))
              .filter((r) =>
                mapAssignee === "all" ? true
                : mapAssignee === "unassigned" ? !r.assigned_to
                : r.assigned_to === mapAssignee,
              );
            return (
              <>
                <div className="mb-2 px-2 text-mono-data text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
                  {mapPts.length} on map · {filtered.length} matching list · {hotspots.length} hotspots
                </div>
                <Suspense fallback={<div className="grid h-[360px] place-items-center text-[12px] text-muted-foreground">Loading map…</div>}>
                  <ComplaintMap
                    points={mapPts.map((r) => ({
                      id: r.id, lat: r.lat!, lng: r.lng!,
                      priority: r.priority, category: CATEGORY_META[r.category].label,
                      label: r.description.slice(0, 80),
                    }))}
                    height={360}
                    heatmap={showHeatmap}
                    hotspots={hotspots}
                  />
                </Suspense>
              </>
            );
          })()}
        </div>
        <div className="grid gap-3">
          <div className="glass rounded-2xl p-4">
            <div className="mb-2 text-[12px] font-medium text-muted-foreground">Aging buckets · open</div>
            <AgingBar a={stats?.aging} />
          </div>
          <div className="glass rounded-2xl p-4">
            <div className="mb-2 text-[12px] font-medium text-muted-foreground">By district</div>
            {stats && Object.keys(stats.by_district).length > 0
              ? <BreakdownRows data={stats.by_district} />
              : <div className="text-[12px] text-muted-foreground">No data yet.</div>}
          </div>
        </div>
      </div>


      <div className="glass rounded-3xl p-2">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-[13px] text-muted-foreground">Nothing matches these filters.</div>
        ) : (
          filtered.map((r) => {
            const stripe = r.priority_score >= 100 ? "oklch(0.62 0.23 27)"
              : r.priority_score >= 80 ? "oklch(0.70 0.18 50)"
              : r.priority_score >= 50 ? "oklch(0.58 0.21 264)"
              : "oklch(0.75 0.04 265)";
            return (
            <div key={r.id} className="relative grid grid-cols-12 items-center gap-3 rounded-2xl p-4 pl-5 transition hover:bg-white/60">
              <span aria-hidden className="absolute left-1.5 top-3 bottom-3 w-1 rounded-full" style={{ background: stripe }} />
              <div className="col-span-12 flex items-center gap-3 sm:col-span-5">
                <div className="grid h-11 w-11 place-items-center rounded-xl"
                  style={{ background: `${CATEGORY_META[r.category].color}1A`, color: CATEGORY_META[r.category].color }}>
                  <CategoryIcon cat={r.category} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-medium">{CATEGORY_META[r.category].label}</span>
                    <span className="text-mono-data text-[10px] uppercase tracking-[0.12em]" style={{ color: stripe }}>
                      P{r.priority_score}
                    </span>
                  </div>
                  <div className="truncate text-[12.5px] text-muted-foreground">{r.description}</div>
                  <div className="mt-0.5 text-mono-data text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
                    {r.lat != null && <span><MapPin className="mr-0.5 inline h-2.5 w-2.5" />{r.lat.toFixed(3)}, {r.lng?.toFixed(3)}{r.accuracy != null && ` ±${Math.round(r.accuracy)}m`} · </span>}
                    {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="col-span-6 sm:col-span-2">
                <select value={r.priority} onChange={(e) => setPriority(r.id, e.target.value as any)}
                  disabled={busyId === r.id}
                  className="w-full rounded-full border border-input bg-white px-3 py-1.5 text-[12px]">
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="col-span-6 sm:col-span-2">
                <select value={r.status} onChange={(e) => setStatus(r.id, e.target.value as any)}
                  disabled={busyId === r.id}
                  className="w-full rounded-full border border-input bg-white px-3 py-1.5 text-[12px]">
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-span-12 sm:col-span-3">
                <select value={r.assigned_to ?? ""} onChange={(e) => assign(r.id, e.target.value || null)}
                  disabled={busyId === r.id}
                  className="w-full rounded-full border border-input bg-white px-3 py-1.5 text-[12px]">
                  <option value="">Unassigned</option>
                  {techs.map((t) => <option key={t.id} value={t.id}>{t.display_name ?? t.id.slice(0, 8)}{t.village ? ` · ${t.village}` : ""}</option>)}
                </select>
              </div>
            </div>
            );
          })
        )}
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        <div className="glass rounded-2xl p-5">
          <div className="mb-3 inline-flex items-center gap-2 text-[12px] font-medium text-muted-foreground">
            <Users className="h-3.5 w-3.5" /> Technician workload
          </div>
          {(stats?.workload?.length ?? 0) === 0
            ? <div className="text-[13px] text-muted-foreground">No active assignments.</div>
            : <ul className="text-[13px]">
                {stats!.workload.map((w) => (
                  <li key={w.technician_id} className="flex items-center justify-between border-t border-border/60 py-1.5 first:border-0">
                    <span>{w.display_name ?? w.technician_id.slice(0, 8)}</span>
                    <span className="text-mono-data text-[11px] text-muted-foreground">{w.open_jobs} open</span>
                  </li>
                ))}
              </ul>}
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="mb-3 inline-flex items-center gap-2 text-[12px] font-medium text-muted-foreground">
            <Activity className="h-3.5 w-3.5" /> System audit log · last {audit.length} events
          </div>
          {audit.length === 0 ? (
            <div className="text-[13px] text-muted-foreground">No events recorded yet.</div>
          ) : (
            <ul className="max-h-80 overflow-y-auto text-mono-data text-[11px]">
              {audit.map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3 border-t border-border/40 py-1 first:border-0">
                  <span className="truncate text-foreground">{e.event_type}</span>
                  <span className="shrink-0 text-muted-foreground">{new Date(e.created_at).toLocaleTimeString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-6 glass rounded-3xl p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 text-[12px] font-medium text-muted-foreground">
            <Flame className="h-3.5 w-3.5 text-danger" /> Predictive failure risk · next 14 days
          </div>
          <div className="text-mono-data text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
            density · recurrence · severity · monsoon
          </div>
        </div>
        {risk.length === 0 ? (
          <div className="text-[13px] text-muted-foreground">Not enough history yet. Predictions activate once 2+ incidents per village/category accrue in 90 days.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="text-mono-data text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
                <tr><th className="py-1.5 text-left">Village</th><th className="text-left">Category</th><th className="text-right">90d</th><th className="text-right">Recur</th><th className="text-right">Pri</th><th className="text-right">Risk</th></tr>
              </thead>
              <tbody>
                {risk.slice(0, 12).map((r) => {
                  const tone = r.risk_score >= 70 ? "#ef4444" : r.risk_score >= 45 ? "#f97316" : "#3b82f6";
                  return (
                    <tr key={`${r.village}-${r.category}`} className="border-t border-border/40">
                      <td className="py-1.5 truncate">{r.village}</td>
                      <td className="truncate">{CATEGORY_META[r.category as ComplaintCategory]?.label ?? r.category}</td>
                      <td className="text-right text-mono-data">{r.incidents_90d}</td>
                      <td className="text-right text-mono-data">{Math.round((r.recurrence_rate ?? 0) * 100)}%</td>
                      <td className="text-right text-mono-data">{r.avg_priority}</td>
                      <td className="text-right">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                            <span className="block h-full" style={{ width: `${r.risk_score}%`, background: tone }} />
                          </span>
                          <span className="text-mono-data text-[11px] w-7 text-right" style={{ color: tone }}>{r.risk_score}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-7xl px-4 pt-20 pb-28 sm:px-6 sm:pt-32 sm:pb-24" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 96px)", WebkitOverflowScrolling: "touch" }}>{children}</div>;
}

function AgingBar({ a }: { a?: StatsV2["aging"] }) {
  const buckets = [
    { k: "<24h", v: a?.under_24h ?? 0,           c: "#10b981" },
    { k: "1–3d", v: a?.one_to_three_days ?? 0,   c: "#3b82f6" },
    { k: "3–7d", v: a?.three_to_seven_days ?? 0, c: "#f97316" },
    { k: ">7d",  v: a?.over_seven_days ?? 0,     c: "#ef4444" },
  ];
  const total = Math.max(1, buckets.reduce((s, b) => s + b.v, 0));
  return (
    <div className="space-y-1.5">
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        {buckets.map((b) => <div key={b.k} style={{ width: `${(b.v / total) * 100}%`, background: b.c }} />)}
      </div>
      <div className="flex justify-between text-mono-data text-[10.5px] text-muted-foreground">
        {buckets.map((b) => <span key={b.k}>{b.k}:<span className="text-foreground ml-1">{b.v}</span></span>)}
      </div>
    </div>
  );
}

function BreakdownRows({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <ul className="space-y-1.5 text-[12px]">
      {entries.map(([k, v]) => (
        <li key={k} className="flex items-center gap-2">
          <span className="w-24 truncate">{k}</span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <span className="block h-full bg-accent" style={{ width: `${(v / max) * 100}%` }} />
          </span>
          <span className="text-mono-data text-[11px] text-muted-foreground w-6 text-right">{v}</span>
        </li>
      ))}
    </ul>
  );
}

function Stat({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "accent" | "danger" }) {
  const color = tone === "danger" ? "oklch(0.62 0.23 27)" : tone === "accent" ? "oklch(0.58 0.21 264)" : "oklch(0.22 0.05 265)";
  return (
    <div className="glass rounded-2xl p-5" data-cursor="card">
      <div className="text-[12px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-2 text-mono-data text-[32px] leading-none" style={{ color }}>
        {value.toString().padStart(2, "0")}
      </div>
    </div>
  );
}

function CategoryIcon({ cat }: { cat: ComplaintCategory }) {
  const Icon = CATEGORY_META[cat].icon;
  return <Icon className="h-5 w-5" />;
}
