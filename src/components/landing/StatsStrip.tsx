import { motion } from "framer-motion";

const stats = [
  { value: "24,521", label: "Incidents resolved", sub: "across 12 districts" },
  { value: "5,238", label: "Villages connected", sub: "live on SevaJyothi" },
  { value: "96.4%", label: "First-pass resolution", sub: "within SLA window" },
  { value: "00:42", label: "Median response", sub: "minutes to acknowledge" },
];

export function StatsStrip() {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
      className="relative mt-24 grid grid-cols-2 gap-3 sm:grid-cols-4"
    >
      {stats.map((s) => (
        <motion.div
          key={s.label}
          variants={{
            hidden: { opacity: 0, y: 16 },
            show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.2, 0.8, 0.2, 1] } },
          }}
          whileHover={{ y: -4 }}
          data-cursor="card"
          className="glass rounded-2xl p-5"
        >
          <div className="text-mono-data text-[28px] leading-none text-ink">{s.value}</div>
          <div className="mt-2 text-[13px] font-medium text-foreground">{s.label}</div>
          <div className="text-[11.5px] text-muted-foreground">{s.sub}</div>
        </motion.div>
      ))}
    </motion.div>
  );
}
