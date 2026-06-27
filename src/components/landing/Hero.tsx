import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Radio } from "lucide-react";
import { InfrastructureBackground } from "./InfrastructureBackground";
import { StatsStrip } from "./StatsStrip";

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};
const rise = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.2, 0.8, 0.2, 1] as const } },
};

export function Hero() {
  return (
    <section className="relative isolate flex min-h-[100svh] flex-col justify-center overflow-hidden pt-28">
      <InfrastructureBackground />

      <div className="relative mx-auto w-full max-w-6xl px-6">
        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="mb-7 flex justify-center"
        >
          <span className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-medium text-foreground/80">
            <Radio className="h-3.5 w-3.5 text-accent" />
            <span className="text-mono-data uppercase tracking-[0.14em]">Offline-first · Built for Bharat</span>
          </span>
        </motion.div>

        <motion.div variants={stagger} initial="hidden" animate="show" className="text-center">
          <motion.h1 variants={rise} className="text-display text-balance text-[clamp(2.6rem,7vw,5.8rem)]">
            Rural infrastructure
            <br />
            should never wait for{" "}
            <span className="text-accent-script text-accent text-[1.18em] leading-[0.7] -mr-2">signal</span>.
          </motion.h1>

          <motion.p
            variants={rise}
            className="mx-auto mt-7 max-w-2xl text-[17px] leading-relaxed text-muted-foreground"
          >
            SevaJyothi is the offline-first infrastructure intelligence layer for villages
            operating beyond the network edge. Report transformer failures, pipe bursts and
            road damage from anywhere — we sync the moment signal returns.
          </motion.p>

          <motion.div variants={rise} className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/citizen/report"
              data-cursor="cta"
              data-cursor-label="Report"
              className="group inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-[14px] font-medium text-primary-foreground shadow-[0_10px_30px_oklch(0.22_0.05_265/0.25)] transition-all hover:brightness-110"
            >
              Report infrastructure failure
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
            <Link
              to="/citizen"
              data-cursor="button"
              className="glass inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-medium text-foreground transition-all hover:bg-white/80"
            >
              View live dashboard
            </Link>
          </motion.div>

          <motion.div variants={rise} className="mt-8 flex items-center justify-center gap-6 text-[12px] text-muted-foreground">
            <SignalDot color="oklch(0.70 0.16 162)" label="Grid · Stable" />
            <SignalDot color="oklch(0.78 0.15 75)" label="Water · 3 alerts" />
            <SignalDot color="oklch(0.62 0.23 27)" label="Lights · Outage" />
          </motion.div>
        </motion.div>

        <StatsStrip />
      </div>
    </section>
  );
}

function SignalDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative inline-flex h-2 w-2">
        <span className="absolute inset-0 rounded-full animate-sj-pulse-ring" style={{ background: color, opacity: 0.6 }} />
        <span className="relative inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      </span>
      <span className="text-mono-data uppercase tracking-[0.12em]">{label}</span>
    </span>
  );
}
