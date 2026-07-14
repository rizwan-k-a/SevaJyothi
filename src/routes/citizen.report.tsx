import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  CloudOff,
  CloudUpload,
  ImagePlus,
  MapPin,
  RefreshCw,
  Upload,
  X,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { CATEGORY_META, CATEGORY_ORDER } from "@/lib/complaints/meta";
import { flushPendingComplaints, saveComplaint, type ComplaintCategory } from "@/lib/offline/db";
import { registerBackgroundSync } from "@/lib/offline/sync";
import { useOffline } from "@/components/providers/OfflineProvider";
import { compressImageFile } from "@/lib/image/compress";

export const Route = createFileRoute("/citizen/report")({
  head: () => ({ meta: [{ title: "Report failure · SevaJyothi" }] }),
  component: ReportPage,
});

type GeoState = {
  lat?: number;
  lng?: number;
  accuracy?: number;
  heading?: number | null;
  speed?: number | null;
  timestamp?: number;
  attempts?: number;
  error?: string;
  loading: boolean;
};

function ReportPage() {
  const navigate = useNavigate();
  const { online, refresh } = useOffline();
  const [category, setCategory] = useState<ComplaintCategory | null>(null);
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [geo, setGeo] = useState<GeoState>({ loading: true, attempts: 0 });
  const [submitting, setSubmitting] = useState(false);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const acquireFix = () => {
    if (!("geolocation" in navigator)) {
      setGeo({ loading: false, error: "Geolocation not supported" });
      return;
    }
    setGeo((g) => ({ ...g, loading: true, attempts: (g.attempts || 0) + 1 }));

    let bestGeo: GeoState | null = null;
    let timeoutId: number;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const acc = pos.coords.accuracy;
        const next: GeoState = {
          loading: true, // Keep loading indicator until timeout or excellent fix
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: acc,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
        };

        // Update if first fix or better accuracy. Ignore terrible fixes (>100m) unless we have nothing else.
        if (!bestGeo || acc < (bestGeo.accuracy ?? Infinity)) {
          // If the new one is > 100m and we already have a fix (even a bad one), we still prefer the better one.
          bestGeo = next;
          setGeo((prev) => ({ ...prev, ...next }));
        }

        // If we get an excellent fix (<20m), we can stop early
        if (acc <= 20) {
          navigator.geolocation.clearWatch(watchId);
          clearTimeout(timeoutId);
          setGeo((prev) => ({ ...prev, loading: false }));
        }
      },
      (err) => {
        // If we already have a fix, ignore the error and keep it.
        setGeo((prev) => (prev.lat ? { ...prev, loading: false } : { ...prev, loading: false, error: err.message }));
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    );

    // Stop collecting after 20 seconds and accept the best reading we found
    timeoutId = window.setTimeout(() => {
      navigator.geolocation.clearWatch(watchId);
      setGeo((prev) => ({ ...prev, loading: false }));
    }, 20000);
  };

  useEffect(() => {
    acquireFix(); /* eslint-disable-next-line */
  }, []);

  const onPickFile = async (file?: File | null) => {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Photo too large", { description: "Keep it under 25 MB." });
      return;
    }
    try {
      // Compress on-device before storage/upload — saves ~85% on rural networks.
      const out = await compressImageFile(file, { maxEdge: 1600, quality: 0.82 });
      setPhoto(out.dataUrl);
    } catch {
      // Fallback: store original as data URL.
      const reader = new FileReader();
      reader.onload = (e) => setPhoto(String(e.target?.result ?? ""));
      reader.readAsDataURL(file);
    }
  };

  const canSubmit = !!category && !submitting && !activeReportId;

  const submit = async () => {
    if (!category) return;
    setSubmitting(true);
    try {
      const id = `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await saveComplaint({
        id,
        category,
        description: description.trim(),
        photoDataUrl: photo ?? undefined,
        lat: geo.lat,
        lng: geo.lng,
        accuracy: geo.accuracy,
        createdAt: Date.now(),
        status: "pending_sync",
      });

      await refresh(); // ensure OfflineProvider knows about it
      setActiveReportId(id);

      if (online) {
        // flushNow will pick it up immediately
        const { flushNow } = await import("@/components/providers/OfflineProvider");
        // We do not await it here, the UI will just observe the state
      } else {
        await registerBackgroundSync("sj-flush-complaints");
      }
    } catch {
      toast.error("Couldn't save the report. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (activeReportId) {
    return (
      <SyncStatusScreen
        reportId={activeReportId}
        onView={() => navigate({ to: "/citizen" })}
        onAnother={() => {
          setActiveReportId(null);
          setCategory(null);
          setDescription("");
          setPhoto(null);
        }}
      />
    );
  }

  return (
    <div
      className="mx-auto max-w-3xl px-4 pt-20 pb-28 sm:px-6 sm:pt-28 sm:pb-24"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 96px)" }}
    >
      <Link
        to="/citizen"
        className="mb-6 inline-flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground"
        data-cursor="link"
      >
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      <div className="mb-8">
        <div className="text-mono-data text-[11px] uppercase tracking-[0.16em] text-accent">
          New report
        </div>
        <h1 className="mt-2 text-display text-[clamp(2rem,4vw,3rem)]">
          Tell us what's{" "}
          <span className="text-accent-script text-accent text-[1.25em] leading-[0.6]">broken</span>
          .
        </h1>
      </div>

      {/* Step 1 — Category */}
      <section className="glass mb-4 rounded-3xl p-4 sm:mb-5 sm:p-6">
        <SectionHeading n={1} label="Pick a category" hint="Helps us route to the right team" />
        <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-5 sm:gap-2.5 sm:grid-cols-3">
          {CATEGORY_ORDER.map((key) => {
            const meta = CATEGORY_META[key];
            const active = category === key;
            return (
              <motion.button
                key={key}
                whileTap={{ scale: 0.97 }}
                onClick={() => setCategory(key)}
                data-cursor="button"
                className={`group relative overflow-hidden rounded-2xl border p-3 text-left transition-all sm:p-4 ${
                  active
                    ? "border-transparent ring-2 ring-accent bg-white"
                    : "border-border bg-white/50 hover:bg-white"
                }`}
              >
                <span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl sm:h-9 sm:w-9"
                  style={{ background: `${meta.color}1F`, color: meta.color }}
                >
                  <meta.icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
                </span>
                <div className="mt-2 text-[13px] font-medium leading-tight sm:mt-3 sm:text-[13.5px]">
                  {meta.label}
                </div>
                <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground sm:text-[11.5px]">
                  {meta.description}
                </div>
                {active && (
                  <motion.span
                    layoutId="cat-glow"
                    className="absolute inset-0 -z-10 rounded-2xl"
                    style={{
                      background: `radial-gradient(closest-side, ${meta.color}22, transparent 70%)`,
                    }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* Step 2 — Photo */}
      <section className="glass mb-4 rounded-3xl p-4 sm:mb-5 sm:p-6">
        <SectionHeading
          n={2}
          label="Add a photo"
          hint="Optional but powerful — helps technicians prepare"
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onPickFile(e.target.files?.[0])}
        />
        {!photo ? (
          <button
            onClick={() => fileRef.current?.click()}
            data-cursor="upload"
            className="mt-4 flex w-full flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-border bg-white/40 px-6 py-7 text-center transition-all hover:border-accent hover:bg-white sm:mt-5 sm:gap-3 sm:py-12"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/5 text-primary sm:h-12 sm:w-12">
              <Camera className="h-5 w-5" />
            </span>
            <div>
              <div className="text-[14px] font-medium">Take a photo or upload</div>
              <div className="text-[12px] text-muted-foreground">JPG or PNG · up to 5 MB</div>
            </div>
          </button>
        ) : (
          <div className="mt-4 relative overflow-hidden rounded-3xl sm:mt-5">
            <img src={photo} alt="Captured" className="h-48 w-full object-cover sm:h-72" />
            <button
              onClick={() => setPhoto(null)}
              className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-black/80"
              data-cursor="button"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-[12px] font-medium text-foreground backdrop-blur-md"
              data-cursor="button"
            >
              <ImagePlus className="h-3.5 w-3.5" /> Replace
            </button>
          </div>
        )}
      </section>

      {/* Step 3 — Description + GPS */}
      <section className="glass mb-4 rounded-3xl p-4 sm:mb-5 sm:p-6">
        <SectionHeading n={3} label="Describe what happened" hint="A short note helps prioritise" />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Transformer near the school exploded around 6:30 PM. No power in the lane."
          className="mt-4 w-full resize-none rounded-2xl border border-input bg-white/60 p-3 text-[16px] outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 sm:mt-5 sm:p-4 sm:text-[14px]"
        />
        <div className="mt-2 text-right text-[11px] text-muted-foreground">
          {description.length}/500
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-white/40 p-3 relative overflow-hidden group">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/5 text-primary">
            <MapPin className="h-5 w-5" />
          </span>
          <div className="flex-1 text-[12.5px] pr-8">
            {geo.loading && <span className="text-muted-foreground animate-pulse">Locating your position…</span>}
            {!geo.loading && geo.lat && (
              <div className="font-medium text-foreground leading-tight space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Lat:</span> {geo.lat.toFixed(5)}
                  <span className="text-border mx-1">|</span>
                  <span className="text-muted-foreground">Lng:</span> {geo.lng?.toFixed(5)}
                </div>
                <div className="text-[11.5px] text-muted-foreground flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${geo.accuracy! <= 100 ? 'bg-success' : 'bg-warning'}`}></span>
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${geo.accuracy! <= 100 ? 'bg-success' : 'bg-warning'}`}></span>
                  </span>
                  Accuracy: ±{geo.accuracy?.toFixed(1) ?? "0"} m
                </div>
              </div>
            )}
            {!geo.loading && geo.error && (
              <span className="text-danger flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                GPS unavailable - continuing without coordinates.
              </span>
            )}
          </div>
          
          {/* Subtle Retry Button */}
          {!geo.loading && (
            <button
              type="button"
              onClick={() => acquireFix()}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/5 transition-colors opacity-70 hover:opacity-100"
              title="Refresh Location"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
        </div>
      </section>

      {/* Sticky submit — pinned to thumb zone with OS safe-area inset.
          Container is pointer-events-none so the sticky bar never traps
          vertical swipe gestures on mobile; only the button captures taps. */}
      <div
        className="pointer-events-none sticky bottom-3 z-10"
        style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <div className="pointer-events-auto glass flex items-center gap-2 rounded-2xl p-2 sm:gap-3 sm:p-3">
          <div className="hidden flex-1 px-2 text-[12.5px] text-muted-foreground sm:block">
            {online ? (
              <span className="inline-flex items-center gap-1.5">
                <CloudUpload className="h-3.5 w-3.5 text-success" /> Online - will submit
                immediately
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <CloudOff className="h-3.5 w-3.5 text-warning" /> Offline - will store securely and
                sync later
              </span>
            )}
          </div>
          <button
            disabled={!canSubmit}
            onClick={submit}
            data-cursor="cta"
            className="pointer-events-auto inline-flex w-full min-h-12 max-h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-[15px] font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50 sm:w-auto"
          >
            {submitting ? "Saving…" : online ? "Submit report" : "Save securely"}
            <Upload className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ n, label, hint }: { n: number; label: string; hint: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-mono-data text-[11px] text-primary-foreground">
        {n}
      </span>
      <div>
        <div className="text-display text-[20px] leading-none">{label}</div>
        <div className="mt-1 text-[12px] text-muted-foreground">{hint}</div>
      </div>
    </div>
  );
}

function SyncStatusScreen({
  reportId,
  onView,
  onAnother,
}: {
  reportId: string;
  onView: () => void;
  onAnother: () => void;
}) {
  const { online, pending, isSyncing } = useOffline();
  const [existsInDb, setExistsInDb] = useState<boolean | null>(null);

  useEffect(() => {
    // Check IndexedDB directly to be absolutely certain of success (deleted) vs pending
    const checkDb = async () => {
      const { getAllComplaints } = await import("@/lib/offline/db");
      const all = await getAllComplaints();
      setExistsInDb(all.some(c => c.id === reportId));
    };
    checkDb();
    const timer = setInterval(checkDb, 500);
    return () => clearInterval(timer);
  }, [reportId]);
  
  // Find the report in the pending queue for error details
  const myReport = pending.find(p => p.id === reportId);
  
  // Wait until we know for sure if it exists in DB to prevent flash of success
  if (existsInDb === null) return <div className="mx-auto grid min-h-[100svh] place-items-center"><div className="animate-pulse">Loading...</div></div>;
  
  // If it's no longer in IndexedDB, it was successfully synced and deleted!
  const isSuccess = !existsInDb;
  
  const isQueued = existsInDb;
  const isFailed = myReport?.last_error ? true : false;
  
  let title = "Queued";
  let description = "Waiting for connection...";
  let icon = <CloudOff className="h-7 w-7 text-warning" />;
  let bgColor = "oklch(0.78 0.15 75 / 0.18)";
  
  if (isSuccess) {
    title = "Synchronization complete";
    description = "Your report is securely stored on the network.";
    icon = <CheckCircle2 className="h-7 w-7" style={{ color: "oklch(0.55 0.15 162)" }} />;
    bgColor = "oklch(0.70 0.16 162 / 0.15)";
  } else if (online && isSyncing) {
    title = "Syncing...";
    description = "Uploading your report to the server.";
    icon = <CloudUpload className="h-7 w-7 text-primary animate-pulse" />;
    bgColor = "bg-primary/10";
  } else if (isFailed && online) {
    title = "Sync failed";
    description = `${myReport.last_error || 'Network error'}\n\nRetrying...`;
    icon = <AlertTriangle className="h-7 w-7 text-danger" />;
    bgColor = "bg-danger/10";
  } else if (isQueued && online && !isSyncing) {
    title = "Queued";
    description = "Waiting for sync cycle...";
    icon = <CloudUpload className="h-7 w-7 text-primary animate-pulse" />;
    bgColor = "bg-primary/10";
  } else {
    title = "Queued";
    description = "Waiting for internet connection...";
    icon = <CloudOff className="h-7 w-7 text-warning" />;
    bgColor = "oklch(0.78 0.15 75 / 0.18)";
  }

  return (
    <div className="mx-auto grid min-h-[100svh] max-w-md place-items-center px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
        className="glass w-full rounded-3xl p-8 text-center"
      >
        <div
          className={`mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full ${bgColor}`}
          style={bgColor.startsWith('oklch') ? { background: bgColor } : {}}
        >
          {icon}
        </div>
        <h2 className="text-display text-3xl">{title}</h2>
        <p className="mt-2 text-[14px] text-muted-foreground whitespace-pre-line">
          {description}
        </p>
        
        {isSuccess && (
          <div className="mt-7 flex flex-col gap-2">
            <button
              onClick={onView}
              data-cursor="cta"
              className="w-full rounded-full bg-primary py-3 text-[14px] font-medium text-primary-foreground transition hover:brightness-110"
            >
              View my reports
            </button>
            <button
              onClick={onAnother}
              data-cursor="button"
              className="w-full rounded-full border border-border bg-white/70 py-3 text-[14px] font-medium text-foreground transition hover:bg-white"
            >
              File another
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
