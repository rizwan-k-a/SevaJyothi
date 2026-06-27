import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, Camera, CheckCircle2, CloudOff, CloudUpload, ImagePlus, MapPin, Upload, X } from "lucide-react";
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
  const [done, setDone] = useState<{ stored: "queued" | "synced" } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // High-accuracy GPS with up to 3 retries if accuracy > 100 m.
  const acquireFix = (attempt = 0) => {
    if (!("geolocation" in navigator)) {
      setGeo({ loading: false, error: "Geolocation not supported" });
      return;
    }
    setGeo((g) => ({ ...g, loading: true, attempts: attempt }));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const acc = pos.coords.accuracy;
        const next: GeoState = {
          loading: false,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: acc,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
          attempts: attempt + 1,
        };
        if (acc > 100 && attempt < 2) {
          setGeo(next);
          setTimeout(() => acquireFix(attempt + 1), 1500);
        } else {
          setGeo(next);
        }
      },
      (err) => {
        if (attempt < 2) setTimeout(() => acquireFix(attempt + 1), 1500);
        else setGeo({ loading: false, error: err.message, attempts: attempt + 1 });
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  };

  useEffect(() => { acquireFix(0); /* eslint-disable-next-line */ }, []);


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

  const canSubmit = !!category && !submitting && !done;

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

      if (online) {
        const n = await flushPendingComplaints();
        await refresh();
        // Surface rate-limit / server rejections instead of silently queuing forever.
        if (n === 0) {
          const { getPendingComplaints } = await import("@/lib/offline/db");
          const pend = await getPendingComplaints();
          const mine = pend.find((p) => p.id === id);
          if (mine?.last_error) {
            if (/Too many reports/i.test(mine.last_error)) {
              toast.error("Too many reports submitted. Please wait a few minutes.");
            } else {
              toast.message("Saved — will retry sync", { description: mine.last_error });
            }
            setDone({ stored: "queued" });
            return;
          }
        }
        setDone({ stored: n > 0 ? "synced" : "queued" });
      } else {
        await registerBackgroundSync("sj-flush-complaints");
        await refresh();
        setDone({ stored: "queued" });
      }
    } catch {
      toast.error("Couldn't save the report. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return <SuccessScreen mode={done.stored} onView={() => navigate({ to: "/citizen" })} onAnother={() => {
      setDone(null); setCategory(null); setDescription(""); setPhoto(null);
    }} />;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pt-20 pb-28 sm:px-6 sm:pt-28 sm:pb-24" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 96px)" }}>

      <Link to="/citizen" className="mb-6 inline-flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground" data-cursor="link">
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      <div className="mb-8">
        <div className="text-mono-data text-[11px] uppercase tracking-[0.16em] text-accent">New report</div>
        <h1 className="mt-2 text-display text-[clamp(2rem,4vw,3rem)]">
          Tell us what's{" "}
          <span className="text-accent-script text-accent text-[1.25em] leading-[0.6]">broken</span>.
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
                  active ? "border-transparent ring-2 ring-accent bg-white" : "border-border bg-white/50 hover:bg-white"
                }`}
              >
                <span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl sm:h-9 sm:w-9"
                  style={{ background: `${meta.color}1F`, color: meta.color }}
                >
                  <meta.icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
                </span>
                <div className="mt-2 text-[13px] font-medium leading-tight sm:mt-3 sm:text-[13.5px]">{meta.label}</div>
                <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground sm:text-[11.5px]">{meta.description}</div>
                {active && (
                  <motion.span layoutId="cat-glow"
                    className="absolute inset-0 -z-10 rounded-2xl"
                    style={{ background: `radial-gradient(closest-side, ${meta.color}22, transparent 70%)` }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* Step 2 — Photo */}
      <section className="glass mb-4 rounded-3xl p-4 sm:mb-5 sm:p-6">
        <SectionHeading n={2} label="Add a photo" hint="Optional but powerful — helps technicians prepare" />
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
        <div className="mt-2 text-right text-[11px] text-muted-foreground">{description.length}/500</div>

        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-white/40 p-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/5 text-primary">
            <MapPin className="h-4 w-4" />
          </span>
          <div className="flex-1 text-[12.5px]">
            {geo.loading && <span className="text-muted-foreground">Locating…</span>}
            {!geo.loading && geo.lat && (
              <>
                <div className="font-medium text-foreground">
                  {geo.lat.toFixed(5)}, {geo.lng?.toFixed(5)}
                </div>
                <div className="text-muted-foreground text-[11.5px]">
                  Auto-captured · accuracy ±{Math.round(geo.accuracy ?? 0)} m
                </div>
              </>
            )}
            {!geo.loading && geo.error && (
              <span className="text-danger">GPS unavailable — submit will continue without coordinates.</span>
            )}
          </div>
        </div>
        {!geo.loading && geo.accuracy != null && geo.accuracy > 100 && (
          <div className="mt-3 flex items-start gap-2 rounded-2xl border border-warning/30 bg-warning/5 p-3 text-[12px]">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none text-warning" />
            <div className="flex-1">
              <div className="font-medium text-warning">Low GPS confidence (±{Math.round(geo.accuracy)} m)</div>
              <div className="mt-0.5 text-muted-foreground">
                You may continue or retry location for a sharper fix.
              </div>
              <button
                onClick={() => acquireFix(0)}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-warning/40 bg-white px-3 py-1 text-[11.5px] font-medium text-warning hover:bg-warning/10"
                data-cursor="button"
              >
                Retry location
              </button>
            </div>
          </div>
        )}

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
              <span className="inline-flex items-center gap-1.5"><CloudUpload className="h-3.5 w-3.5 text-success" /> Online — will submit immediately</span>
            ) : (
              <span className="inline-flex items-center gap-1.5"><CloudOff className="h-3.5 w-3.5 text-warning" /> Offline — will store securely and sync later</span>
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
      <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-mono-data text-[11px] text-primary-foreground">{n}</span>
      <div>
        <div className="text-display text-[20px] leading-none">{label}</div>
        <div className="mt-1 text-[12px] text-muted-foreground">{hint}</div>
      </div>
    </div>
  );
}

function SuccessScreen({ mode, onView, onAnother }: { mode: "queued" | "synced"; onView: () => void; onAnother: () => void }) {
  return (
    <div className="mx-auto grid min-h-[100svh] max-w-md place-items-center px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
        className="glass w-full rounded-3xl p-8 text-center"
      >
        <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full"
          style={{ background: mode === "synced" ? "oklch(0.70 0.16 162 / 0.15)" : "oklch(0.78 0.15 75 / 0.18)" }}>
          {mode === "synced"
            ? <CheckCircle2 className="h-7 w-7" style={{ color: "oklch(0.55 0.15 162)" }} />
            : <CloudOff className="h-7 w-7" style={{ color: "oklch(0.55 0.15 75)" }} />}
        </div>
        <h2 className="text-display text-3xl">
          {mode === "synced" ? "Report received." : "Stored securely."}
        </h2>
        <p className="mt-2 text-[14px] text-muted-foreground">
          {mode === "synced"
            ? "It's on the network. You'll see status updates as the team takes action."
            : "Waiting for signal. We'll sync the moment it returns — you don't have to do anything."}
        </p>
        <div className="mt-7 flex flex-col gap-2">
          <button onClick={onView} data-cursor="cta" className="w-full rounded-full bg-primary py-3 text-[14px] font-medium text-primary-foreground transition hover:brightness-110">
            View my reports
          </button>
          <button onClick={onAnother} data-cursor="button" className="w-full rounded-full border border-border bg-white/70 py-3 text-[14px] font-medium text-foreground transition hover:bg-white">
            File another
          </button>
        </div>
      </motion.div>
    </div>
  );
}
