import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, BookOpen } from "lucide-react";

export const Route = createFileRoute("/docs")({
  head: () => ({ meta: [{ title: "Documentation · SevaJyothi" }] }),
  component: Docs,
});

const sections = [
  {
    to: "/docs/offline",
    title: "Offline-first architecture",
    body: "How SevaJyothi uses IndexedDB and the Service Worker Background Sync API to guarantee zero data loss in dead-zone conditions.",
  },
  {
    to: "/docs/roles",
    title: "Three-role model",
    body: "Citizens raise. Authorities triage. Technicians resolve. A single graph of accountability.",
  },
  {
    to: "/docs/pwa",
    title: "PWA installability",
    body: "SevaJyothi installs as a native app on Android and iOS — manifest, icons, and full offline boot.",
  },
  {
    to: "/docs/realtime",
    title: "Realtime fabric",
    body: "Postgres-backed event stream for live incident updates across all three dashboards.",
  },
] as const;

function Docs() {
  return (
    <div className="mx-auto max-w-4xl px-6 pt-32 pb-24">
      <Link to="/" className="mb-6 inline-flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground" data-cursor="link">
        ← Home
      </Link>
      <div className="mb-10">
        <div className="text-mono-data text-[11px] uppercase tracking-[0.16em] text-accent">Documentation</div>
        <h1 className="mt-2 text-display text-[clamp(2.2rem,5vw,3.6rem)]">
          The{" "}
          <span className="text-accent-script text-accent text-[1.25em] leading-[0.6]">handbook</span>.
        </h1>
        <p className="mt-3 max-w-xl text-[15px] text-muted-foreground">
          Reference for the architecture, role model and platform primitives that power SevaJyothi.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {sections.map((s) => (
          <Link key={s.to} to={s.to} data-cursor="card"
            className="glass group rounded-2xl p-6 transition hover:bg-white/80">
            <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/5 text-primary">
              <BookOpen className="h-4 w-4" />
            </div>
            <div className="text-display text-[20px]">{s.title}</div>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{s.body}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-[11.5px] font-medium text-accent">
              Read more <ArrowUpRight className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
