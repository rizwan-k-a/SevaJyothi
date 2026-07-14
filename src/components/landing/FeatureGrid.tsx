import { motion } from "framer-motion";
import { CloudOff, RadioTower, ShieldCheck, Workflow } from "lucide-react";

const items = [
  {
    icon: CloudOff,
    title: "Offline by default",
    body: "Reports are written to encrypted on-device storage the instant they're captured. No spinners. No retries. No lost evidence.",
  },
  {
    icon: RadioTower,
    title: "Sync at the edge of signal",
    body: "The moment a single bar returns, queued complaints flow to the network with background-sync semantics — battery and bandwidth aware.",
  },
  {
    icon: ShieldCheck,
    title: "Government-grade audit",
    body: "Every state transition is signed and timestamped. Citizens see proof of work. Authorities see proof of action.",
  },
  {
    icon: Workflow,
    title: "Three roles, one fabric",
    body: "Citizens report. Authorities triage. Technicians resolve. A single graph of accountability across the rural infrastructure lifecycle.",
  },
];

export function FeatureGrid() {
  return (
    <section className="relative mx-auto w-full max-w-6xl px-6 py-32">
      <div className="mb-14 max-w-2xl">
        <div className="text-mono-data text-[11px] uppercase tracking-[0.18em] text-accent">
          The platform
        </div>
        <h2 className="mt-3 text-display text-[clamp(2rem,4.5vw,3.4rem)]">
          A new operating layer for{" "}
          <span className="text-accent-script text-accent text-[1.25em] leading-[0.6]">
            essential
          </span>{" "}
          public services.
        </h2>
        <p className="mt-5 text-[16px] leading-relaxed text-muted-foreground">
          SevaJyothi was engineered for the realities of rural India — intermittent connectivity,
          low-end devices, high-stakes outages. Every primitive is designed to keep working when the
          network does not.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((it, i) => (
          <motion.div
            key={it.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, delay: i * 0.06, ease: [0.2, 0.8, 0.2, 1] }}
            whileHover={{ y: -4 }}
            data-cursor="card"
            className="glass group relative overflow-hidden rounded-3xl p-7"
          >
            <div className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/5 text-primary ring-1 ring-primary/10">
              <it.icon className="h-4.5 w-4.5" strokeWidth={1.6} />
            </div>
            <h3 className="text-display text-[22px]">{it.title}</h3>
            <p className="mt-2 text-[14.5px] leading-relaxed text-muted-foreground">{it.body}</p>
            <div
              className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-0 blur-2xl transition-opacity duration-700 group-hover:opacity-70"
              style={{
                background:
                  "radial-gradient(closest-side, oklch(0.58 0.21 264 / 0.35), transparent 70%)",
              }}
            />
          </motion.div>
        ))}
      </div>
    </section>
  );
}
