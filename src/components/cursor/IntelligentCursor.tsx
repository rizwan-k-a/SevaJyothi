import { useEffect, useRef, useState } from "react";

/**
 * Zero-lag intelligent cursor.
 *
 * Performance contract:
 *  - One render path: the wrapper element receives `translate3d` directly from
 *    `pointermove` (no requestAnimationFrame, no spring interpolation).
 *  - Variant changes mutate inline CSS — no React re-render in the hot path,
 *    no width/height transitions (we scale a fixed-size ring instead).
 *  - Disabled on coarse pointers via CSS in styles.css.
 */
type Variant = "default" | "button" | "link" | "card" | "cta" | "upload" | "map" | "nav" | "text";

const VARIANT: Record<
  Variant,
  { scale: number; bg: string; border: string; mix: string; radius: number }
> = {
  default: {
    scale: 1.0,
    bg: "transparent",
    border: "oklch(0.22 0.05 265 / 0.4)",
    mix: "normal",
    radius: 999,
  },
  button: {
    scale: 1.6,
    bg: "oklch(0.58 0.21 264 / 0.16)",
    border: "oklch(0.58 0.21 264 / 0.55)",
    mix: "normal",
    radius: 999,
  },
  link: {
    scale: 1.25,
    bg: "oklch(0.58 0.21 264 / 0.10)",
    border: "oklch(0.58 0.21 264 / 0.45)",
    mix: "normal",
    radius: 999,
  },
  card: {
    scale: 1.9,
    bg: "oklch(1 0 0 / 0.18)",
    border: "oklch(1 0 0 / 0.5)",
    mix: "difference",
    radius: 999,
  },
  cta: {
    scale: 2.1,
    bg: "oklch(0.58 0.21 264 / 0.22)",
    border: "oklch(0.58 0.21 264 / 0.7)",
    mix: "normal",
    radius: 999,
  },
  upload: {
    scale: 2.6,
    bg: "oklch(0.70 0.16 162 / 0.18)",
    border: "oklch(0.70 0.16 162 / 0.6)",
    mix: "normal",
    radius: 16,
  },
  map: {
    scale: 1.45,
    bg: "oklch(0.62 0.23 27 / 0.10)",
    border: "oklch(0.62 0.23 27 / 0.55)",
    mix: "normal",
    radius: 999,
  },
  nav: {
    scale: 1.1,
    bg: "oklch(0.22 0.05 265 / 0.08)",
    border: "oklch(0.22 0.05 265 / 0.4)",
    mix: "normal",
    radius: 999,
  },
  text: {
    scale: 0.2,
    bg: "oklch(0.22 0.05 265)",
    border: "oklch(0.22 0.05 265)",
    mix: "normal",
    radius: 999,
  },
};

const BASE = 28;

export function IntelligentCursor() {
  const wrap = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    setEnabled(true);

    const onMove = (e: PointerEvent) => {
      const w = wrap.current;
      if (!w) return;
      // Direct transform — no rAF, no interpolation. The browser composites this on the GPU.
      w.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
    };

    const applyVariant = (v: Variant) => {
      const r = ring.current;
      const d = dot.current;
      if (!r || !d) return;
      const cfg = VARIANT[v];
      r.style.transform = `translate(-50%, -50%) scale(${cfg.scale})`;
      r.style.background = cfg.bg;
      r.style.borderColor = cfg.border;
      r.style.mixBlendMode = cfg.mix;
      r.style.borderRadius = `${cfg.radius}px`;
      d.style.opacity = v === "text" ? "0" : "1";
    };

    let lastVariant: Variant = "default";
    const detect = (target: EventTarget | null): Variant => {
      let el = target as HTMLElement | null;
      while (el && el !== document.body) {
        const v = el.dataset?.cursor as Variant | undefined;
        if (v) return v;
        const tag = el.tagName;
        if (tag === "A") return "link";
        if (tag === "BUTTON") return "button";
        if (tag === "INPUT" || tag === "TEXTAREA") return "text";
        el = el.parentElement;
      }
      return "default";
    };

    const onOver = (e: PointerEvent) => {
      const v = detect(e.target);
      if (v !== lastVariant) {
        lastVariant = v;
        applyVariant(v);
      }
    };

    const onDown = () => {
      const r = ring.current;
      if (r) r.style.transitionDuration = "120ms";
    };
    const onUp = () => {
      const r = ring.current;
      if (r) r.style.transitionDuration = "";
    };
    const onLeave = () => {
      const w = wrap.current;
      if (w) w.style.opacity = "0";
    };
    const onEnter = () => {
      const w = wrap.current;
      if (w) w.style.opacity = "1";
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerover", onOver, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    document.addEventListener("mouseleave", onLeave);
    document.addEventListener("mouseenter", onEnter);

    document.body.classList.add("custom-cursor-active");

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerover", onOver);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("mouseenter", onEnter);
      document.body.classList.remove("custom-cursor-active");
    };
  }, []);

  if (!enabled) return null;

  return (
    <div
      ref={wrap}
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 9999,
        pointerEvents: "none",
        willChange: "transform",
        transition: "opacity 200ms ease",
      }}
    >
      <div
        ref={ring}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: BASE,
          height: BASE,
          border: "1.5px solid oklch(0.22 0.05 265 / 0.4)",
          borderRadius: 999,
          transform: "translate(-50%, -50%)",
          transition:
            "transform 220ms cubic-bezier(0.2,0.8,0.2,1), background 220ms, border-color 220ms, border-radius 220ms",
          willChange: "transform",
        }}
      />
      <div
        ref={dot}
        style={{
          position: "absolute",
          left: -3,
          top: -3,
          width: 6,
          height: 6,
          borderRadius: 999,
          background: "oklch(0.22 0.05 265)",
          transition: "opacity 160ms ease",
        }}
      />
    </div>
  );
}
