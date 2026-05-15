// v2-app — Main app: state machine, layout, comet engine
const { useState: useStateA, useEffect: useEffectA, useRef: useRefA, useCallback: useCallbackA, useMemo: useMemoA, useLayoutEffect: useLayoutEffectA } = React;

// Pipeline body dimensions (logical canvas units; CSS handles actual size)
const PIPE_W = 820;
const PIPE_H = 540;

function App() {
  const [count, setCount] = useStateA(10);
  const [tone, setTone] = useStateA("Punchy");
  const [stage, setStage] = useStateA("idle");
  const [scripts, setScripts] = useStateA([]);
  const [reels, setReels] = useStateA([]); // visible in reel deck (top-5 trimmed)
  const [logLines, setLogLines] = useStateA([]);
  const [scrapedCount, setScrapedCount] = useStateA(0);
  const [posts, setPosts] = useStateA(SAMPLE_POSTS.slice(0, 6));
  const [comets, setComets] = useStateA([]); // {id, t, label, post, born}
  const [intensity, setIntensity] = useStateA(0); // bumps on each core-cross
  const [elapsed, setElapsed] = useStateA(0);
  const [glitch, setGlitch] = useStateA(0);
  const [activeScriptId, setActiveScriptId] = useStateA(null);

  const runStart = useRefA(0);
  const cancelRef = useRefA({ cancelled: false });
  const cometIdRef = useRefA(0);
  const litMapRef = useRefA({});
  const pipeBodyRef = useRefA(null);
  const [pipeSize, setPipeSize] = useStateA({ w: PIPE_W, h: PIPE_H });

  const running = stage !== "idle" && stage !== "done";

  // Measure pipe body for accurate comet positioning
  useLayoutEffectA(() => {
    const measure = () => {
      if (pipeBodyRef.current) {
        const r = pipeBodyRef.current.getBoundingClientRect();
        setPipeSize({ w: r.width, h: r.height });
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Elapsed timer
  useEffectA(() => {
    if (!running) return;
    runStart.current = performance.now();
    let raf;
    const tick = () => {
      setElapsed(performance.now() - runStart.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  // Comet advance — single rAF loop that moves all comets
  useEffectA(() => {
    let raf;
    let last = performance.now();
    const SPEED = 0.42; // 1 / seconds-to-traverse
    const tick = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      setComets(prev => {
        if (prev.length === 0) return prev;
        let bump = false;
        const next = [];
        for (const c of prev) {
          const t0 = c.t;
          const nt = t0 + dt * SPEED;
          if (nt >= 1) {
            // Comet completed: emit a reel arrival event via window callback (handled below)
            window.__onCometDone && window.__onCometDone(c);
            continue;
          }
          if (t0 < 0.5 && nt >= 0.5) bump = true;
          next.push({ ...c, t: nt });
        }
        if (bump) setIntensity(i => i + 1);
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Wire __onCometDone to materialize a reel + script
  useEffectA(() => {
    window.__onCometDone = (c) => {
      // build a new script
      const post = c.post;
      // we'll use scrapedCount as idx baseline; ok approximation
      const built = buildScript(post, tone, scripts.length);
      const reelKey = "r-" + c.id;
      setReels(prev => [{ ...built, key: reelKey, fresh: true }, ...prev].slice(0, 5));
      setScripts(prev => [{ ...built, _animIdx: prev.length }, ...prev].slice(0, 50));
      // remove fresh class after animation
      setTimeout(() => {
        setReels(prev => prev.map(r => r.key === reelKey ? { ...r, fresh: false } : r));
      }, 950);
    };
  }, [tone, scripts.length]);

  // Hex highlighting from comet positions — handled via window.__setHexLit
  const hexCells = useMemoA(() => buildHexes(pipeSize.w, pipeSize.h), [pipeSize.w, pipeSize.h]);
  const lastHexUpdate = useRefA(0);
  const onCometPositions = useCallbackA((positions) => {
    // Throttle
    const now = performance.now();
    if (now - lastHexUpdate.current < 50) return;
    lastHexUpdate.current = now;

    const map = { ...litMapRef.current };
    // Expire old
    for (const k of Object.keys(map)) if (map[k] < now) delete map[k];
    // Light up cells near each comet
    for (const p of positions) {
      const cell = findHexAt(hexCells, p.x, p.y);
      if (cell) map[cell.id] = now + 600; // expires in 600ms
    }
    litMapRef.current = map;
    if (window.__setHexLit) window.__setHexLit(map);
  }, [hexCells]);

  // ---- Run lifecycle ----
  const startRun = useCallbackA(() => {
    if (running) return;
    cancelRef.current = { cancelled: false };
    setScripts([]); setReels([]); setLogLines([]);
    setScrapedCount(0); setElapsed(0);
    setComets([]); setIntensity(0); setGlitch(0);
    runStart.current = performance.now();

    const list = [];
    for (let i = 0; i < count; i++) {
      const base = SAMPLE_POSTS[i % SAMPLE_POSTS.length];
      list.push({ ...base, id: i + 1, h: (base.h + i * 37) % 360 });
    }
    setPosts(list.slice(0, 6));

    const log = buildLog(count, tone);
    let li = 0;

    const pushLog = (delay) => new Promise(r => setTimeout(() => {
      if (cancelRef.current.cancelled) return r();
      if (li < log.length) {
        setLogLines(prev => [...prev, log[li]]);
        li++;
      }
      r();
    }, delay));

    const triggerGlitch = () => setGlitch(g => g + 1);

    const run = async () => {
      setStage("scraping");
      triggerGlitch();
      await pushLog(80);
      await pushLog(140);
      await pushLog(160);
      await pushLog(140);
      await pushLog(160);

      for (let pi = 0; pi < count; pi++) {
        if (cancelRef.current.cancelled) return;
        const post = list[pi];

        // Add a comet
        cometIdRef.current++;
        const id = cometIdRef.current;
        setComets(prev => [...prev, {
          id, t: 0, label: post.initials, post, born: performance.now(),
        }]);
        setScrapedCount(c => c + 1);

        // Recycle posts in the stack
        setPosts(prev => {
          const next = prev.slice(1);
          next.push({ ...list[(pi + 6) % count], _key: "stack-" + pi });
          return next;
        });

        const stageProgress = pi / count;
        if (pi === Math.floor(count * 0.30)) {
          setStage("parsing");
          triggerGlitch();
          await pushLog(80);
          await pushLog(160);
        }
        if (pi === Math.floor(count * 0.55)) {
          setStage("generating");
          triggerGlitch();
          await pushLog(100);
          await pushLog(140);
          await pushLog(160);
          await pushLog(140);
        }
        if (pi === Math.floor(count * 0.85)) {
          await pushLog(120);
        }

        // Pace between scraping events
        await new Promise(r => setTimeout(r, 220 + Math.random() * 140));
      }

      // Drain — wait until all comets land
      let waitCount = 0;
      while (true) {
        await new Promise(r => setTimeout(r, 250));
        const remaining = await new Promise(r => {
          setComets(prev => { r(prev.length); return prev; });
        });
        if (remaining === 0 || cancelRef.current.cancelled) break;
        if (++waitCount > 40) break;
      }

      await pushLog(140);
      await pushLog(160);
      setStage("done");
      triggerGlitch();
    };

    run();
  }, [count, tone, running]);

  const stop = useCallbackA(() => {
    cancelRef.current.cancelled = true;
    setStage("idle");
    setLogLines([]); setScripts([]); setReels([]);
    setComets([]); setScrapedCount(0); setElapsed(0);
    setActiveScriptId(null);
  }, []);

  // Display values
  const progress = stage === "done" ? 1 : Math.min(1, scrapedCount / count);
  const scrapedDisp = useCounter(scrapedCount, 500);
  const queuedDisp = useCounter(Math.max(0, count - scrapedCount), 500);
  const scriptsDisp = useCounter(scripts.length, 500);
  const avgDur = scripts.length
    ? Math.round(scripts.reduce((s, x) => s + x.dur, 0) / scripts.length)
    : 0;
  const avgDurDisp = useCounter(avgDur, 500);

  const currentLabel = STAGE_LABELS[stage];
  const previewScript = useMemoA(() => {
    if (activeScriptId != null) {
      return scripts.find(s => s.id === activeScriptId) || scripts[0];
    }
    return scripts[0] || null;
  }, [scripts, activeScriptId]);

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <BrandMark/>
          <div>
            <div className="brand-name">Reelify</div>
            <div className="brand-sub">saved · posts → reels</div>
          </div>
        </div>
        <div className="top-spacer"/>
        <span className="status-pill">
          <span className={"status-dot " + (running ? "live" : stage === "done" ? "done" : "")}/>
          {currentLabel.short}
          {(running || stage === "done") && (
            <>
              <span className="sep"/>
              <span className="timer">{fmtElapsed(elapsed)}</span>
            </>
          )}
        </span>
        <button className="icon-btn" title="Notifications"><Ico.bell width="16" height="16"/></button>
        <button className="icon-btn" title="Settings"><Ico.gear width="16" height="16"/></button>
      </header>

      <div className="grid">
        {/* LEFT */}
        <section className="panel">
          <div className="panel-title">
            <span><span className="num">A</span>Configure run</span>
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

          <button className="run-btn" onClick={running ? stop : startRun}>
            {running ? (<><span className="spin"/>Stop run</>) : (<><Ico.spark width="14" height="14"/>{stage === "done" ? "Run again" : "Run pipeline"}</>)}
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
              <span className="num" style={{ width: 18, height: 18, borderRadius: 4, background: "var(--bg-3)", color: "var(--fg-2)", display: "inline-grid", placeItems: "center", fontSize: 10, marginRight: 6 }}>B</span>
              Transform pipeline
            </div>
            <StageTrack stage={stage}/>
          </div>

          <div className="pipe-body" ref={pipeBodyRef}>
            <PostStack posts={posts} totalCount={count} scrapedCount={scrapedCount} runProgress={progress}/>
            <CometCanvas comets={comets} width={pipeSize.w} height={pipeSize.h} onPosition={onCometPositions}/>
            <ScopeCore stage={stage} progress={progress} intensity={intensity}
                       count={count} scraped={scrapedCount} scripts={scripts.length}
                       elapsedMs={elapsed}/>
            <ReelDeck reels={reels}/>
            <div className={"glitch-sweep" + (glitch > 0 ? " go" : "")} key={"g" + glitch}/>
          </div>

          <div className="pipe-stats">
            <div className="stat">
              <div className="k">Scraped</div>
              <div className="v">
                <SlotCounter value={scrapedDisp} width={3}/>
                <small>/ {String(count).padStart(3, "0")}</small>
              </div>
            </div>
            <div className="stat">
              <div className="k">In queue</div>
              <div className="v">
                <SlotCounter value={queuedDisp} width={3}/>
              </div>
            </div>
            <div className="stat">
              <div className="k">Scripts</div>
              <div className="v">
                <SlotCounter value={scriptsDisp} width={3}/>
              </div>
            </div>
            <div className="stat">
              <div className="k">Avg duration</div>
              <div className="v">
                <SlotCounter value={avgDurDisp} width={2}/>
                <small>s</small>
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT */}
        <div className="right-col">
          <PhonePreview script={previewScript}/>

          <section className="panel scripts-panel">
            <div className="panel-title">
              <span><span className="num">E</span>Reel scripts</span>
              <span className="mono" style={{ fontSize: 10, color: "var(--fg-3)" }}>{scripts.length} ready</span>
            </div>
            {scripts.length === 0 ? (
              <div className="empty-state">
                <div className="big">No scripts yet</div>
                Press <span style={{ color: "var(--accent)" }}>Run pipeline</span> to generate.
              </div>
            ) : (
              <div className="scripts-list">
                {scripts.map((s, i) => (
                  <ScriptCard
                    key={"sc-" + s.id + "-" + s._animIdx}
                    s={s}
                    idx={i}
                    active={previewScript && previewScript.id === s.id}
                    onClick={() => setActiveScriptId(s.id)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <Terminal logLines={logLines} running={running}/>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
