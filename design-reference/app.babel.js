// Reelify Dashboard — animated pipeline that scrapes saved posts → reel scripts.
const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ---------- Icons ----------
const Ico = {
  bookmark: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  play: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="currentColor"><path d="M8 5l11 7-11 7z"/></svg>
  ),
  chev: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
  ),
  spark: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>
      <circle cx="12" cy="12" r="3.5"/>
    </svg>
  ),
  gear: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>
    </svg>
  ),
  bell: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
    </svg>
  ),
};

// ---------- Sample data ----------
const SAMPLE_POSTS = [
  { id: 1, h: 200, author: "M. Okafor",    role: "Founder · Loomspace",     body: "We replaced our 12-page brief with a single Loom. Conversion on intake calls tripled overnight." },
  { id: 2, h: 320, author: "S. Hartwell",  role: "Head of Design · Brace",  body: "A short rant on why dashboards keep getting wider but never deeper. The fix is component density, not chart count." },
  { id: 3, h: 60,  author: "Dr. R. Iyer",  role: "Researcher · Atlas Labs", body: "After 14 months, our team killed Friday standups. Productivity didn't move. Joy did." },
  { id: 4, h: 140, author: "K. Tanaka",    role: "PM · Riverbend",          body: "If your roadmap fits on one page, your strategy fits in one sentence. Otherwise, you're decorating." },
  { id: 5, h: 30,  author: "L. Verma",     role: "Indie Hacker",            body: "I shipped 7 micro-products this year. The two that worked had one thing in common: they replaced a spreadsheet." },
  { id: 6, h: 260, author: "J. Mbeki",     role: "VP Eng · Kettle",         body: "We pay our on-call engineers double during fire weeks. It rewired our whole reliability culture." },
  { id: 7, h: 90,  author: "C. Dubois",    role: "Marketing · Vellum",      body: "Stop A/B testing CTA copy. Start A/B testing the page above it." },
  { id: 8, h: 240, author: "A. Petrov",    role: "Investor · North Arc",    body: "The strongest pitches I see now show what they killed — not what they're building." },
  { id: 9, h: 175, author: "T. Akinyi",    role: "CTO · Mariner",           body: "Our hottest internal tool is a 200-line Bash script. It's been quietly running for 9 years." },
  { id: 10,h: 10,  author: "F. Lindqvist", role: "Coach",                   body: "Three questions that fix most retros: what got harder? what got quieter? what got lonelier?" },
  { id: 11,h: 110, author: "P. Nair",      role: "Founder · Tildemark",     body: "Pricing is the most underrated growth lever. Most companies are leaving 30% on the table." },
  { id: 12,h: 290, author: "Y. Cohen",     role: "Writer",                  body: "Documentation is a love letter to the engineer who's going to inherit your code in three years." },
];

const TONES = ["Punchy", "Story-led", "Analytical", "Educational"];
const POST_COUNT_OPTIONS = [
  { n: 5,  est: "~45s · 1 min" },
  { n: 10, est: "~1m 30s · 2 min" },
  { n: 15, est: "~2m · 3 min" },
  { n: 25, est: "~3m · 5 min" },
  { n: 50, est: "~6m · 10 min" },
  { n: 100,est: "~12m · 20 min" },
];

// ---------- Logo glyph ----------
function BrandMark() {
  return (
    <span className="brand-mark">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 4l14 8L5 20z" fill="currentColor"/>
      </svg>
    </span>
  );
}

// ---------- Custom Dropdown ----------
function CountDropdown({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const cur = POST_COUNT_OPTIONS.find(o => o.n === value) || POST_COUNT_OPTIONS[1];
  return (
    <div className={"dd " + (open ? "open" : "")} ref={ref}>
      <button
        className="dd-trigger"
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        aria-haspopup="listbox" aria-expanded={open}
      >
        <span className="dd-value">
          <span className="v">{cur.n}</span>
          <span className="u">posts · {cur.est}</span>
        </span>
        <Ico.chev className="chev" width="14" height="14"/>
      </button>
      <div className="dd-menu" role="listbox">
        {POST_COUNT_OPTIONS.map(opt => (
          <div
            key={opt.n}
            role="option"
            aria-selected={opt.n === value}
            className={"dd-opt " + (opt.n === value ? "sel" : "")}
            onClick={() => { onChange(opt.n); setOpen(false); }}
          >
            <span>{String(opt.n).padStart(3, " ")} posts</span>
            <span className="est">{opt.est}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Pipeline connector svg ----------
function Connector({ active }) {
  // 5 curved paths arcing from left edge into a center point and back out.
  // We render them with both a base + a 'live' overlay that pulses when active.
  const paths = useMemo(() => {
    const list = [];
    for (let i = 0; i < 5; i++) {
      const y = 60 + i * 80;
      // left to center
      list.push(`M -20 ${y} C 100 ${y}, 140 230, 260 230`);
      // center to right
      list.push(`M 260 230 C 380 230, 420 ${y}, 540 ${y}`);
    }
    return list;
  }, []);
  return (
    <svg className="connector" viewBox="0 0 520 460" preserveAspectRatio="none">
      {paths.map((d, i) => (
        <path key={"b" + i} d={d} />
      ))}
      {active && paths.map((d, i) => (
        <path key={"l" + i} d={d} className="live" style={{ animationDelay: (i * 0.08) + "s" }} />
      ))}
    </svg>
  );
}

// ---------- Orbiting Particles ----------
function Particles({ count = 8, running }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const svg = ref.current;
    const NS = "http://www.w3.org/2000/svg";
    // clear
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const nodes = [];
    for (let i = 0; i < count; i++) {
      const c = document.createElementNS(NS, "circle");
      c.setAttribute("r", String(1.6 + Math.random() * 1.6));
      c.setAttribute("class", "particle");
      svg.appendChild(c);
      nodes.push({ el: c, phase: Math.random() * Math.PI * 2, radius: 50 + Math.random() * 50, speed: 0.4 + Math.random() * 0.6 });
    }
    let raf, t0 = performance.now();
    const tick = (t) => {
      const dt = (t - t0) / 1000;
      const cx = 120, cy = 120;
      nodes.forEach((n, i) => {
        const a = n.phase + dt * n.speed * (running ? 1.2 : 0.25);
        const r = n.radius + Math.sin(dt * 0.8 + i) * 4;
        n.el.setAttribute("cx", String(cx + Math.cos(a) * r));
        n.el.setAttribute("cy", String(cy + Math.sin(a) * r * 0.95));
        n.el.setAttribute("opacity", String(running ? 0.85 : 0.35));
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [count, running]);
  return <svg ref={ref} width="240" height="240" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}/>;
}

// ---------- Stage indicator ----------
function StageTrack({ stage }) {
  // stage: idle, scraping, generating, done
  const items = [
    { k: "scrape", label: "01 · Scrape" },
    { k: "parse",  label: "02 · Parse"  },
    { k: "gen",    label: "03 · Generate" },
    { k: "ready",  label: "04 · Ready" },
  ];
  const stageIdx = { idle: -1, scraping: 0, parsing: 1, generating: 2, done: 3 }[stage] ?? -1;
  return (
    <div className="stage-track">
      {items.map((it, i) => (
        <React.Fragment key={it.k}>
          <span className={"stage-dot " + (i === stageIdx ? "active" : i < stageIdx ? "done" : "")}>
            <i/> {it.label}
          </span>
          {i < items.length - 1 && <span className="stage-sep"/>}
        </React.Fragment>
      ))}
    </div>
  );
}

// ---------- Animated counter ----------
function useCounter(target, durMs = 600) {
  const [val, setVal] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const initial = from.current;
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / durMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(initial + (target - initial) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durMs]);
  return val;
}

// ---------- Hook generators (deterministic-ish per post) ----------
function buildScript(post, tone, idx) {
  const baseHook = post.body.split(/[.!?]/)[0].trim();
  const hook = baseHook.length > 90 ? baseHook.slice(0, 88) + "…" : baseHook;
  const sceneCount = 4 + (idx % 3);
  const dur = 18 + ((post.id * 7) % 28);
  const tagPool = {
    Punchy: ["#hook", "#shortform", "#snap"],
    "Story-led": ["#story", "#arc", "#voiceover"],
    Analytical: ["#data", "#insight", "#proof"],
    Educational: ["#teach", "#breakdown", "#tutorial"],
  }[tone] || ["#reel"];
  return {
    id: post.id,
    title: post.author + " — " + post.role.split("·")[0].trim(),
    hook: '"' + hook + '"',
    dur,
    sceneCount,
    tags: ["#" + tone.toLowerCase().replace(/[^a-z]/g, "")].concat(tagPool),
  };
}

// ---------- Terminal lines for a run ----------
function buildLog(postCount, tone) {
  const ts = () => {
    const d = new Date();
    return d.toLocaleTimeString("en-GB", { hour12: false }) + "." + String(d.getMilliseconds()).padStart(3, "0").slice(0,2);
  };
  return [
    { tag: "boot",   level: "info", msg: <>spawn chromium <em>v124.0 · headless</em></> },
    { tag: "auth",   level: "info", msg: <>restoring session cookie <em>li_at · *****</em></> },
    { tag: "nav",    level: "info", msg: <>goto <em>/my-items/saved-posts</em></> },
    { tag: "wait",   level: "info", msg: <>waitFor <em>[data-id=feed-list]</em> · 412ms</> },
    { tag: "scroll", level: "info", msg: <>autoscroll to load <em>n={postCount}</em></> },
    { tag: "parse",  level: "ok",   msg: <>extracted <em>{postCount} posts</em> · dedup ok</> },
    { tag: "embed",  level: "info", msg: <>embedding hooks · model <em>e5-mistral</em></> },
    { tag: "rank",   level: "ok",   msg: <>ranked by virality · σ=0.71</> },
    { tag: "gen",    level: "info", msg: <>generating scripts · tone=<em>{tone.toLowerCase()}</em></> },
    { tag: "write",  level: "ok",   msg: <>wrote <em>{postCount} reel scripts</em> to /out</> },
    { tag: "done",   level: "ok",   msg: <>pipeline complete · idle</> },
  ].map(l => ({ ...l, t: ts() }));
}

// ---------- Main App ----------
function App() {
  const [count, setCount] = useState(10);
  const [tone, setTone] = useState("Punchy");
  const [stage, setStage] = useState("idle"); // idle | scraping | parsing | generating | done
  const [posts, setPosts] = useState([]); // staged posts shown left
  const [flying, setFlying] = useState(new Set()); // post ids that animated away
  const [scripts, setScripts] = useState([]);
  const [logLines, setLogLines] = useState([]);
  const [scrapedCount, setScrapedCount] = useState(0);
  const [errors, setErrors] = useState(0);
  const termRef = useRef(null);

  const running = stage !== "idle" && stage !== "done";

  // Always show preview of staged posts on idle
  useEffect(() => {
    if (stage === "idle") {
      setPosts(SAMPLE_POSTS.slice(0, 4));
      setFlying(new Set());
    }
  }, [stage]);

  // Auto-scroll terminal
  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [logLines]);

  const startRun = useCallback(() => {
    if (running) return;
    setScripts([]);
    setLogLines([]);
    setScrapedCount(0);
    setErrors(0);
    setFlying(new Set());

    // Build deterministic post list of length `count`
    const list = [];
    for (let i = 0; i < count; i++) list.push({ ...SAMPLE_POSTS[i % SAMPLE_POSTS.length], id: i + 1, h: (SAMPLE_POSTS[i % SAMPLE_POSTS.length].h + i * 37) % 360 });
    setPosts(list.slice(0, 4));

    const log = buildLog(count, tone);
    let li = 0;
    let pi = 0;
    let cancelled = false;

    const pushLog = (delay) => new Promise(r => setTimeout(() => {
      if (cancelled) return r();
      if (li < log.length) {
        setLogLines(prev => [...prev, log[li]]);
        li++;
      }
      r();
    }, delay));

    const run = async () => {
      setStage("scraping");
      await pushLog(120);
      await pushLog(220);
      await pushLog(280);
      await pushLog(180);
      await pushLog(220);

      // Animate posts arriving (scraping). Show up to 4 visible at a time, fly them through.
      for (pi = 0; pi < count; pi++) {
        if (cancelled) return;
        const post = list[pi];
        // fly the oldest in `posts` away
        setFlying(prev => new Set(prev).add("fly-" + pi));
        setScrapedCount(c => c + 1);
        // small delay then add a new staged card from below
        await new Promise(r => setTimeout(r, 90 + Math.random() * 70));
        setPosts(prev => {
          const next = prev.slice();
          // mark first as flown
          if (next.length >= 4) next.shift();
          next.push({ ...post, _key: "p-" + pi });
          return next;
        });
        // when about a third of the way done, advance the log
        if (pi === Math.floor(count * 0.4)) {
          setStage("parsing");
          await pushLog(120);
        }
        if (pi === Math.floor(count * 0.7)) {
          setStage("generating");
          await pushLog(160);
          await pushLog(120);
          await pushLog(200);
        }
        // emit scripts as we go (after parse)
        if (pi >= Math.floor(count * 0.5)) {
          const scriptIdx = pi - Math.floor(count * 0.5);
          const built = buildScript(post, tone, scriptIdx);
          setScripts(prev => [{ ...built, _animIdx: prev.length }, ...prev].slice(0, 30));
        }
      }
      setStage("generating");
      await pushLog(220);
      // tail
      await pushLog(160);
      setStage("done");
    };

    run();
    return () => { cancelled = true; };
  }, [count, tone, running]);

  const stop = useCallback(() => {
    setStage("idle");
    setLogLines([]);
    setScripts([]);
    setScrapedCount(0);
  }, []);

  const scrapeDisplay = useCounter(scrapedCount);
  const scriptsDisplay = useCounter(scripts.length);
  const queuedDisplay = useCounter(Math.max(0, count - scrapedCount));
  const avgDur = scripts.length
    ? Math.round(scripts.reduce((s, x) => s + x.dur, 0) / scripts.length)
    : 0;
  const avgDurDisp = useCounter(avgDur);

  return (
    <div className="app">
      {/* HEADER */}
      <header className="top">
        <div className="brand">
          <BrandMark />
          <div>
            <div className="brand-name">Reelify</div>
            <div className="brand-sub">saved · posts → reels</div>
          </div>
        </div>
        <div className="top-spacer"/>
        <span className="status-pill">
          <span className={"status-dot " + (running ? "live" : stage === "done" ? "" : "")}/>
          {stage === "idle" && "Idle · agent ready"}
          {stage === "scraping" && "Live · scraping saved posts"}
          {stage === "parsing" && "Live · parsing content"}
          {stage === "generating" && "Live · generating scripts"}
          {stage === "done" && "Run complete · " + scripts.length + " scripts ready"}
        </span>
        <button className="icon-btn" title="Notifications"><Ico.bell width="16" height="16"/></button>
        <button className="icon-btn" title="Settings"><Ico.gear width="16" height="16"/></button>
      </header>

      <div className="grid">
        {/* LEFT — CONFIG */}
        <section className="panel">
          <div className="panel-title">
            <span><span className="num">A</span> &nbsp;Configure run</span>
          </div>

          <div className="config-row">
            <div className="config-label">// source</div>
            <div className="config-source">
              <span className="source-ico"><Ico.bookmark width="16" height="16"/></span>
              <div style={{ flex: 1 }}>
                <div className="source-name">Saved posts</div>
                <div className="source-meta">@you · session ok</div>
              </div>
              <span className="status-dot live" style={{ width: 8, height: 8 }}/>
            </div>
          </div>

          <div className="config-row">
            <div className="config-label">// number of posts</div>
            <CountDropdown value={count} onChange={setCount} disabled={running}/>
          </div>

          <div className="config-row">
            <div className="config-label">// reel tone</div>
            <div className="tone-grid">
              {TONES.map(t => (
                <button
                  key={t}
                  className={"tone-chip " + (tone === t ? "sel" : "")}
                  onClick={() => !running && setTone(t)}
                  disabled={running}
                >{t}</button>
              ))}
            </div>
          </div>

          <button
            className="run-btn"
            onClick={running ? stop : startRun}
          >
            {running ? (
              <><span className="spin"/> Stop run</>
            ) : (
              <><Ico.spark width="14" height="14"/> {stage === "done" ? "Run again" : "Run pipeline"}</>
            )}
          </button>

          <div className="quota">
            <div className="quota-cell">
              <div className="k">Credits</div>
              <div className="v">214</div>
              <div className="quota-bar"><i style={{ width: "62%" }}/></div>
            </div>
            <div className="quota-cell">
              <div className="k">Storage</div>
              <div className="v">1.4<small>gb</small></div>
              <div className="quota-bar"><i style={{ width: "28%" }}/></div>
            </div>
          </div>
        </section>

        {/* CENTER — PIPELINE */}
        <section className="panel pipe">
          <div className="pipe-head">
            <div className="pipe-title">
              <span className="num" style={{ width: 18, height: 18, borderRadius: 4, background: "var(--bg-3)", color: "var(--fg-2)", display: "grid", placeItems: "center", fontSize: 10 }}>B</span>
              &nbsp;Transform pipeline
            </div>
            <StageTrack stage={stage}/>
          </div>

          <div className="pipe-body">
            {/* connector + particles */}
            <Connector active={running}/>

            <div className="pipe-col left">
              <div className="col-label">// scraped posts</div>
              {posts.map((p, i) => (
                <div
                  key={p._key || p.id}
                  className={"post-card " + (i === 0 && running ? "flying" : "") + (i > 1 ? " staged" : "")}
                  style={{ ["--h"]: p.h }}
                >
                  <div className="av" style={{ ["--h"]: p.h }}/>
                  <div style={{ minWidth: 0 }}>
                    <div className="meta">{p.author} · <span style={{ color: "var(--fg-2)" }}>{p.role}</span></div>
                    <div className="body">{p.body.length > 84 ? p.body.slice(0, 82) + "…" : p.body}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="core-wrap">
              <div className="core">
                <div className="ring spin1"><span className="tick"/><span className="tick t2"/><span className="tick t3"/><span className="tick t4"/></div>
                <div className="ring r1 spin2"></div>
                <div className="ring r2 spin3"></div>
                <div className="ring r3"></div>
                <Particles count={9} running={running}/>
                <div className="core-center">
                  <div className="core-bulb">
                    <div className="glyph">
                      <b>{stage === "done" ? "✓" : running ? "↯" : "—"}</b>
                      {stage === "idle"      && "STANDBY"}
                      {stage === "scraping"  && "SCRAPING"}
                      {stage === "parsing"   && "PARSING"}
                      {stage === "generating"&& "REELIFY"}
                      {stage === "done"      && "READY"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pipe-col right">
              <div className="col-label">// generated reels</div>
              {scripts.slice(0, 4).map((s, i) => (
                <div
                  key={"r" + s.id + "-" + s._animIdx}
                  className={"reel-card in"}
                  style={{ ["--h"]: 110 + i * 25, transitionDelay: (i * 50) + "ms" }}
                >
                  <div className="reel-thumb" style={{ ["--h"]: 110 + i * 25 }}>
                    <span className="play"><Ico.play width="14" height="14"/></span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="reel-title">{s.title}</div>
                    <div className="reel-meta">
                      <span><b>{s.dur}s</b></span>
                      <span>{s.sceneCount} scenes</span>
                    </div>
                  </div>
                </div>
              ))}
              {scripts.length === 0 && (
                <div style={{ width: "100%", maxWidth: 220, textAlign: "right", fontFamily: "Geist Mono, monospace", fontSize: 11, color: "var(--fg-3)" }}>
                  awaiting first<br/>output…
                </div>
              )}
            </div>
          </div>

          {/* stats strip */}
          <div className="pipe-stats">
            <div className="stat">
              <div className="k">Scraped</div>
              <div className="v">{Math.round(scrapeDisplay)} <small>/ {count}</small></div>
            </div>
            <div className="stat">
              <div className="k">In queue</div>
              <div className="v">{Math.round(queuedDisplay)}</div>
            </div>
            <div className="stat">
              <div className="k">Scripts</div>
              <div className="v">{Math.round(scriptsDisplay)} <span className="delta">{running && scripts.length > 0 ? "+" + Math.min(3, scripts.length) : ""}</span></div>
            </div>
            <div className="stat">
              <div className="k">Avg duration</div>
              <div className="v">{Math.round(avgDurDisp)}<small>s</small></div>
            </div>
          </div>
        </section>

        {/* RIGHT — RESULTS + TERMINAL */}
        <section className="right-col">
          <div className="panel results">
            <div className="panel-title">
              <span><span className="num">C</span> &nbsp;Reel scripts</span>
              <span className="mono" style={{ fontSize: 10, color: "var(--fg-3)" }}>{scripts.length} ready</span>
            </div>
            {scripts.length === 0 ? (
              <div className="empty-state">
                <div className="big">No scripts yet</div>
                Press <span style={{ color: "var(--accent)" }}>Run pipeline</span> to generate from saved posts.
              </div>
            ) : (
              <div className="results-list">
                {scripts.map((s, i) => (
                  <div className="script-card" key={"sc-" + s.id + "-" + s._animIdx} style={{ animationDelay: Math.min(i, 5) * 40 + "ms" }}>
                    <div className="row1">
                      <span className="idx">{String(i + 1).padStart(2, "0")}</span>
                      <span className="title">{s.title}</span>
                      <span className="dur">{s.dur}s</span>
                    </div>
                    <div className="hook">{s.hook}</div>
                    <div className="scenes">
                      {Array.from({ length: s.sceneCount }).map((_, k) => (
                        <span className={"scene-bar " + (k === 0 ? "hl" : "")} key={k}><i style={{ width: (60 + (k * 13 % 40)) + "%" }}/></span>
                      ))}
                    </div>
                    <div className="tags">
                      {s.tags.map(t => <span className="tag" key={t}>{t}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="panel terminal">
            <div className="terminal-head">
              <span className="term-dots"><i/><i/><i/></span>
              playwright · agent.log
              <span style={{ marginLeft: "auto", color: "var(--fg-3)" }}>{logLines.length} lines</span>
            </div>
            <div className="terminal-body" ref={termRef}>
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
          </div>
        </section>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
