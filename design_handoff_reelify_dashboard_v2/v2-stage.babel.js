// v2-stage — Pipeline stage: HexGrid background, PostStack, ReelDeck, ScopeCore, CometCanvas
const { useState: useStateS, useEffect: useEffectS, useRef: useRefS, useMemo: useMemoS, useLayoutEffect: useLayoutEffectS } = React;

// ---------- Hex math (flat-top hexagons) ----------
const HEX_R = 22; // radius
const HEX_W = HEX_R * 2;             // = 44
const HEX_H = Math.sqrt(3) * HEX_R;  // ≈ 38.1
const HEX_DX = HEX_W * 0.75;         // = 33 (column spacing)

function hexPoints(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    pts.push((cx + Math.cos(a) * r).toFixed(2) + "," + (cy + Math.sin(a) * r).toFixed(2));
  }
  return pts.join(" ");
}

// Build a grid of hex cells covering width × height
function buildHexes(width, height) {
  const cells = [];
  const cols = Math.ceil(width / HEX_DX) + 2;
  const rows = Math.ceil(height / HEX_H) + 2;
  for (let q = -1; q < cols; q++) {
    for (let r = -1; r < rows; r++) {
      const cx = q * HEX_DX;
      const cy = r * HEX_H + ((q % 2) ? HEX_H / 2 : 0);
      cells.push({ id: q + "," + r, cx, cy, points: hexPoints(cx, cy, HEX_R - 1.5) });
    }
  }
  return cells;
}

// Find the nearest hex cell index for an (x,y) — cheap brute force, fine at ~200 cells
function findHexAt(cells, x, y) {
  let best = null, bestD = Infinity;
  for (const c of cells) {
    const dx = c.cx - x, dy = c.cy - y;
    const d = dx*dx + dy*dy;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

// ---------- HexGrid background ----------
function HexGrid({ width, height, litMap }) {
  const cells = useMemoS(() => buildHexes(width, height), [width, height]);
  return (
    <g>
      {cells.map(c => (
        <polygon
          key={c.id}
          className={"hex" + (litMap[c.id] ? " lit" : "")}
          points={c.points}
        />
      ))}
    </g>
  );
}

// ---------- 3D Post Stack ----------
function PostStack({ posts, runProgress, totalCount, scrapedCount }) {
  // Show up to 6 stack-cards. Each card is offset deeper into Z.
  const visible = posts.slice(0, 6);
  return (
    <div className="stack-col left">
      <div className="stack-label">// saved · queue</div>
      <div className="stack">
        {visible.map((p, i) => {
          const z = -i * 10;
          const y = i * 4;
          const x = i * -3;
          return (
            <div
              key={p._key || p.id + "-" + i}
              className="stack-card"
              style={{
                ["--h"]: p.h,
                transform: `translate3d(${x}px, ${y}px, ${z}px)`,
                opacity: 1 - i * 0.10,
                zIndex: 10 - i,
              }}
            >
              <div className="row">
                <div className="av" style={{ ["--h"]: p.h }}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.author}
                  </div>
                  <div style={{ fontSize: 9, fontFamily: "Geist Mono, monospace", color: "var(--fg-3)", letterSpacing: "0.05em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.role}
                  </div>
                </div>
              </div>
              <div className="lines">
                <i/><i/><i/><i/>
              </div>
              <div className="badge">post · {String(p.id).padStart(3, "0")}</div>
            </div>
          );
        })}
      </div>
      <div className="stack-counter">
        <div className="v">{String(Math.max(0, totalCount - scrapedCount)).padStart(2, "0")}</div>
        <div className="k">remaining</div>
      </div>
    </div>
  );
}

// ---------- Reel Deck (right) ----------
function ReelDeck({ reels }) {
  // Show up to 5 reels in a 3D stack
  const visible = reels.slice(0, 5);
  return (
    <div className="stack-col right">
      <div className="stack-label">// reels · output</div>
      <div className="stack">
        {visible.map((r, i) => {
          const z = -i * 10;
          const y = i * 5;
          const x = i * 3;
          const tx = `translate3d(${x}px, ${y}px, ${z}px)`;
          return (
            <div
              key={r.key}
              className={"reel-stack-card" + (r.fresh ? " fresh" : "")}
              style={{
                ["--h"]: r.h,
                ["--rb-tx"]: tx,
                transform: tx,
                opacity: 1 - i * 0.10,
                zIndex: 10 - i,
              }}
            >
              <div className="sprocket"><span/><span/><span/><span/><span/></div>
              <div className="title">{r.title}</div>
              <div className="meta">{r.dur}s · {r.sceneCount} scenes</div>
              <div className="play"><Ico.play width="10" height="10"/></div>
            </div>
          );
        })}
      </div>
      <div className="stack-counter">
        <div className="v">{String(reels.length).padStart(2, "0")}</div>
        <div className="k">ready</div>
      </div>
    </div>
  );
}

// ---------- Oscilloscope core ----------
function ScopeCore({ stage, progress, intensity, count, scraped, scripts, elapsedMs }) {
  const ref = useRefS(null);
  const ampRef = useRefS(0.15);   // current amplitude (lerped)
  const targetAmpRef = useRefS(0.15);

  // Spike target amplitude when intensity bumps (a comet entered)
  useEffectS(() => {
    targetAmpRef.current = Math.min(1.1, 0.18 + intensity * 0.3);
    const t = setTimeout(() => { targetAmpRef.current = 0.20; }, 280);
    return () => clearTimeout(t);
  }, [intensity]);

  useEffectS(() => {
    if (!ref.current) return;
    const path = ref.current;
    let raf;
    const W = 340, H = 220;
    const tick = (t) => {
      // lerp amplitude
      ampRef.current += (targetAmpRef.current - ampRef.current) * 0.18;
      const amp = ampRef.current;
      // Build a wave path
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
  }, []);

  const label = STAGE_LABELS[stage];

  return (
    <div className="core-zone">
      <div className="scope">
        <div className="gridlines"/>
        <svg viewBox="0 0 340 220" preserveAspectRatio="none">
          {/* base centerline */}
          <line x1="0" y1="110" x2="340" y2="110" stroke="oklch(0.88 0.19 128 / 0.18)" strokeDasharray="2 4"/>
          {/* live wave */}
          <path ref={ref} stroke="oklch(0.88 0.19 128)" strokeWidth="1.4" fill="none"
            style={{ filter: "drop-shadow(0 0 5px oklch(0.88 0.19 128 / 0.7))" }}/>
        </svg>
        <div className="scope-label"><span className="dot"/>SIGNAL · LIVE</div>
        <div className="scope-readout">
          <div>elapsed&nbsp;<span style={{ color: "var(--fg)" }}>{fmtElapsed(elapsedMs)}</span></div>
          <div>throughput&nbsp;<span style={{ color: "var(--fg)" }}>{((scraped / Math.max(1, elapsedMs / 1000))).toFixed(1)}</span>/s</div>
        </div>
        <div className="scope-stage">
          {label.big}
          <small>{label.sub}</small>
        </div>
        <div className="scope-progress"><i style={{ width: (progress * 100).toFixed(1) + "%" }}/></div>
      </div>
    </div>
  );
}

// ---------- CometCanvas — particles flying along paths ----------
// Path definitions (matching the SVG viewBox we'll set up: 0..W, 0..H)
function makeCometPath(W, H) {
  // From left stack center to scope-left, then scope-right to right stack center.
  // We use a single bezier path divided at midpoint conceptually.
  const startX = 100, startY = H / 2;
  const endX = W - 100, endY = H / 2;
  const midX = W / 2;
  // First curve passes slightly low, second slightly high
  return `M ${startX} ${startY} C ${startX + 100} ${startY - 80}, ${midX - 60} ${startY + 40}, ${midX} ${startY} S ${endX - 100} ${startY - 40}, ${endX} ${endY}`;
}

function CometCanvas({ comets, width, height, onPosition }) {
  const pathRef = useRefS(null);
  const lenRef = useRefS(0);
  const [tick, setTick] = useStateS(0);

  // Recompute path length when dims change
  useLayoutEffectS(() => {
    if (pathRef.current) lenRef.current = pathRef.current.getTotalLength();
  }, [width, height]);

  // Per-frame advance
  useEffectS(() => {
    let raf;
    const loop = () => {
      setTick(t => (t + 1) % 100000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Compute positions
  const positions = useMemoS(() => {
    if (!pathRef.current || !lenRef.current) return [];
    const out = [];
    for (const c of comets) {
      const tt = Math.max(0, Math.min(1, c.t));
      const pt = pathRef.current.getPointAtLength(tt * lenRef.current);
      const pt2 = pathRef.current.getPointAtLength(Math.min(1, tt + 0.005) * lenRef.current);
      const ang = Math.atan2(pt2.y - pt.y, pt2.x - pt.x) * 180 / Math.PI;
      out.push({ id: c.id, x: pt.x, y: pt.y, ang, label: c.label, t: tt });
    }
    return out;
  }, [comets, tick]);

  // Report comet positions upward for hex highlighting (effect, not during render)
  useEffectS(() => {
    if (onPosition && positions.length > 0) onPosition(positions);
  }, [positions, onPosition]);

  return (
    <>
      <svg className="pipe-svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <HexGridSlot width={width} height={height}/>
        <path ref={pathRef} className="lane" d={makeCometPath(width, height)}/>
        {comets.length > 0 && (
          <path className="lane hot" d={makeCometPath(width, height)}/>
        )}
      </svg>
      {positions.map(p => (
        <div
          key={p.id}
          className="comet"
          style={{
            transform: `translate(${p.x}px, ${p.y}px)`,
            opacity: p.t < 0.03 || p.t > 0.97 ? 0 : 1,
          }}
        >
          <div className="trail" style={{ transform: `rotate(${p.ang}deg)` }}/>
          <div className="core-dot"/>
          <div className="label">{p.label}</div>
        </div>
      ))}
    </>
  );
}

// Helper component to render HexGrid inside the same SVG.
// (It reads litMap from window so we don't have to thread props through CometCanvas.)
function HexGridSlot({ width, height }) {
  const [litMap, setLitMap] = useStateS({});
  useEffectS(() => {
    window.__setHexLit = (map) => setLitMap(map);
  }, []);
  return <HexGrid width={width} height={height} litMap={litMap}/>;
}

// Export to window
Object.assign(window, {
  PostStack, ReelDeck, ScopeCore, CometCanvas,
  buildHexes, findHexAt, HEX_R, HEX_DX, HEX_H,
});
