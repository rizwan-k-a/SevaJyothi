import { motion } from "framer-motion";

/**
 * Cinematic background: animated topographic grid + signal pulses + pipeline lines.
 * Pure SVG/CSS — no canvas, SSR-safe, GPU-friendly.
 */
export function InfrastructureBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Ambient gradient orbs */}
      <div
        className="absolute -left-32 top-10 h-[520px] w-[520px] rounded-full opacity-60 blur-3xl"
        style={{
          background: "radial-gradient(closest-side, oklch(0.78 0.10 200 / 0.55), transparent 70%)",
        }}
      />
      <div
        className="absolute -right-40 top-40 h-[600px] w-[600px] rounded-full opacity-50 blur-3xl"
        style={{
          background: "radial-gradient(closest-side, oklch(0.58 0.21 264 / 0.45), transparent 70%)",
        }}
      />

      {/* Topographic grid */}
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.22 0.05 265 / 0.18) 1px, transparent 1px), linear-gradient(90deg, oklch(0.22 0.05 265 / 0.18) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          animation: "sj-grid-pan 22s linear infinite",
        }}
      />

      {/* SVG network */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="wire" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.58 0.21 264)" stopOpacity="0.0" />
            <stop offset="50%" stopColor="oklch(0.58 0.21 264)" stopOpacity="0.7" />
            <stop offset="100%" stopColor="oklch(0.58 0.21 264)" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="pipe" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="oklch(0.78 0.10 200)" stopOpacity="0.0" />
            <stop offset="50%" stopColor="oklch(0.78 0.10 200)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="oklch(0.78 0.10 200)" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Curved topo lines */}
        {Array.from({ length: 7 }).map((_, i) => (
          <path
            key={i}
            d={`M -100 ${180 + i * 80} C 300 ${120 + i * 80}, 900 ${240 + i * 80}, 1540 ${160 + i * 80}`}
            fill="none"
            stroke="oklch(0.22 0.05 265 / 0.10)"
            strokeWidth="1"
          />
        ))}

        {/* Electric grid path */}
        <path
          d="M 80 720 L 280 720 L 320 660 L 520 660 L 560 720 L 760 720 L 800 600 L 1000 600 L 1040 700 L 1360 700"
          fill="none"
          stroke="url(#wire)"
          strokeWidth="1.5"
          strokeDasharray="6 8"
          style={{ animation: "sj-dash 6s linear infinite" }}
        />
        {/* Pipeline */}
        <path
          d="M 60 480 C 360 420, 720 540, 1080 460 S 1380 480, 1500 440"
          fill="none"
          stroke="url(#pipe)"
          strokeWidth="2"
          strokeDasharray="2 10"
          style={{ animation: "sj-dash 8s linear infinite reverse" }}
        />

        {/* Nodes with pulses */}
        {[
          { x: 280, y: 720, c: "264" },
          { x: 560, y: 720, c: "264" },
          { x: 800, y: 600, c: "264" },
          { x: 1040, y: 700, c: "264" },
          { x: 360, y: 460, c: "200" },
          { x: 1080, y: 460, c: "200" },
          { x: 720, y: 510, c: "27" },
        ].map((n, i) => (
          <g key={i} transform={`translate(${n.x} ${n.y})`}>
            <circle r="14" fill={`oklch(0.58 0.21 ${n.c} / 0.18)`}>
              <animate
                attributeName="r"
                values="6;26;6"
                dur="3s"
                begin={`${i * 0.4}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.7;0;0.7"
                dur="3s"
                begin={`${i * 0.4}s`}
                repeatCount="indefinite"
              />
            </circle>
            <circle r="3.5" fill={`oklch(0.58 0.21 ${n.c})`} />
          </g>
        ))}
      </svg>

      {/* Soft vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 50%, oklch(0.978 0.003 247) 100%)",
        }}
      />

      {/* Parallax mouse layer */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2 }}
      />
    </div>
  );
}
