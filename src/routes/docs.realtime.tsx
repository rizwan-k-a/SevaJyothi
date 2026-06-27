import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Activity, Radio, Map } from "lucide-react";

export const Route = createFileRoute("/docs/realtime")({
  head: () => ({ meta: [{ title: "Realtime architecture · SevaJyothi" }] }),
  component: RealtimeDoc,
});

function RealtimeDoc() {
  return (
    <article className="mx-auto max-w-3xl px-6 pt-32 pb-24">
      <Link to="/docs" className="mb-6 inline-flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground" data-cursor="link">
        <ArrowLeft className="h-4 w-4" /> Documentation
      </Link>
      <div className="text-mono-data text-[11px] uppercase tracking-[0.16em] text-accent">Realtime</div>
      <h1 className="mt-2 text-display text-[clamp(2rem,4vw,3rem)]">A live operational fabric</h1>
      <p className="mt-3 text-[15px] text-muted-foreground">
        Every dashboard subscribes to Postgres changes through Supabase Realtime. When a complaint moves, the citizen, the authority and the technician all see the new state inside a single repaint.
      </p>
      <div className="mt-10 grid gap-4">
        <Block icon={Activity} title="Live in production today"
          body="The citizen, authority and technician views subscribe to postgres_changes on the complaints table. Status moves propagate without polling." />
        <Block icon={Radio} title="Event-sourced audit"
          body="Every state transition is recorded in complaint_events with the actor's user id and a timestamp — the audit trail demanded by government delivery." />
        <Block icon={Map} title="Roadmap — geospatial fabric"
          body="Region heatmaps, SLA breach detection, predictive routing for technicians. The underlying data is captured today; the analytics surfaces ship next." />
      </div>
    </article>
  );
}

function Block({ icon: Icon, title, body }: { icon: any; title: string; body: string }) {
  return (
    <div className="glass rounded-2xl p-6" data-cursor="card">
      <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/5 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-display text-[20px]">{title}</div>
      <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
