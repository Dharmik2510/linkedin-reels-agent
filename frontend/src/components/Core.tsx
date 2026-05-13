import { useEffect, useRef } from "react";
import type { Stage } from "../types";
import { useReducedMotion } from "../hooks/useReducedMotion";
import styles from "./Core.module.css";

const LABELS: Record<Stage, { glyph: string; label: string }> = {
  idle:       { glyph: "—", label: "STANDBY" },
  scraping:   { glyph: "↯", label: "SCRAPING" },
  parsing:    { glyph: "↯", label: "PARSING" },
  generating: { glyph: "↯", label: "REELIFY" },
  done:       { glyph: "✓", label: "READY" },
};

interface Particle {
  phase: number;
  radius: number;
  speed: number;
}

const PARTICLES: Particle[] = Array.from({ length: 9 }, (_, i) => ({
  phase: (i * 2 * Math.PI) / 9 + Math.random(),
  radius: 50 + Math.random() * 50,
  speed: 0.4 + Math.random() * 0.6,
}));

const TICK_ANGLES = [0, 90, 180, 270];

function leftPaths(): string[] {
  // 5 bezier paths from (x=-20, varying y) curving toward center
  return [-60, -30, 0, 30, 60].map((y) =>
    `M -20 ${120 + y} C 60 ${120 + y * 0.4}, 100 120, 140 120`
  );
}

function rightPaths(): string[] {
  return [-60, -30, 0, 30, 60].map((y) =>
    `M 140 120 C 180 120, 220 ${120 + y * 0.4}, 300 ${120 + y}`
  );
}

export default function Core({ stage }: { stage: Stage }) {
  const { glyph, label } = LABELS[stage];
  const running = stage !== "idle" && stage !== "done";
  const reduced = useReducedMotion();
  const particleRefs = useRef<Array<SVGCircleElement | null>>([]);
  const rafRef = useRef(0);
  const startRef = useRef(performance.now());

  useEffect(() => {
    if (reduced) return;
    const tick = (now: number) => {
      const dt = (now - startRef.current) / 1000;
      const cx = 120, cy = 120;
      const speedMul = running ? 1.2 : 0.25;
      PARTICLES.forEach((p, i) => {
        const a = p.phase + dt * p.speed * speedMul;
        const x = cx + Math.cos(a) * p.radius;
        const y = cy + Math.sin(a) * p.radius * 0.95;
        const el = particleRefs.current[i];
        if (el) {
          el.setAttribute("cx", String(x));
          el.setAttribute("cy", String(y));
          el.setAttribute("opacity", running ? "0.85" : "0.35");
        }
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [running, reduced]);

  return (
    <div className={styles.wrap}>
      <svg className={styles.connector} viewBox="0 0 300 240" preserveAspectRatio="none">
        {leftPaths().map((d, i) => (
          <path
            key={`l-${i}`}
            d={d}
            className={running ? styles.live : ""}
            style={{ animationDelay: `${i * 0.08}s` }}
          />
        ))}
        {rightPaths().map((d, i) => (
          <path
            key={`r-${i}`}
            d={d}
            className={running ? styles.live : ""}
            style={{ animationDelay: `${i * 0.08}s` }}
          />
        ))}
      </svg>

      <div className={styles.rings}>
        <div className={`${styles.ring} ${reduced ? "" : styles.spin1}`}>
          {TICK_ANGLES.map((a, i) => (
            <span
              key={a}
              className={`${styles.ringTick} ${i === 0 ? styles.accent : ""}`}
              style={{ transform: `translateX(-50%) rotate(${a}deg) translateY(-120px)` }}
            />
          ))}
        </div>
        <div className={`${styles.ring} ${styles.r1} ${reduced ? "" : styles.spin2}`} />
        <div className={`${styles.ring} ${styles.r2} ${reduced ? "" : styles.spin3}`} />
        <div className={`${styles.ring} ${styles.r3}`} />
      </div>

      <svg className={styles.particles} viewBox="0 0 240 240">
        {PARTICLES.map((_, i) => (
          <circle
            key={i}
            ref={(el) => { particleRefs.current[i] = el; }}
            r="2.4"
            cx="120"
            cy="120"
            opacity="0.35"
          />
        ))}
      </svg>

      <div className={styles.bulb}>
        <div className={styles.glyph}>
          <div className={styles.big}>{glyph}</div>
          <div className={styles.lbl}>{label}</div>
        </div>
      </div>
    </div>
  );
}
