// v2-shared — sample data, icons, helpers, brand mark, dropdown, slot counter
const { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } = React;

// ---------- Sample data ----------
const SAMPLE_POSTS = [
  { id: 1,  initials: "MO", h: 200, author: "M. Okafor",    role: "Founder · Loomspace",     body: "We replaced our 12-page brief with a single Loom. Conversion on intake calls tripled overnight." },
  { id: 2,  initials: "SH", h: 320, author: "S. Hartwell",  role: "Head of Design · Brace",  body: "A short rant on why dashboards keep getting wider but never deeper. The fix is component density, not chart count." },
  { id: 3,  initials: "RI", h: 60,  author: "Dr. R. Iyer",  role: "Researcher · Atlas Labs", body: "After 14 months, our team killed Friday standups. Productivity didn't move. Joy did." },
  { id: 4,  initials: "KT", h: 140, author: "K. Tanaka",    role: "PM · Riverbend",          body: "If your roadmap fits on one page, your strategy fits in one sentence. Otherwise, you're decorating." },
  { id: 5,  initials: "LV", h: 30,  author: "L. Verma",     role: "Indie Hacker",            body: "I shipped 7 micro-products this year. The two that worked had one thing in common: they replaced a spreadsheet." },
  { id: 6,  initials: "JM", h: 260, author: "J. Mbeki",     role: "VP Eng · Kettle",         body: "We pay our on-call engineers double during fire weeks. It rewired our whole reliability culture." },
  { id: 7,  initials: "CD", h: 90,  author: "C. Dubois",    role: "Marketing · Vellum",      body: "Stop A/B testing CTA copy. Start A/B testing the page above it." },
  { id: 8,  initials: "AP", h: 240, author: "A. Petrov",    role: "Investor · North Arc",    body: "The strongest pitches I see now show what they killed — not what they're building." },
  { id: 9,  initials: "TA", h: 175, author: "T. Akinyi",    role: "CTO · Mariner",           body: "Our hottest internal tool is a 200-line Bash script. It's been quietly running for 9 years." },
  { id: 10, initials: "FL", h: 10,  author: "F. Lindqvist", role: "Coach",                   body: "Three questions that fix most retros: what got harder? what got quieter? what got lonelier?" },
  { id: 11, initials: "PN", h: 110, author: "P. Nair",      role: "Founder · Tildemark",     body: "Pricing is the most underrated growth lever. Most companies are leaving 30% on the table." },
  { id: 12, initials: "YC", h: 290, author: "Y. Cohen",     role: "Writer",                  body: "Documentation is a love letter to the engineer who's going to inherit your code in three years." },
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

const STAGE_LABELS = {
  idle:       { big: "STANDBY", sub: "agent ready · idle", short: "Idle · agent ready" },
  scraping:   { big: "SCRAPE",  sub: "playwright · /saved-posts", short: "Live · scraping saved posts" },
  parsing:    { big: "PARSE",   sub: "dedup · embed · rank", short: "Live · parsing content" },
  generating: { big: "REELIFY", sub: "drafting reel scripts", short: "Live · generating scripts" },
  done:       { big: "READY",   sub: "pipeline complete", short: "Run complete" },
};

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
  arrow: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6"/>
    </svg>
  ),
};

// ---------- Brand mark ----------
function BrandMark() {
  return (
    <span className="brand-mark">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M5 4l14 8L5 20z" fill="currentColor"/>
      </svg>
    </span>
  );
}

// ---------- useCounter (eased) ----------
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

// ---------- SlotCounter — rolling digit display ----------
function SlotCounter({ value, width = 3 }) {
  const str = String(Math.max(0, Math.round(value))).padStart(width, "0");
  return (
    <span style={{ display: "inline-flex", lineHeight: 1 }}>
      {str.split("").map((ch, i) => (
        <span className="digit" key={i}>
          <i style={{ transform: `translateY(-${parseInt(ch, 10) * 28}px)` }}>
            {"0\n1\n2\n3\n4\n5\n6\n7\n8\n9".split("\n").map((d, k) => (
              <span key={k} style={{ display: "block", height: 28 }}>{d}</span>
            ))}
          </i>
        </span>
      ))}
    </span>
  );
}

// ---------- Build script object ----------
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
  // Build a tiny scene script — keywords highlighted
  const kw = (post.body.match(/\b[A-Z][a-z]+\b/g) || []).slice(0, 2);
  return {
    id: post.id,
    title: post.author + " — " + post.role.split("·")[0].trim(),
    author: post.author,
    initials: post.initials,
    role: post.role.split("·")[0].trim(),
    hook: hook,
    h: post.h,
    dur,
    sceneCount,
    body: post.body,
    keywords: kw,
    tags: ["#" + tone.toLowerCase().replace(/[^a-z]/g, "")].concat(tagPool),
  };
}

// ---------- Build log lines for a run ----------
function makeTs() {
  const d = new Date();
  return d.toLocaleTimeString("en-GB", { hour12: false }) + "." + String(d.getMilliseconds()).padStart(3, "0").slice(0, 2);
}
function buildLog(postCount, tone) {
  return [
    { tag: "boot",    level: "info", msg: <>spawn chromium <em>v124.0 · headless</em></> },
    { tag: "auth",    level: "info", msg: <>restoring session cookie <em>li_at · *****</em></> },
    { tag: "nav",     level: "info", msg: <>goto <em>/my-items/saved-posts</em></> },
    { tag: "wait",    level: "info", msg: <>waitFor <em>[data-id=feed-list]</em> · 412ms</> },
    { tag: "scroll",  level: "info", msg: <>autoscroll to load <em>n={postCount}</em></> },
    { tag: "parse",   level: "ok",   msg: <>extracted <em>{postCount} posts</em> · dedup ok</> },
    { tag: "embed",   level: "info", msg: <>embedding hooks · model <em>e5-mistral</em></> },
    { tag: "rank",    level: "ok",   msg: <>ranked by virality · σ=0.71</> },
    { tag: "warm",    level: "info", msg: <>warming LLM · ctx=8192</> },
    { tag: "gen",     level: "info", msg: <>generating scripts · tone=<em>{tone.toLowerCase()}</em></> },
    { tag: "scene",   level: "info", msg: <>scene-graph · 5 acts per reel</> },
    { tag: "shot",    level: "ok",   msg: <>shotlist drafted · <em>cuts=1.4/s</em></> },
    { tag: "render",  level: "info", msg: <>tts pre-render · voice=<em>op-alta</em></> },
    { tag: "qa",      level: "ok",   msg: <>QA pass · 0 violations</> },
    { tag: "write",   level: "ok",   msg: <>wrote <em>{postCount} reel scripts</em> to /out</> },
    { tag: "done",    level: "ok",   msg: <>pipeline complete · idle</> },
  ].map(l => ({ ...l, t: makeTs() }));
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

// ---------- StageTrack ----------
function StageTrack({ stage }) {
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

// ---------- Format elapsed (ms → mm:ss) ----------
function fmtElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}

// Export to window so other Babel scripts can use them
Object.assign(window, {
  SAMPLE_POSTS, TONES, POST_COUNT_OPTIONS, STAGE_LABELS,
  Ico, BrandMark, useCounter, SlotCounter,
  buildScript, buildLog, makeTs,
  CountDropdown, StageTrack, fmtElapsed,
});
