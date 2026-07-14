import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

export function ClosingCTA() {
  return (
    <section className="relative mx-auto w-full max-w-6xl px-6 pb-32">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
        className="glass-dark relative overflow-hidden rounded-[2rem] px-10 py-16 text-center sm:px-16 sm:py-20"
      >
        <div
          aria-hidden
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(800px 320px at 20% 0%, oklch(0.58 0.21 264 / 0.6), transparent 60%), radial-gradient(700px 320px at 100% 100%, oklch(0.78 0.10 200 / 0.5), transparent 60%)",
          }}
        />
        <div className="relative">
          <h2 className="text-display text-[clamp(2rem,5vw,3.6rem)] text-white">
            Built for the{" "}
            <span
              className="text-accent-script text-[1.25em] leading-[0.6]"
              style={{ color: "oklch(0.85 0.10 75)" }}
            >
              last
            </span>{" "}
            kilometre.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[15.5px] leading-relaxed text-white/70">
            Join the platform powering proactive infrastructure response across rural India.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/auth"
              data-cursor="cta"
              className="group inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-[14px] font-medium text-primary transition-transform hover:scale-[1.02]"
            >
              Get started
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
            <Link
              to="/citizen"
              data-cursor="button"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3.5 text-[14px] font-medium text-white backdrop-blur-md transition-colors hover:bg-white/10"
            >
              Explore the dashboard
            </Link>
          </div>
        </div>
      </motion.div>

      <footer className="mt-14 flex flex-col items-center justify-between gap-3 border-t border-border/70 pt-6 text-[12px] text-muted-foreground sm:flex-row">
        <div>© {new Date().getFullYear()} SevaJyothi · Rural infrastructure intelligence</div>
        <div className="text-mono-data uppercase tracking-[0.14em]">v0.1 · Phase I</div>
      </footer>
    </section>
  );
}
