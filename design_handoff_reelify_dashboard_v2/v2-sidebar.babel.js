// v2-sidebar — Phone preview (kinetic auto-cycling scenes), ScriptCard, Terminal
const { useState: useStateB, useEffect: useEffectB, useRef: useRefB, useMemo: useMemoB } = React;

// ---------- Phone Preview ----------
// Auto-cycles through 4 "scenes" of the most recent script:
// 1. AUTHOR title card
// 2. HOOK with keyword box
// 3. PROOF / body excerpt
// 4. CTA "Follow for more"
function PhonePreview({ script }) {
  const [sceneIdx, setSceneIdx] = useStateB(0);
  const sceneCount = 4;
  const sceneDur = 1800;

  // Reset to scene 0 when script changes
  useEffectB(() => {
    setSceneIdx(0);
  }, [script && script.id]);

  // Auto-advance scenes
  useEffectB(() => {
    if (!script) return;
    const t = setInterval(() => {
      setSceneIdx(i => (i + 1) % sceneCount);
    }, sceneDur);
    return () => clearInterval(t);
  }, [script && script.id]);

  if (!script) {
    return (
      <section className="panel phone-panel">
        <div className="phone-head">
          <span><span className="num">D</span>Reel preview</span>
          <span style={{ color: "var(--fg-3)" }}>idle</span>
        </div>
        <div className="phone-stage">
          <div className="phone-empty">
            <div className="big">No reel ready</div>
            Generated reels will auto-preview here, with kinetic scenes for hook, proof, and CTA.
          </div>
        </div>
      </section>
    );
  }

  // Build particle floats inside the phone (decorative)
  const phoneParticles = Array.from({ length: 7 }).map((_, i) => ({
    x: 10 + (i * 21) % 150,
    delay: (i * 0.31).toFixed(2),
    dx: ((i % 2) ? 1 : -1) * (5 + i * 3),
  }));

  return (
    <section className="panel phone-panel">
      <div className="phone-head">
        <span><span className="num">D</span>Reel preview · auto-play</span>
        <span className="mono" style={{ color: "var(--accent)" }}>
          {String(sceneIdx + 1).padStart(2, "0")} / {String(sceneCount).padStart(2, "0")}
        </span>
      </div>
      <div className="phone-stage" style={{ ["--ph"]: script.h }}>
        <div className="phone">
          <div className="phone-screen" style={{ ["--ph"]: script.h }}>
            <div className="phone-notch"/>
            <div className="phone-particles">
              {phoneParticles.map((p, i) => (
                <span key={i} style={{
                  left: p.x + "px",
                  bottom: "30px",
                  ["--x"]: p.dx + "px",
                  animationDelay: p.delay + "s",
                }}/>
              ))}
            </div>
            <PhoneScene script={script} sceneIdx={sceneIdx}/>
            <div className="phone-scenes">
              {Array.from({ length: sceneCount }).map((_, i) => (
                <i key={i + "-" + sceneIdx} className={i < sceneIdx ? "done" : i === sceneIdx ? "now" : ""} style={{ ["--scene-dur"]: sceneDur + "ms" }}>
                  {i === sceneIdx && <b/>}
                </i>
              ))}
            </div>
          </div>
        </div>

        <div className="phone-meta">
          <div className="phone-meta-row">
            <div className="k">// next up</div>
            <div className="v">{script.title}</div>
          </div>
          <div className="phone-meta-row">
            <div className="k">// duration · scenes</div>
            <div className="v" style={{ fontFamily: "Geist Mono, monospace", fontWeight: 600 }}>
              {script.dur}s · {script.sceneCount} cuts
            </div>
          </div>
          <div className="phone-meta-row">
            <div className="k">// tags</div>
            <div className="phone-tags">
              {script.tags.slice(0, 4).map(t => <span key={t}>{t}</span>)}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PhoneScene({ script, sceneIdx }) {
  // Hard-coded scene compositions per index. Keyed by sceneIdx so animations restart.
  return (
    <div className="phone-ui" key={sceneIdx}>
      {sceneIdx === 0 && (
        <>
          <div className="phone-author">{script.author}</div>
          <div style={{ marginTop: 4, fontSize: 10, fontFamily: "Geist Mono, monospace", color: "oklch(1 0 0 / 0.6)" }}>
            {script.role}
          </div>
          <div style={{ marginTop: "auto", marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontFamily: "Geist Mono, monospace", letterSpacing: "0.16em", textTransform: "uppercase", color: "oklch(1 0 0 / 0.6)" }}>
              reel · {String(script.id).padStart(3, "0")}
            </div>
            <div style={{ fontWeight: 800, fontSize: 28, lineHeight: 1.05, letterSpacing: "-0.02em", marginTop: 4 }}>
              <KineticReveal text="A short take." />
            </div>
          </div>
        </>
      )}
      {sceneIdx === 1 && (
        <>
          <div className="phone-author">/ the hook</div>
          <div className="phone-hook" style={{ marginTop: 16 }}>
            <KineticHook hook={script.hook} kws={script.keywords}/>
          </div>
          <div style={{ marginTop: "auto" }}/>
        </>
      )}
      {sceneIdx === 2 && (
        <>
          <div className="phone-author">/ proof</div>
          <div style={{ marginTop: 16, fontWeight: 600, fontSize: 15, lineHeight: 1.3 }}>
            <KineticReveal text={script.body} stagger={28}/>
          </div>
        </>
      )}
      {sceneIdx === 3 && (
        <>
          <div className="phone-author">/ next</div>
          <div style={{ marginTop: "auto", marginBottom: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 26, lineHeight: 1.05, letterSpacing: "-0.02em" }}>
              <KineticReveal text="Save this · share it · steal it." />
            </div>
            <div className="phone-cta" style={{ marginTop: 14 }}>
              <i/> by reelify.agent
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Kinetic typography: reveal text word-by-word with a slight rise
function KineticReveal({ text, stagger = 60 }) {
  const words = text.split(/\s+/);
  return (
    <span style={{ display: "inline-block" }}>
      {words.map((w, i) => (
        <span key={i} style={{
          display: "inline-block",
          marginRight: "0.25em",
          opacity: 0,
          transform: "translateY(6px)",
          animation: `kineticUp 0.45s cubic-bezier(.4,0,.2,1) ${i * stagger}ms forwards`,
        }}>
          {w}
        </span>
      ))}
      <style>{`@keyframes kineticUp { to { opacity: 1; transform: translateY(0); } }`}</style>
    </span>
  );
}

// Hook scene: highlight first appearance of each keyword inside a "k-box"
function KineticHook({ hook, kws }) {
  const text = hook.replace(/^"|"$/g, "").trim();
  const words = text.split(/\s+/);
  const seen = new Set();
  return (
    <span>
      {words.map((w, i) => {
        const norm = w.replace(/[^a-zA-Z]/g, "");
        const isKw = kws && kws.some(k => k.toLowerCase() === norm.toLowerCase()) && !seen.has(norm.toLowerCase());
        if (isKw) seen.add(norm.toLowerCase());
        return (
          <span key={i} style={{
            display: "inline-block",
            marginRight: "0.25em",
            opacity: 0,
            transform: "translateY(8px)",
            animation: `kineticUp2 0.5s cubic-bezier(.4,0,.2,1) ${i * 70}ms forwards`,
          }}>
            {isKw ? <span className="kbox">{w}</span> : w}
          </span>
        );
      })}
      <style>{`@keyframes kineticUp2 { to { opacity: 1; transform: translateY(0); } }`}</style>
    </span>
  );
}

// ---------- Script card ----------
function ScriptCard({ s, idx, active, onClick }) {
  return (
    <div className={"script-card" + (active ? " active" : "")}
         style={{ animationDelay: Math.min(idx, 6) * 30 + "ms" }}
         onClick={onClick}>
      <span className="idx">{String(idx + 1).padStart(2, "0")}</span>
      <div className="body">
        <div className="title">{s.title}</div>
        <div className="row">
          <span className="dur">{s.dur}s</span>
          <span>· {s.sceneCount} scenes</span>
          <span className="scenes-mini">
            {Array.from({ length: s.sceneCount }).map((_, k) => <i key={k}/>)}
          </span>
        </div>
      </div>
      <span className="open" title="Open">
        <Ico.arrow width="12" height="12"/>
      </span>
    </div>
  );
}

// ---------- Terminal ----------
function Terminal({ logLines, running }) {
  const ref = useRefB(null);
  useEffectB(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [logLines.length]);

  return (
    <section className="panel terminal term-strip">
      <div className="terminal-head">
        <span className="term-dots"><i/><i/><i/></span>
        playwright · agent.log
        <span style={{ marginLeft: 12, color: "var(--fg-3)" }}>· stream</span>
        <span style={{ marginLeft: "auto", color: "var(--fg-3)" }}>{logLines.length} lines</span>
      </div>
      <div className="terminal-body" ref={ref}>
        {logLines.length === 0 && (
          <div style={{ color: "var(--fg-3)" }}>$ reelify --watch <span className="cursor"/></div>
        )}
        {logLines.map((l, i) => (
          <div className={"log-line " + l.level} key={i}>
            <span className="t">{l.t}</span>
            <span className="tag">[{l.tag}]</span>
            <span className="msg">{l.msg}</span>
          </div>
        ))}
        {running && <div style={{ color: "var(--fg-3)" }}>$ <span className="cursor"/></div>}
      </div>
    </section>
  );
}

// Export
Object.assign(window, { PhonePreview, ScriptCard, Terminal });
