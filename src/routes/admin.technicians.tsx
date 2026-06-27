import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Users,
  ShieldOff,
  ShieldCheck,
  Trash2,
  ArrowLeft,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Check,
  X,
  Wrench,
  Car
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  listTechnicians,
  listTechnicianApplications,
  listCitizens,
  approveTechnician,
  rejectTechnician,
  setTechnicianBan,
  deleteTechnician,
  type TechnicianRow,
  type ApplicationRow,
  type CitizenRow
} from "@/lib/admin/technicians.functions";

export const Route = createFileRoute("/admin/technicians")({
  head: () => ({ meta: [{ title: "User Management · SevaJyothi" }] }),
  component: UserManagementPage,
});

type Tab = "applications" | "technicians" | "citizens";

function UserManagementPage() {
  const navigate = useNavigate();
  const { roles, loading } = useAuth();
  
  const listTechs = useServerFn(listTechnicians);
  const listApps = useServerFn(listTechnicianApplications);
  const listCits = useServerFn(listCitizens);
  const approve = useServerFn(approveTechnician);
  const reject = useServerFn(rejectTechnician);
  const setBan = useServerFn(setTechnicianBan);
  const del = useServerFn(deleteTechnician);

  const [activeTab, setActiveTab] = useState<Tab>("applications");
  
  const [techs, setTechs] = useState<TechnicianRow[]>([]);
  const [apps, setApps] = useState<ApplicationRow[]>([]);
  const [cits, setCits] = useState<CitizenRow[]>([]);
  
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const isAuthority = roles.includes("authority");

  useEffect(() => {
    if (loading) return;
    if (!isAuthority) {
      navigate({ to: "/" });
      return;
    }
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isAuthority, activeTab]);

  async function refresh() {
    setBusy(true);
    setErr(null);
    try {
      if (activeTab === "applications") {
        setApps(await listApps());
      } else if (activeTab === "technicians") {
        setTechs(await listTechs());
      } else if (activeTab === "citizens") {
        setCits(await listCits());
      }
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load data");
    } finally {
      setBusy(false);
    }
  }

  async function onApprove(a: ApplicationRow) {
    if (!confirm(`Approve technician access for ${a.email}?`)) return;
    setActionId(a.id);
    try {
      await approve({ data: { id: a.id, user_id: a.user_id } });
      await refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Approval failed");
    } finally {
      setActionId(null);
    }
  }

  async function onReject(a: ApplicationRow) {
    if (!confirm(`Reject technician application for ${a.email}?`)) return;
    setActionId(a.id);
    try {
      await reject({ data: { id: a.id, user_id: a.user_id } });
      await refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Rejection failed");
    } finally {
      setActionId(null);
    }
  }

  async function onToggleBan(t: TechnicianRow) {
    const disable = !t.banned_until || new Date(t.banned_until) < new Date();
    if (!confirm(disable ? `Disable login for ${t.email}?` : `Re-enable ${t.email}?`)) return;
    setActionId(t.id);
    try {
      await setBan({ data: { user_id: t.id, disable } });
      await refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to update status");
    } finally {
      setActionId(null);
    }
  }

  async function onDelete(t: TechnicianRow) {
    if (!confirm(`Permanently delete ${t.email}? This cannot be undone. Open jobs will be unassigned.`)) return;
    setActionId(t.id);
    try {
      await del({ data: { user_id: t.id } });
      await refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Delete failed");
    } finally {
      setActionId(null);
    }
  }

  if (loading || (!isAuthority && !loading)) {
    return <div className="grid min-h-screen place-items-center text-sm text-foreground/60">Checking access…</div>;
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-[calc(env(safe-area-inset-bottom)+120px)] pt-24 sm:pt-28">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/admin" className="inline-flex items-center gap-1 text-xs text-foreground/60 hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Command Center
          </Link>
          <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            <Users className="h-6 w-6 text-accent" /> User Management
          </h1>
          <p className="mt-1 text-sm text-foreground/60">
            Review technician applications, suspend access, and monitor citizens.
          </p>
        </div>
      </div>

      {err && (
        <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {err}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex overflow-hidden rounded-xl border border-input p-1 max-w-xl">
        <button
          onClick={() => setActiveTab("applications")}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
            activeTab === "applications" ? "bg-accent text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Applications
        </button>
        <button
          onClick={() => setActiveTab("technicians")}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
            activeTab === "technicians" ? "bg-accent text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Technicians
        </button>
        <button
          onClick={() => setActiveTab("citizens")}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
            activeTab === "citizens" ? "bg-accent text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Citizens
        </button>
      </div>

      {/* Content */}
      {busy ? (
        <div className="grid place-items-center py-16 text-sm text-foreground/60">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : activeTab === "applications" ? (
        // Applications View
        apps.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-foreground/15 p-10 text-center text-sm text-foreground/60">
            No pending technician applications.
          </div>
        ) : (
          <div className="grid gap-3">
            {apps.map((a) => {
              const isBusy = actionId === a.id;
              return (
                <div key={a.id} className="rounded-2xl border border-foreground/10 bg-card/60 p-4 backdrop-blur">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-lg">{a.full_name}</span>
                        <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-orange-600">
                          Pending
                        </span>
                      </div>
                      <div className="mt-2 grid gap-1 text-sm text-foreground/70 sm:grid-cols-2">
                        <span className="inline-flex items-center gap-1.5 truncate">
                          <Mail className="h-4 w-4 shrink-0 text-muted-foreground" /> {a.email}
                        </span>
                        {a.phone && (
                          <span className="inline-flex items-center gap-1.5">
                            <Phone className="h-4 w-4 text-muted-foreground" /> {a.phone}
                          </span>
                        )}
                        {a.region && (
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="h-4 w-4 text-muted-foreground" /> {a.region}
                          </span>
                        )}
                        {a.technical_skill && (
                          <span className="inline-flex items-center gap-1.5">
                            <Wrench className="h-4 w-4 text-muted-foreground" /> {a.technical_skill}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1.5">
                          <Car className="h-4 w-4 text-muted-foreground" /> 
                          {a.vehicle_available ? "Vehicle available" : "No vehicle"}
                        </span>
                        <span className="text-xs text-foreground/55 pt-1">
                          Applied: {new Date(a.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => onApprove(a)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-600 hover:bg-emerald-500/20 disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" /> Approve
                      </button>
                      <button
                        onClick={() => onReject(a)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
                      >
                        <X className="h-4 w-4" /> Reject
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : activeTab === "technicians" ? (
        // Technicians View
        techs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-foreground/15 p-10 text-center text-sm text-foreground/60">
            No technicians approved yet.
          </div>
        ) : (
          <div className="grid gap-3">
            {techs.map((t) => {
              const banned = t.banned_until && new Date(t.banned_until) > new Date();
              const isBusy = actionId === t.id;
              return (
                <div key={t.id} className="rounded-2xl border border-foreground/10 bg-card/60 p-4 backdrop-blur">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{t.display_name ?? t.email}</span>
                        {banned ? (
                          <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-destructive">
                            Disabled
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-emerald-600">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="mt-2 grid gap-1 text-xs text-foreground/70 sm:grid-cols-2">
                        <span className="inline-flex items-center gap-1.5 truncate">
                          <Mail className="h-3.5 w-3.5 shrink-0" /> {t.email}
                        </span>
                        {t.phone && (
                          <span className="inline-flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5" /> {t.phone}
                          </span>
                        )}
                        {t.village && (
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" /> {t.village}
                          </span>
                        )}
                        <span className="text-foreground/55">
                          Last sign-in: {t.last_sign_in_at ? new Date(t.last_sign_in_at).toLocaleString() : "never"}
                        </span>
                      </div>
                      <div className="mt-2 flex gap-4 text-xs">
                        <span><span className="font-semibold">{t.open_jobs}</span> open</span>
                        <span><span className="font-semibold">{t.resolved_jobs}</span> resolved</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => onToggleBan(t)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/15 px-3 py-1.5 text-xs hover:bg-foreground/[0.04] disabled:opacity-50"
                      >
                        {banned ? <><ShieldCheck className="h-3.5 w-3.5" /> Re-enable</> : <><ShieldOff className="h-3.5 w-3.5" /> Disable</>}
                      </button>
                      <button
                        onClick={() => onDelete(t)}
                        disabled={isBusy || t.open_jobs > 0}
                        title={t.open_jobs > 0 ? "Reassign or resolve open jobs first" : "Delete account"}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        // Citizens View
        cits.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-foreground/15 p-10 text-center text-sm text-foreground/60">
            No citizens registered yet.
          </div>
        ) : (
          <div className="grid gap-3">
            {cits.map((c) => (
              <div key={c.id} className="rounded-2xl border border-foreground/10 bg-card/60 p-4 backdrop-blur">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{c.display_name ?? c.email}</span>
                </div>
                <div className="mt-2 grid gap-1 text-xs text-foreground/70 sm:grid-cols-2">
                  <span className="inline-flex items-center gap-1.5 truncate">
                    <Mail className="h-3.5 w-3.5 shrink-0" /> {c.email}
                  </span>
                  {c.phone && (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" /> {c.phone}
                    </span>
                  )}
                  {c.village && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" /> {c.village}
                    </span>
                  )}
                  <span className="text-foreground/55">
                    Joined: {new Date(c.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
