import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Smartphone } from "lucide-react";

export const Route = createFileRoute("/docs/pwa")({
  head: () => ({ meta: [{ title: "Install SevaJyothi · PWA" }] }),
  component: PwaDoc,
});

function PwaDoc() {
  return (
    <article className="mx-auto max-w-3xl px-6 pt-32 pb-24">
      <Link to="/docs" className="mb-6 inline-flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground" data-cursor="link">
        <ArrowLeft className="h-4 w-4" /> Documentation
      </Link>
      <div className="text-mono-data text-[11px] uppercase tracking-[0.16em] text-accent">Installation</div>
      <h1 className="mt-2 text-display text-[clamp(2rem,4vw,3rem)]">Install as a native app</h1>
      <p className="mt-3 text-[15px] text-muted-foreground">
        SevaJyothi ships as a Progressive Web App — no Play Store, no App Store, no waiting. The same URL becomes an installed app on every device.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Steps title="Android · Chrome">
          <li>Open SevaJyothi in Chrome.</li>
          <li>Tap the ⋮ menu → <span className="text-foreground">Add to Home screen</span>.</li>
          <li>Confirm — the app launches in its own window.</li>
        </Steps>
        <Steps title="iOS · Safari">
          <li>Open SevaJyothi in Safari (not Chrome).</li>
          <li>Tap the share button → <span className="text-foreground">Add to Home Screen</span>.</li>
          <li>Launch from the icon — runs in standalone mode.</li>
        </Steps>
      </div>

      <div className="mt-8 glass rounded-3xl p-6 text-[13.5px] text-muted-foreground">
        <div className="mb-2 inline-flex items-center gap-2 text-[12px] font-medium text-foreground">
          <Smartphone className="h-3.5 w-3.5" /> What you get when installed
        </div>
        <ul className="list-disc space-y-1 pl-5">
          <li>Full-screen, no browser chrome.</li>
          <li>App-shell cached on first load — opens instantly.</li>
          <li>Offline reporting works without ever opening Safari.</li>
          <li>Background Sync (Android) flushes queued reports automatically.</li>
        </ul>
      </div>
    </article>
  );
}

function Steps({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-6">
      <div className="text-display text-[18px]">{title}</div>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[13.5px] text-muted-foreground">{children}</ol>
    </div>
  );
}
