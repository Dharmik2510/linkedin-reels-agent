import { useEffect, useRef } from "react";
import type { Stage } from "../../types";
import { useElapsed } from "../../hooks/useElapsed";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { fmtElapsed } from "../../utils/text";

const STAGE_LABELS: Record<Stage, { big: string; sub: string }> = {
  idle:       { big: "STANDBY", sub: "agent ready · idle" },
  scraping:   { big: "SCRAPE",  sub: "playwright · /saved-posts" },
  parsing:    { big: "PARSE",   sub: "dedup · embed · rank" },
  generating: { big: "REELIFY", sub: "drafting reel scripts" },
  done:       { big: "READY",   sub: "pipeline complete" },
};

interface Props {
  stage: Stage;
  progress: number;            // 0..1
  intensity: number;           // increments per comet centre-cross
  scraped: number;
  elapsedStart: number | null;
  running: boolean;
}

export default function ScopeCore({ stage, progress, intensity, scraped, elapsedStart, running }: Props) {
  const pathRef = useRef<SVGPathElement | null>(null);
  const ampRef = useRef(0.15);
  const targetAmpRef = useRef(0.15);
  const reduced = useReducedMotion();

  const elapsed = useElapsed(running, elapsedStart);

  useEffect(() => {
    targetAmpRef.current = Math.min(1.1, 0.18 + intensity * 0.3);
    const id = window.setTimeout(() => { targetAmpRef.current = 0.20; }, 280);
    return () => window.clearTimeout(id);
  }, [intensity]);

  useEffect(() => {
    if (reduced) return;
    const path = pathRef.current;
    if (!path) return;
    const W = 340;
    const H = 220;
    let raf = 0;
    const tick = (t: number) => {
      ampRef.current += (targetAmpRef.current - ampRef.current) * 0.18;
      const amp = ampRef.current;
      const ms = t / 1000;
      const segs = 60;
      let d = "";
      for (let i = 0; i <= segs; i++) {
        const x = (i / segs) * W;
        const phase = (i / segs) * Math.PI * 4 + ms * 3.2;
        const phase2 = (i / segs) * Math.PI * 9 + ms * 5;
        const y = H / 2 + Math.sin(phase) * (H * 0.18 * amp) + Math.sin(phase2) * (H * 0.05 * amp);
        d += (i === 0 ? "M " : "L ") + x.toFixed(2) + " " + y.toFixed(2) + " ";
      }
      path.setAttribute("d", d);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  const label = STAGE_LABELS[stage];
  const throughput = elapsed > 0 ? (scraped / (elapsed / 1000)).toFixed(1) : "0.0";

  return (
    <div className="core-zone">
      <div className="scope">
        <div className="gridlines" />
        <svg viewBox="0 0 340 220" preserveAspectRatio="none">
          <line x1="0" y1="110" x2="340" y2="110"
                stroke="oklch(0.88 0.19 128 / 0.18)" strokeDasharray="2 4" />
          <path ref={pathRef}
                stroke="oklch(0.88 0.19 128)" strokeWidth="1.4" fill="none"
                style={{ filter: "drop-shadow(0 0 5px oklch(0.88 0.19 128 / 0.7))" }}
                d={reduced ? "M 0 110 L 340 110" : ""} />
        </svg>
        <div className="scope-label"><span className="dot" />SIGNAL · LIVE</div>
        <div className="scope-readout">
          <div>elapsed&nbsp;<span style={{ color: "var(--fg)" }}>{fmtElapsed(elapsed)}</span></div>
          <div>throughput&nbsp;<span style={{ color: "var(--fg)" }}>{throughput}</span>/s</div>
        </div>
        <div className="scope-stage">
          {label.big}
          <small>{label.sub}</small>
        </div>
        <div className="scope-progress"><i style={{ width: `${(progress * 100).toFixed(1)}%` }} /></div>
      </div>
    </div>
  );
}
