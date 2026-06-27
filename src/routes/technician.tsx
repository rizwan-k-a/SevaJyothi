import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Camera, CheckCircle2, MapPin, Navigation, ShieldOff, Upload } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { supabase } from "@/config/supabase";
import { CATEGORY_META } from "@/lib/complaints/meta";
import type { ComplaintCategory } from "@/lib/offline/db";
import { toast } from "sonner";

const ComplaintMap = lazy(() => import("@/components/map/ComplaintMap").then((m) => ({ default: m.ComplaintMap })));

export const Route = createFileRoute("/technician")({
  head: () => ({ meta: [{ title: "Technician panel · SevaJyothi" }] }),
  component: TechnicianPage,
});

type Job = {
  id: string;
  category: ComplaintCategory;
  description: string;
  status: string;
  priority: string;
  lat: number | null;
  lng: number | null;
  village: string | null;
  created_at: string;
  resolution_note: string | null;
  resolution_photo_path: string | null;
};

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function TechnicianPage() {
  const navigate = useNavigate();
  const { user, roles, loading } = useAuth();
  const isTech = roles.includes("technician");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth", replace: true }); }, [loading, user, navigate]);

  // Live GPS for distance/ETA + nearest-first sort
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      (p) => setUserPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("complaints")
      .select("id,category,description,status,priority,lat,lng,village,created_at,resolution_note,resolution_photo_path")
      .eq("assigned_to", user.id)
      .order("created_at", { ascending: false });
    setJobs((data ?? []) as Job[]);
  };

  useEffect(() => {
    if (!isTech || !user) return;
    load();
    const ch = supabase
      .channel(`tech-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "complaints", filter: `assigned_to=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [isTech, user?.id]);

  // Nearest-first sort using Haversine; jobs without coords fall to end.
  const sortedJobs = useMemo(() => {
    if (!userPos) return jobs;
    return [...jobs].sort((a, b) => {
      const ax = a.lat != null && a.lng != null ? haversineKm(userPos, { lat: a.lat, lng: a.lng }) : Infinity;
      const bx = b.lat != null && b.lng != null ? haversineKm(userPos, { lat: b.lat, lng: b.lng }) : Infinity;
      return ax - bx;
    });
  }, [jobs, userPos]);


  if (loading) return <Shell><div className="text-muted-foreground">Loading…</div></Shell>;
  if (!isTech) {
    return (
      <Shell>
        <div className="glass mx-auto max-w-md rounded-3xl p-10 text-center">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-danger/10 text-danger">
            <ShieldOff className="h-6 w-6" />
          </div>
          <div className="text-mono-data text-[11px] uppercase tracking-[0.18em] text-danger">Restricted</div>
          <h1 className="mt-2 text-display text-3xl">Technician access required</h1>
          <p className="mt-3 text-[14px] text-muted-foreground">
            Your account does not have the <span className="text-foreground">technician</span> role.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-8">
        <div className="text-mono-data text-[11px] uppercase tracking-[0.16em] text-accent">Field workspace</div>
        <h1 className="mt-2 text-display text-[clamp(2rem,4vw,3rem)]">
          Today's{" "}
          <span className="text-accent-script text-accent text-[1.25em] leading-[0.6]">jobs</span>.
        </h1>
      </div>
      {sortedJobs.length === 0 ? (
        <div className="glass rounded-3xl p-12 text-center text-[14px] text-muted-foreground">No jobs assigned to you yet.</div>
      ) : (
        <>
          <TechMap jobs={sortedJobs} />
          {userPos && (
            <div className="mb-3 text-mono-data text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Sorted by distance · live GPS
            </div>
          )}
          <div className="grid gap-3">
            {sortedJobs.map((j) => <JobCard key={j.id} job={j} onChange={load} userId={user!.id} userPos={userPos} />)}
          </div>
        </>
      )}

    </Shell>
  );
}

function TechMap({ jobs }: { jobs: Job[] }) {
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [route, setRoute] = useState(false);
  const points = useMemo(
    () =>
      jobs
        .filter((j) => j.lat != null && j.lng != null)
        .map((j) => ({
          id: j.id,
          lat: j.lat as number,
          lng: j.lng as number,
          priority: (j.priority as any) ?? "normal",
          label: j.description?.slice(0, 60) ?? "",
          category: j.category,
        })),
    [jobs],
  );
  if (points.length === 0) return null;
  return (
    <div className="mb-4 overflow-hidden rounded-3xl border border-input">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-card/40 px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        <span>Field map · {points.length} jobs</span>
        <button
          onClick={() => setRoute((r) => !r)}
          disabled={!selectedId}
          className="rounded-full border border-input px-3 py-1 text-[10.5px] disabled:opacity-40"
        >
          {route ? "Route on" : "Preview route"}
        </button>
      </div>
      <Suspense fallback={<div style={{ height: 280 }} className="grid place-items-center text-[12px] text-muted-foreground">Loading map…</div>}>
        <ComplaintMap
          points={points}
          height={280}
          selectedId={selectedId}
          routeFromUser={route}
          onSelect={(id) => setSelectedId(id)}
        />
      </Suspense>
    </div>
  );
}

function buildNavigateUrl(lat: number, lng: number): string {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  if (isIOS) return `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
  // Android (and desktop fallback) — universal Google Maps directions link.
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

function JobCard({
  job, onChange, userId, userPos,
}: {
  job: Job; onChange: () => void; userId: string; userPos: { lat: number; lng: number } | null;
}) {
  const meta = CATEGORY_META[job.category];
  const [note, setNote] = useState(job.resolution_note ?? "");
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const distanceKm = useMemo(() => {
    if (!userPos || job.lat == null || job.lng == null) return null;
    return haversineKm(userPos, { lat: job.lat, lng: job.lng });
  }, [userPos, job.lat, job.lng]);
  // Rural India driving avg ~30 km/h.
  const etaMin = distanceKm != null ? Math.max(1, Math.round((distanceKm / 30) * 60)) : null;
  const ageMin = Math.max(1, Math.round((Date.now() - new Date(job.created_at).getTime()) / 60000));

  const setStatus = async (status: string) => {
    setBusy(true);
    const patch: any = { status };
    if (status === "resolved") patch.resolved_at = new Date().toISOString();
    await supabase.from("complaints").update(patch).eq("id", job.id);
    await supabase.from("complaint_events").insert({ complaint_id: job.id, event: `status:${status}`, actor_id: userId });
    setBusy(false);
    onChange();
  };

  const submitResolution = async () => {
    if (!note.trim()) { toast.error("Add a short closure note"); return; }
    setBusy(true);
    let path = job.resolution_photo_path;
    if (file) {
      const ext = file.name.split(".").pop() ?? "jpg";
      path = `${userId}/resolutions/${job.id}.${ext}`;
      const { error } = await supabase.storage.from("complaint-media").upload(path, file, { upsert: true, contentType: file.type });
      if (error) { toast.error(error.message); setBusy(false); return; }
    }
    const { error } = await supabase.from("complaints").update({
      resolution_note: note,
      resolution_photo_path: path,
      status: "resolved",
      resolved_at: new Date().toISOString(),
    }).eq("id", job.id);
    if (error) { toast.error(error.message); setBusy(false); return; }
    await supabase.from("complaint_events").insert({ complaint_id: job.id, event: "resolved", actor_id: userId, meta: { note } });
    toast.success("Job marked resolved");
    setBusy(false);
    onChange();
  };

  const navUrl = job.lat != null && job.lng != null ? buildNavigateUrl(job.lat, job.lng) : null;

  return (
    <div className="glass rounded-3xl p-5">
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl" style={{ background: `${meta.color}1A`, color: meta.color }}>
          <meta.icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[15px] font-medium">{meta.label}</div>
            <span className="text-mono-data text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
              {job.status.replace(/_/g, " ")} · {job.priority}
            </span>
            {distanceKm != null && (
              <span className="text-mono-data rounded-full bg-accent/10 px-2 py-0.5 text-[10.5px] font-medium text-accent">
                {distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`} · ~{etaMin}m ETA
              </span>
            )}
            <span className="text-mono-data text-[10.5px] text-muted-foreground">
              {ageMin < 60 ? `${ageMin}m ago` : `${Math.round(ageMin / 60)}h ago`}
            </span>
          </div>
          <p className="mt-1 text-[13.5px] text-muted-foreground">{job.description}</p>
          <div className="mt-1.5 text-mono-data text-[11px] text-muted-foreground">
            {job.village && <span>{job.village} · </span>}
            {job.lat != null && <span><MapPin className="mr-0.5 inline h-2.5 w-2.5" />{job.lat.toFixed(4)}, {job.lng?.toFixed(4)}</span>}
          </div>
        </div>
        {navUrl && (
          <a href={navUrl} target="_blank" rel="noreferrer" data-cursor="link"
            className="inline-flex items-center gap-1.5 rounded-full border border-input bg-white px-3 py-1.5 text-[12px] hover:bg-white/80">
            <Navigation className="h-3.5 w-3.5" /> Navigate
          </a>
        )}
      </div>


      <div className="mt-4 flex flex-wrap gap-2 text-[12px]">
        {(["en_route", "on_site"] as const).map((s) => (
          <button key={s} disabled={busy} onClick={() => setStatus(s)} data-cursor="button"
            className={`rounded-full border px-3 py-1.5 transition ${job.status === s ? "bg-primary text-primary-foreground border-primary" : "bg-white hover:bg-white/80 border-input"}`}>
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Closure note — what was repaired"
          className="rounded-2xl border border-input bg-white p-3 text-[13.5px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        <div className="flex flex-col gap-2">
          <label className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full border border-input bg-white px-3 py-2 text-[12px] hover:bg-white/80" data-cursor="upload">
            <Camera className="h-3.5 w-3.5" />
            {file ? file.name.slice(0, 14) : "Proof photo"}
            <input type="file" accept="image/*" capture="environment" className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <button onClick={submitResolution} disabled={busy} data-cursor="cta"
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground transition hover:brightness-110 disabled:opacity-50">
            {busy ? <Upload className="h-3.5 w-3.5 animate-pulse" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Resolve
          </button>
        </div>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-5xl px-4 pt-20 pb-28 sm:px-6 sm:pt-32 sm:pb-24" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 96px)", WebkitOverflowScrolling: "touch" }}>{children}</div>;
}
