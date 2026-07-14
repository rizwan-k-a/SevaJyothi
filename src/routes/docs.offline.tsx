import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Database, CloudOff, RefreshCcw, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/docs/offline")({
  head: () => ({ meta: [{ title: "Offline architecture · SevaJyothi" }] }),
  component: OfflineDoc,
});

function OfflineDoc() {
  return (
    <article className="mx-auto max-w-3xl px-6 pt-32 pb-24">
      <Link
        to="/docs"
        className="mb-6 inline-flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground"
        data-cursor="link"
      >
        <ArrowLeft className="h-4 w-4" /> Documentation
      </Link>
      <div className="text-mono-data text-[11px] uppercase tracking-[0.16em] text-accent">
        Architecture
      </div>
      <h1 className="mt-2 text-display text-[clamp(2rem,4vw,3rem)]">
        Offline-first by construction
      </h1>
      <p className="mt-3 text-[15px] text-muted-foreground">
        Rural India does not have continuous LTE. SevaJyothi never assumes the network is there —
        every write commits locally first, then propagates.
      </p>

      <div className="mt-10 grid gap-4">
        <Block
          icon={Database}
          title="Local store · IndexedDB"
          body="Every complaint is written to the sevajyothi database (object store complaints) keyed by a client-generated id. Includes GPS, base64 photo, category, timestamp."
        />
        <Block
          icon={CloudOff}
          title="Capture without signal"
          body="The reporter UI never blocks on the network. The submit button shows two states — Submit now (online) vs Save securely (offline) — and behaves identically from the user's perspective."
        />
        <Block
          icon={RefreshCcw}
          title="Automatic replay"
          body="When the online event fires, OfflineProvider drains the queue. Each row is upserted into the public.complaints table using client_id as the conflict key, so retries are safe. Background Sync (where supported) wakes the Service Worker to flush even when the tab is backgrounded."
        />
        <Block
          icon={ShieldCheck}
          title="No data loss invariant"
          body="A row is only marked synced after the cloud row is acknowledged. If the upload fails, the row remains in pending_sync and the failure reason is surfaced in the dashboard for transparency."
        />
      </div>

      <div className="mt-10 glass rounded-3xl p-6 text-[13.5px] text-muted-foreground">
        <div className="text-mono-data text-[11px] uppercase tracking-[0.14em] text-accent">
          Implementation
        </div>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>
            <code className="text-mono-data">src/lib/offline/db.ts</code> — IDB CRUD and Supabase
            sync bridge
          </li>
          <li>
            <code className="text-mono-data">src/components/providers/OfflineProvider.tsx</code> —
            online listener + SW message bridge
          </li>
          <li>
            <code className="text-mono-data">public/sw.js</code> — Service Worker with Background
            Sync tag <code>sj-flush-complaints</code>
          </li>
        </ul>
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
