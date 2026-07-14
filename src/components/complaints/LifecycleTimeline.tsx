import { useEffect, useState } from "react";
import { Check, Circle, Loader2 } from "lucide-react";
import { supabase } from "@/config/supabase";
import { DEMO_EVENTS, isDemoMode } from "@/lib/demo/fixtures";

type Step = {
  key: string;
  label: string;
  match: (events: Ev[]) => Ev | undefined;
};

type Ev = { event: string; created_at: string };

const STEPS: Step[] = [
  { key: "reported", label: "Reported", match: (e) => e.find((x) => x.event === "reported") },
  {
    key: "offline",
    label: "Stored offline",
    match: (e) => e.find((x) => x.event === "stored_offline"),
  },
  { key: "synced", label: "Synced to cloud", match: (e) => e.find((x) => x.event === "synced") },
  {
    key: "triaged",
    label: "Authority reviewed",
    match: (e) => e.find((x) => x.event === "status:triaged" || x.event.startsWith("priority:")),
  },
  {
    key: "assigned",
    label: "Technician assigned",
    match: (e) => e.find((x) => x.event.startsWith("assigned:")),
  },
  {
    key: "started",
    label: "Repair started",
    match: (e) => e.find((x) => x.event === "status:en_route" || x.event === "status:on_site"),
  },
  {
    key: "resolved",
    label: "Resolved",
    match: (e) => e.find((x) => x.event === "resolved" || x.event === "status:resolved"),
  },
];

export function LifecycleTimeline({
  complaintId,
  createdAt,
}: {
  complaintId: string;
  createdAt?: string;
}) {
  const [events, setEvents] = useState<Ev[] | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (isDemoMode()) {
        setEvents(
          DEMO_EVENTS[complaintId] ?? [
            { event: "reported", created_at: createdAt ?? new Date().toISOString() },
          ],
        );
        return;
      }
      const { data } = await supabase
        .from("complaint_events")
        .select("event,created_at")
        .eq("complaint_id", complaintId)
        .order("created_at", { ascending: true });
      if (cancel) return;
      const seed: Ev[] = [
        { event: "reported", created_at: createdAt ?? new Date().toISOString() },
        { event: "synced", created_at: createdAt ?? new Date().toISOString() },
        ...((data ?? []) as Ev[]),
      ];
      setEvents(seed);
    })();
    return () => {
      cancel = true;
    };
  }, [complaintId, createdAt]);

  if (!events) {
    return (
      <div className="flex items-center gap-2 px-4 py-6 text-[12px] text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading timeline…
      </div>
    );
  }

  return (
    <ol className="px-4 py-5">
      {STEPS.map((step, i) => {
        const hit = step.match(events);
        const done = !!hit;
        const isLast = i === STEPS.length - 1;
        return (
          <li key={step.key} className="relative flex gap-3 pb-4 last:pb-0">
            {!isLast && (
              <span
                aria-hidden
                className="absolute left-[11px] top-6 bottom-0 w-px"
                style={{ background: done ? "oklch(0.70 0.16 162)" : "oklch(0.90 0.01 265)" }}
              />
            )}
            <span
              className="relative z-10 mt-0.5 grid h-[22px] w-[22px] place-items-center rounded-full border"
              style={{
                background: done ? "oklch(0.70 0.16 162)" : "white",
                borderColor: done ? "oklch(0.70 0.16 162)" : "oklch(0.88 0.01 265)",
                color: done ? "white" : "oklch(0.7 0.02 265)",
              }}
            >
              {done ? <Check className="h-3 w-3" /> : <Circle className="h-2 w-2" />}
            </span>
            <div className="flex-1">
              <div
                className={`text-[13px] ${done ? "font-medium text-foreground" : "text-muted-foreground"}`}
              >
                {step.label}
              </div>
              {hit && (
                <div className="text-mono-data text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
                  {new Date(hit.created_at).toLocaleString()}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
