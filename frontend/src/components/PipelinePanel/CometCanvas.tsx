import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Comet } from "../../types";
import { useReducedMotion } from "../../hooks/useReducedMotion";

interface CometPosition {
  id: number;
  x: number;
  y: number;
  ang: number;
  label: string;
  t: number;
}

function makeCometPath(w: number, h: number): string {
  const startX = 100;
  const endX = w - 100;
  const midX = w / 2;
  const y = h / 2;
  return `M ${startX} ${y} ` +
         `C ${startX + 100} ${y - 80}, ${midX - 60} ${y + 40}, ${midX} ${y} ` +
         `S ${endX - 100} ${y - 40}, ${endX} ${y}`;
}

interface Props {
  comets: Comet[];
  width: number;
  height: number;
  onPositions?: (positions: CometPosition[]) => void;
}

export default function CometCanvas({ comets, width, height, onPositions }: Props) {
  const pathRef = useRef<SVGPathElement | null>(null);
  const lenRef = useRef(0);
  const [, force] = useState(0);
  const reduced = useReducedMotion();

  // Path length re-measure on resize
  useLayoutEffect(() => {
    if (pathRef.current) lenRef.current = pathRef.current.getTotalLength();
  }, [width, height]);

  // Force a re-render each frame so we re-read comet positions from the path.
  // (Comet `t` values change via the engine's COMET_FRAME dispatches; this just
  // re-projects them onto the SVG path.)
  useEffect(() => {
    if (comets.length === 0) return;
    let raf = 0;
    const tick = () => {
      force((n) => (n + 1) & 0xffff);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [comets.length > 0]);

  const positions = useMemo<CometPosition[]>(() => {
    if (!pathRef.current || lenRef.current === 0) return [];
    const out: CometPosition[] = [];
    for (const c of comets) {
      const t = Math.max(0, Math.min(1, c.t));
      const pt = pathRef.current.getPointAtLength(t * lenRef.current);
      const pt2 = pathRef.current.getPointAtLength(Math.min(1, t + 0.005) * lenRef.current);
      const ang = Math.atan2(pt2.y - pt.y, pt2.x - pt.x) * 180 / Math.PI;
      out.push({ id: c.id, x: pt.x, y: pt.y, ang, label: c.label, t });
    }
    return out;
  }, [comets]);

  useEffect(() => {
    if (onPositions) onPositions(positions);
  }, [positions, onPositions]);

  const d = makeCometPath(width, height);

  return (
    <>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      >
        <path ref={pathRef} className="lane" d={d} />
        {comets.length > 0 && <path className="lane hot" d={d} />}
      </svg>
      {positions.map((p) => (
        <div
          key={p.id}
          className="comet"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            transform: `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`,
            opacity: p.t < 0.03 || p.t > 0.97 ? 0 : 1,
            pointerEvents: "none",
          }}
        >
          {!reduced && <div className="trail" style={{ transform: `rotate(${p.ang}deg)` }} />}
          <div className="core-dot" />
          <div className="label">{p.label}</div>
        </div>
      ))}
    </>
  );
}
