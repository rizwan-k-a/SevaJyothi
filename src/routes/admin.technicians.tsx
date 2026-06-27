import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Users,
  UserPlus,
  KeyRound,
  Trash2,
  Copy,
  Check,
  ShieldOff,
  ShieldCheck,
  Eye,
  EyeOff,
  ArrowLeft,
  Loader2,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  listTechnicians,
  createTechnician,
  resetTechnicianPassword,
  setTechnicianBan,
  deleteTechnician,
  type TechnicianRow,
} from "@/lib/admin/technicians.functions";

export const Route = createFileRoute("/admin/technicians")({
  head: () => ({ meta: [{ title: "Technician Management · SevaJyothi" }] }),
  component: TechniciansPage,
});

type Credential = { email: string; password: string; user_id: string; kind: "created" | "reset" };

function TechniciansPage() {
  const navigate = useNavigate();
  const { roles, loading } = useAuth();
  const list = useServerFn(listTechnicians);
  const create = useServerFn(createTechnician);
  const reset = useServerFn(resetTechnicianPassword);
  const setBan = useServerFn(setTechnicianBan);
  const del = useServerFn(deleteTechnician);

  const [techs, setTechs] = useState<TechnicianRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ email: "", display_name: "", village: "", phone: "" });
  const [creating, setCreating] = useState(false);
  const [credential, setCredential] = useState<Credential | null>(null);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isAuthority = roles.includes("authority");

  useEffect(() => {
    if (loading) return;
    if (!isAuthority) {
      navigate({ to: "/" });
      return;
    }
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isAuthority]);

  async function refresh() {
    setBusy(true);
    setErr(null);
    try {
      const rows = await list();
      setTechs(rows);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load technicians");
    } finally {
      setBusy(false);
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setErr(null);
    try {
      const res = await create({ data: form });
      setCredential({ email: res.email, password: res.password, user_id: res.id, kind: "created" });
      setForm({ email: "", display_name: "", village: "", phone: "" });
      setShowCreate(false);
      await refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create technician");
    } finally {
      setCreating(false);
    }
  }

  async function onReset(t: TechnicianRow) {
    if (!confirm(`Reset password for ${t.email}? A new password will be shown once.`)) return;
    setActionId(t.id);
    try {
      const res = await reset({ data: { user_id: t.id } });
      setCredential({ email: t.email, password: res.password, user_id: t.id, kind: "reset" });
    } catch (e: any) {
      setErr(e?.message ?? "Reset failed");
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

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
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
            <Users className="h-6 w-6 text-accent" /> Field Technicians
          </h1>
          <p className="mt-1 text-sm text-foreground/60">
            Create accounts, reset credentials, suspend access, and monitor workload.
          </p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:opacity-90"
        >
          <UserPlus className="h-4 w-4" />
          {showCreate ? "Close" : "Add technician"}
        </button>
      </div>

      {err && (
        <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {err}
        </div>
      )}

      {/* One-time credential banner */}
      {credential && (
        <div className="mb-6 rounded-2xl border border-accent/40 bg-accent/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-accent">
                {credential.kind === "created" ? "Account created — share once" : "Password reset — share once"}
              </div>
              <div className="mt-1 text-sm font-medium">{credential.email}</div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <code className="rounded bg-foreground/[0.06] px-3 py-1.5 font-mono text-sm">
                  {revealedId === credential.user_id ? credential.password : "•".repeat(credential.password.length)}
                </code>
                <button
                  onClick={() => setRevealedId(revealedId === credential.user_id ? null : credential.user_id)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-foreground/70 hover:bg-foreground/[0.04]"
                >
                  {revealedId === credential.user_id ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {revealedId === credential.user_id ? "Hide" : "Show"}
                </button>
                <button
                  onClick={() => copy(credential.password)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-foreground/70 hover:bg-foreground/[0.04]"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
                <button
                  onClick={() => copy(`Email: ${credential.email}\nPassword: ${credential.password}`)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-foreground/70 hover:bg-foreground/[0.04]"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy both
                </button>
              </div>
              <p className="mt-3 text-xs text-foreground/60">
                This password will never be shown again. It's hashed at rest — neither you nor support can recover it later.
                Reset to generate a new one.
              </p>
            </div>
            <button
              onClick={() => {
                setCredential(null);
                setRevealedId(null);
              }}
              className="rounded-md px-2 py-1 text-xs text-foreground/60 hover:bg-foreground/[0.04]"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <form
          onSubmit={onCreate}
          className="mb-6 grid gap-3 rounded-2xl border border-foreground/10 bg-card/60 p-4 backdrop-blur sm:grid-cols-2"
        >
          <label className="flex flex-col gap-1 text-sm sm:col-span-1">
            <span className="text-xs text-foreground/60">Email</span>
            <input
              type="email"
              required
              maxLength={255}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="technician@sevajyothi.dev"
              className="rounded-lg border border-foreground/15 bg-background px-3 py-2 outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-1">
            <span className="text-xs text-foreground/60">Full name</span>
            <input
              required
              maxLength={100}
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              placeholder="Arjun Kumar"
              className="rounded-lg border border-foreground/15 bg-background px-3 py-2 outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-foreground/60">Village / zone (optional)</span>
            <input
              maxLength={100}
              value={form.village}
              onChange={(e) => setForm({ ...form, village: e.target.value })}
              placeholder="Hubli"
              className="rounded-lg border border-foreground/15 bg-background px-3 py-2 outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-foreground/60">Phone (optional)</span>
            <input
              maxLength={32}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+91 90000 00000"
              className="rounded-lg border border-foreground/15 bg-background px-3 py-2 outline-none focus:border-accent"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Create account & generate password
            </button>
            <p className="mt-2 text-xs text-foreground/55">
              A secure 14-char password will be generated and shown once on this screen.
            </p>
          </div>
        </form>
      )}

      {/* List */}
      {busy ? (
        <div className="grid place-items-center py-16 text-sm text-foreground/60">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : techs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-foreground/15 p-10 text-center text-sm text-foreground/60">
          No technicians yet. Click <strong>Add technician</strong> to create the first account.
        </div>
      ) : (
        <div className="grid gap-3">
          {techs.map((t) => {
            const banned = t.banned_until && new Date(t.banned_until) > new Date();
            const isBusy = actionId === t.id;
            return (
              <div
                key={t.id}
                className="rounded-2xl border border-foreground/10 bg-card/60 p-4 backdrop-blur"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{t.display_name ?? t.email}</span>
                      {banned ? (
                        <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-destructive">
                          Disabled
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
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
                        Last sign-in:{" "}
                        {t.last_sign_in_at ? new Date(t.last_sign_in_at).toLocaleString() : "never"}
                      </span>
                    </div>
                    <div className="mt-2 flex gap-4 text-xs">
                      <span>
                        <span className="font-semibold">{t.open_jobs}</span>
                        <span className="ml-1 text-foreground/60">open</span>
                      </span>
                      <span>
                        <span className="font-semibold">{t.resolved_jobs}</span>
                        <span className="ml-1 text-foreground/60">resolved</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => onReset(t)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/15 px-3 py-1.5 text-xs hover:bg-foreground/[0.04] disabled:opacity-50"
                    >
                      <KeyRound className="h-3.5 w-3.5" /> Reset password
                    </button>
                    <button
                      onClick={() => onToggleBan(t)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/15 px-3 py-1.5 text-xs hover:bg-foreground/[0.04] disabled:opacity-50"
                    >
                      {banned ? (
                        <>
                          <ShieldCheck className="h-3.5 w-3.5" /> Re-enable
                        </>
                      ) : (
                        <>
                          <ShieldOff className="h-3.5 w-3.5" /> Disable
                        </>
                      )}
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
      )}

      <p className="mt-8 text-xs text-foreground/50">
        Note: passwords are stored as one-way bcrypt hashes. Existing passwords can never be displayed — only reset.
      </p>
    </div>
  );
}
