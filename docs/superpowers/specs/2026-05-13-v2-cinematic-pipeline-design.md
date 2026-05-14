# Reelify Dashboard v2 — Cinematic Pipeline (Design Spec)

**Date:** 2026-05-13
**Source:** `design_handoff_reelify_dashboard_v2/README.md` (v2 handoff) — applied as a diff on top of the existing v1 React/TypeScript implementation in `frontend/`.

## Goal

Apply the full v2 cinematic-pipeline redesign to the existing React/TypeScript/CSS-Modules frontend in a single cutover. Behaviour stays consumer-driven: the live SSE event stream from the Python backend still feeds the UI; only presentation, motion, and the script-arrival gating change.

## Non-goals

- **No backend changes.** No new event types, no new fields. The contract documented in `events.py` / `orchestrator.py` is untouched.
- **No new dependencies.** Stay on React 18, the existing `useReducer` store, and CSS Modules. No framer-motion, no Tailwind, no Zustand.
- **No responsive design below 1240px beyond what's already there.** The v2 README only specifies "collapse to single column below 1240px"; the v1 in-flight responsive polish at 900/600 px (header sizing, panel padding, gap tweaks — the unstaged changes currently in `git status`) is preserved as it's orthogonal to the v2 visual changes.
- **No error-state design.** The v1 README leaves errors undesigned; v2 does too. Out of scope.
- **No new log tags emitted from the backend.** The v2 README lists `[warm]`, `[scene]`, `[shot]`, `[render]`, `[qa]` as additions, but these come from the prototype's simulated `buildLog`. They are not synthesised client-side. They get coloured if/when the backend ever emits them; current behaviour for the existing tag set is preserved.

---

## Stack decisions

- **React 18 + TypeScript** (unchanged).
- **CSS Modules** for component styles. Global tokens stay in `frontend/src/styles/tokens.css`. New tokens are added there.
- **State**: extend the existing `useReducer` store in `frontend/src/state/store.tsx`. No state library introduced.
- **Animation**: native rAF + CSS keyframes / transitions. No animation library.
- **SVG hex grid + comet path**: hand-authored SVG, no library.

---

## Data flow — the script-deferral linchpin

The v2 README's key insight is that "scrape" and "script arrival" should feel temporally separated. In the prototype this is faked with `setTimeout`; in our stack we must reconcile it with a real, asynchronous SSE stream where `content_ready` events arrive on their own schedule.

### Identification key

The matching key between a scraped post and its generated script is `post_index` (the integer index of the post within the current run). The backend emits:

- `post_scraped` with `payload.index` (number) and `payload.post` (object).
- `content_ready` with `payload.post_index` (number) and `payload.script` (object).

Both indices refer to the same value.

### Store additions

```ts
interface RunState {
  // ...existing v1 fields...
  comets: Comet[];                       // currently in flight
  landed: Set<number>;                   // post indices whose comet has reached t=1
  pendingScripts: Map<number, Script>;   // scripts received before their comet landed
  intensity: number;                     // increments on each comet crossing t=0.5
  elapsedStart: number | null;           // performance.now() at run start, null when idle
  glitch: number;                        // increments on every stage change
  activeScriptId: string | null;         // selected script for phone preview
}

interface Comet {
  id: number;            // monotonic per-run
  postIndex: number;     // matches `payload.index` / `payload.post_index`
  t: number;             // 0..1 along the SVG path
  born: number;          // performance.now() at spawn
  label: string;         // author initials, e.g. "MO"
  hue: number;           // for hex-lit colour cue
}
```

### Event handling

| SSE event | New behaviour |
|---|---|
| `orchestrator_start` | Reset all v2 sub-state (`comets=[]`, `landed=Set`, `pendingScripts=Map`, `intensity=0`, `elapsedStart=now`, `glitch=0`, `activeScriptId=null`). |
| `stage_changed` | Increment `glitch` (drives sweep). No other change. |
| `post_scraped` | Spawn a comet `{ id, postIndex, t: 0, born, label: initials(post.author), hue: hashHue(post.author) }`. Update the rolling `posts` buffer (last 6, used by `PostStack`). Increment `scrapedCount`. **Do not add to visible `scripts`/`reels` yet.** |
| `content_ready` | If `landed.has(postIndex)`: push the script to visible `scripts[]` immediately and remove `postIndex` from `landed`. Else: store in `pendingScripts.set(postIndex, script)`. |
| `COMET_FRAME` (internal batched action from engine, see below) | For each landed comet id, look up its `postIndex` in `state.comets`, then: if `pendingScripts.has(postIndex)` pop it and prepend to `scripts[]`; else `landed.add(postIndex)`. Remove the comet. Apply per-comet `t` updates from the same batch. Bump `intensity` if `intensityBump` is true. |
| `orchestrator_complete` | Set `stage=done`. Do **not** auto-commit any still-pending scripts; if the backend has emitted `content_ready` for every scraped post, the queue should be empty by now. Worst case: pending scripts surface as their comets land in the next ~3 s. The `elapsedStart` value is **not** reset on `done` — the timer freezes at the final elapsed value (the elapsed display reads `now - elapsedStart` while running, but the `running` flag stops the rAF tick). |
| Run stop (`STOP_RUN` from Configure panel) | Cancel rAF, clear all v2 sub-state, return to idle. |

### Reel deck membership

A reel appears in the `ReelDeck` (top 5) only when its script has been pushed to the visible `scripts[]` array — same gate as the script list itself. The deck is `scripts.slice(0, 5)` with a `fresh` flag on the just-added entry (cleared after 950 ms via a `useEffect` keyed on `scripts[0]?.id`).

### Engine ownership

A new hook `usePipelineEngine(running, dispatch)` owns the single rAF loop:

```
- last = performance.now()
- on each frame:
    dt = (now - last) / 1000; last = now
    ticks = []; landed = []; intensityBump = false
    for each comet in store.comets:
        nt = c.t + dt * 0.42
        if nt >= 1: landed.push(c.id)
        else: ticks.push({ id: c.id, t: nt })
        if c.t < 0.5 && nt >= 0.5: intensityBump = true
    if ticks.length || landed.length || intensityBump:
        dispatch({ type: "COMET_FRAME", ticks, landed, intensityBump })
- continue while comets.length > 0 OR running
```

Batching into a single `COMET_FRAME { ticks, landed, intensityBump }` per frame avoids 60+ dispatches/s. The reducer applies the entire batch immutably in one pass.

Bumping the rolling `posts` buffer from v1's `length >= 4` to `length >= 6` happens in the `post_scraped` reducer branch.

### Hex lighting

The engine also reads each comet's `(x, y)` from `pathRef.current.getPointAtLength(t * totalLength)` once per frame, throttles to ~20 Hz, computes the nearest hex via `findHexAt`, and writes a `litMap: Record<hexId, expiryMs>` into a `ref` (not state) consumed by `HexGrid` via an imperative API (`hexGridRef.current.setLit(map)`). Keeping this out of React state avoids re-rendering the hex grid on every frame.

---

## Layout

`App.tsx` becomes:

```jsx
<div className={styles.app}>
  <Dust />                                   {/* fixed inset-0, z-0 */}
  <Header />
  <div className={styles.grid}>              {/* 308 / 1fr / 408, gap 18, z-1 */}
    <ConfigurePanel />
    <PipelinePanel />
    <div className={styles.rightCol}>
      <PhonePreview />
      <ScriptsPanel />
    </div>
  </div>
  <Terminal />                                {/* full-width strip, mt 18 */}
</div>
```

Container: `max-width: 1480px; padding: 22px 28px 28px`. Below 1240 px, the grid collapses to a single column and the right-column phone/scripts stay stacked.

---

## Tokens — additions

```css
--bg:        oklch(0.15 0.008 70);   /* nudged darker from 0.16 */
--bg-4:      oklch(0.27 0.013 70);   /* NEW */
--accent-2:  oklch(0.78 0.16 130);   /* NEW */
--cyan:      oklch(0.82 0.10 220);   /* NEW — terminal [info] tag */
```

Body background adds a third radial gradient (centred at 50/50). Panel surface becomes semi-transparent gradient with `backdrop-filter: blur(6px)`.

---

## Component-level changes

### Header (modified)

- Status pill: existing dot + label, **plus** a 1 px `--line-2` separator and a `mm:ss` elapsed timer (Geist Mono, `--fg`, `tabular-nums`). Timer is driven by a `useElapsed(running, elapsedStart)` hook that ticks on rAF while `running` and reads `state.elapsedStart` from the store. Freezes on `done` (hook returns the last value), resets to `00:00` on stop/idle (`elapsedStart === null`).
- `ScopeCore` instantiates its own `useElapsed` so its readout updates independently — two rAF instances cost nothing in practice and avoid a global subscription mechanism.
- Brand mark gains a 4 s sheen sweep (CSS-only `::before`).
- Pill gets `backdrop-filter: blur(8px)` over `oklch(0.20 0.010 70 / 0.6)`.

### ConfigurePanel (modified)

- Source card: `::after` horizontal scan sweep (3.5 s linear infinite).
- Run button: `::after` hover-only sheen (0.9 s ease-out).
- Layout (column widths, tone chips, dropdown) unchanged. Behaviour calls existing `startRun(count, tone)` / `stopRun()`.

### Dust (new)

- A `frontend/src/components/Dust.tsx` component renders a `<div className="dust">` and, in `useEffect`, appends 40 `<span>` children to it with random positions, durations, and negative animation delays. CSS lives in `Dust.module.css` keyframed `drift`.
- Mounted at the top of `App.tsx` so it sits behind the grid (`z-index: 0`); grid sits at `z-index: 1`.
- Disabled entirely under `prefers-reduced-motion: reduce` — component returns `null`.

### PipelinePanel (rewritten)

Replaces the v1 spinning-ring core. New tree:

```
<PipelinePanel>
  <head>
    <PipelineTitle />
    <StageTrack stage={stage} />
  </head>
  <body ref={pipeBodyRef}>         {/* position: relative; height: 540; overflow: hidden */}
    <HexGrid w={pipeSize.w} h={pipeSize.h} hexGridRef />     {/* z-0 */}
    <CometCanvas comets={comets} w h onPosition={engine.onCometPositions} />  {/* z-1 */}
    <PostStack posts={recentPosts} totalCount={count} scrapedCount={scrapedCount} />  {/* z-2 left */}
    <ReelDeck reels={scripts.slice(0, 5)} />                  {/* z-2 right */}
    <ScopeCore stage progress intensity elapsedMs scraped count scripts={scripts.length} />  {/* z-3 centred */}
    <GlitchSweep key={glitch} />                              {/* z-5 */}
  </body>
  <StatsStrip ... />
</PipelinePanel>
```

#### HexGrid

- SVG `<svg>` filling the body. Flat-top hex tiling via the formula `cx = q*33, cy = r*38.1 + (q%2 ? 19.05 : 0)`, radius 22.
- Exposes an imperative ref: `setLit(litMap: Record<hexId, expiryMs>)`. The component holds the lit map in a `useState`; the engine pushes updates ~20 Hz.
- Cell idle/lit styling per README; transitions 600 ms ease for idle, 50 ms for lit-on.
- Under `prefers-reduced-motion`: `setLit` is a no-op (component still renders the static hexes).

#### CometCanvas

- One `<svg>` overlay with the trajectory path (M 100 H/2 C ... C ... S ...). Two stroke variants: dull lane + hot lane (only when `comets.length > 0`).
- Per comet, an absolutely-positioned `<div className="comet">` with translate (read from `path.getPointAtLength(t*total)`), trail (rotated to tangent), core dot, and label pill.
- `useLayoutEffect` reads the path's total length on mount (required: path must be in the DOM first).
- Under reduced motion: render core dot + label only (no trail, no hot-lane animation).

#### ScopeCore

- 340×220 box centred. Inner SVG with `viewBox="0 0 340 220" preserveAspectRatio="none"`. One `<path>` for the wave, redrawn on each frame via a local rAF loop. Wave math per README §3.
- `targetAmp` ratchets up to `min(1.1, 0.18 + intensity * 0.3)` when `intensity` increments, decays back to 0.20 after 280 ms; current `amp` lerps toward target at factor 0.18/frame.
- Top-left: `● SIGNAL · LIVE` (10 px Geist Mono accent, pinging dot).
- Top-right: `elapsed mm:ss` + `throughput X.X/s` (throughput = `scrapedCount / max(1, elapsed/1000)`).
- Bottom-left big stage label (Inter 800 / 28 / -0.02em).
- Bottom: 3 px progress bar gradient, width `scrapedCount/count * 100%`, 0.4 s transition.
- Under reduced motion: render a flat centreline; spikes only on `intensity` increment (a one-shot triangular pulse), no continuous wave.

#### PostStack

- Absolute left column, 200 px wide, perspective 800, `place-items: center`. Inner `.stack` rotated `rotateY(-15deg) rotateX(8deg)`.
- Renders up to 6 cards (`recentPosts.slice(-6)`), depth-translated `translate3d(i*-3, i*4, -i*10)`, opacity `1 - i*0.10`, z-index `10 - i`.
- Each card: hue-tinted avatar (using post.hue), author + role, 4 placeholder lines (CSS-only widths), `post · NNN` badge.
- Below stack: `26 px` Geist Mono counter for `(count - scrapedCount)` + "REMAINING" label.

`recentPosts` is a rolling buffer of the last 6 scraped posts in the store. The v1 store already tracks `posts: Post[]` (last 4); widen this to last 6.

#### ReelDeck

- Mirror of PostStack on right side. `rotateY(+15deg)`. Up to 5 cards.
- Reel cards (`reel-stack-card`): hue-tinted film canister (`linear-gradient(160deg, oklch(0.32 0.10 H), oklch(0.18 0.04 H))`), 8 px inset dashed border via `::before`, 5-bar sprocket strip, 11 px title, 9 px meta `{dur}s · {sceneCount} scenes`, 22×22 play circle.
- Fresh-arrival animation: a `fresh` class (added when a new script lands first, cleared after 950 ms) drives the `reelFresh` keyframes.
- Below stack: counter for `scripts.length` + "READY" label.

The `fresh` tag is tracked separately from the store: `PipelinePanel` keeps a `Set<scriptId>` in a `useState`, populated when `scripts[0]?.id` changes, cleared via `setTimeout`. Reduced motion: render without `fresh` class.

#### GlitchSweep

- Single `<div className="glitch-sweep">` covering the body. Keyed by the `glitch` counter from store; each increment remounts it, replaying the keyframe from 0.
- Reduced motion: render `null`.

#### StatsStrip

- 4 cells: Scraped (width 3), In queue (width 3), Scripts (width 3), Avg duration (width 2).
- Each value wraps a `SlotCounter` driven by `useCounter(target, 500)` for the eased ramp.

#### SlotCounter

- Per README. `<span>` per digit, each containing an `<i>` strip with 10 digits (0-9, each 28 px tall). The `<i>`'s `translateY` is `-digit * 28 px`, transitioned 0.5 s cubic-bezier.

### PhonePreview (new)

- Top of right column. Panel uses a `--ph` CSS variable (the current script's hue) for the radial-gradient background. `--ph` updates on `previewScript` change.
- Layout: `grid-template-columns: 180px 1fr; gap: 18px`.
- Phone frame: 180×320, 28 px outer radius / 22 px inner, 6 px bezel, notch, scene-progress bars (4), drifting white particles (7).
- Auto-cycle 4 scenes every 1800 ms. Reset `sceneIdx = 0` when `previewScript.id` changes.
- Scenes: Title / Hook / Proof / CTA — content per README §Phone preview panel.
- `KineticReveal` helper: split on whitespace, render each word in a `<span>` with `animation: kineticUp 0.45s ... ${i*stagger}ms forwards`. The whole scene is wrapped in `<div key={sceneIdx}>` so the animation restarts cleanly.
- Right side: 3-row meta (`// next up` title, `// duration · scenes`, `// tags` first 4 chips).
- Empty state when `previewScript === null`.
- Reduced motion: skip particles, skip kinetic reveal (full text appears at once), skip scene auto-cycle (or cycle without animation — pick: still cycle, just without per-word reveal so the user sees all 4 scenes over time).

### ScriptsPanel (rewritten)

- Compact horizontal cards per README §Script list. Each row: `idx | body | open arrow`.
- Body = title (truncated, ellipsis) + meta row (`dur · N scenes` + mini scene bars).
- Active state when `state.activeScriptId === s.id` (or default to `scripts[0]`).
- Entry animation: `translateX(20→0) + opacity` over 0.5 s with `min(idx, 6) * 30 ms` stagger.
- Click handler dispatches `SET_ACTIVE_SCRIPT { id }`.
- Reduced motion: no entry animation.

### Terminal (rewritten)

- Moved out of the right column into a full-width strip below the grid (`margin-top: 18px`).
- Chrome unchanged. Body: `columns: 2; column-gap: 32; column-rule: 1px solid --line`. Each `.log-line` is `break-inside: avoid; margin-bottom: 1px`.
- Total height 180 px.
- Tag colour mapping uses `--cyan` for `info`, `--accent` for `ok`, `--warn` for `warn`. The existing `level` field on `LogLine` drives this directly — no changes to `logFromEvent`.

---

## State machine — full event/action table

```ts
type Action =
  | { type: "SET_COUNT"; n: number }
  | { type: "SET_TONE"; tone: Tone }
  | { type: "RESET" }
  | { type: "EVENT"; ev: RawEvent }
  | { type: "STREAM_ERROR" }
  | { type: "COMET_FRAME"; ticks: { id: number; t: number }[]; landed: number[]; intensityBump: boolean }   // `landed` carries comet ids
  | { type: "SET_ACTIVE_SCRIPT"; id: string | null };
```

The reducer's `COMET_FRAME` branch:

1. Apply `ticks` to update `comets[].t` immutably.
2. For each `id` in `landed`: find the comet, look up its `postIndex`, then:
   - Remove the comet from `comets[]`.
   - If `pendingScripts.has(postIndex)`: pop the script; prepend to `scripts[]` (capped at 50); also push to reels.
   - Else: add `postIndex` to `landed`.
3. If `intensityBump`: `intensity += 1`.

The reducer's `EVENT` branch for `content_ready`:

- If `landed.has(postIndex)`: prepend script to `scripts[]`, remove from `landed`.
- Else: `pendingScripts.set(postIndex, script)`.

`RESET` clears: `comets=[]`, `landed=new Set()`, `pendingScripts=new Map()`, `intensity=0`, `elapsedStart=null`, `glitch=0`, `activeScriptId=null`, plus the v1 fields.

---

## Animation timing & easing reference

All numbers come from the v2 README and are summarised in §Animation summary. The implementation pulls them from a shared `frontend/src/styles/anim.module.css` (or inlines CSS-Module-local keyframes) so they don't drift:

- Comet traverse: 2.4 s end-to-end (`SPEED = 0.42 / s`).
- Hex lit decay: 600 ms (snap-on 50 ms).
- Glitch sweep: 700 ms ease-out.
- Slot roller: 0.5 s cubic-bezier(.4,0,.2,1).
- Phone scene: 1.8 s per scene; per-word kinetic 0.45 s, 60–70 ms stagger.
- Reel fresh: 0.9 s ease-out.
- Script entry: 0.5 s ease-out, 30 ms stagger, capped at idx=6.
- Dust drift: 8–26 s linear infinite (random).
- Status pill ping: 1.6 s ease-out infinite.

---

## Reduced-motion plan (`prefers-reduced-motion: reduce`)

The existing global `*` override in `tokens.css` kills `animation-duration` and `transition-duration` — keep it as the floor.

In addition, components opt OUT of expensive renders entirely when reduced motion is on. A shared `useReducedMotion()` hook (already present in v1) returns a boolean:

| Component | Reduced behaviour |
|---|---|
| `Dust` | Render `null`. |
| `CometCanvas` | Skip trail; show core dot + label only. Hot-lane animation off. |
| `HexGrid` | Static cells; `setLit` no-op. |
| `ScopeCore` | Flat centreline + one-shot triangular spikes on intensity bumps. No continuous wave. |
| `GlitchSweep` | Render `null`. |
| `ReelDeck` | No `fresh` class. |
| `PhonePreview` | No particles. Scenes still auto-cycle every 1.8 s, but kinetic reveal is replaced by snap full-text. |
| `ScriptsPanel` | No entry stagger. |
| `Header` | No brand sheen. |
| `ConfigurePanel` | No source-card scan, no run-button sheen. |

---

## File-level inventory

### New files

| Path | Purpose |
|---|---|
| `frontend/src/components/Dust.tsx` | Ambient particle host (vanilla JS spans inside React component). |
| `frontend/src/components/Dust.module.css` | Drift keyframes. |
| `frontend/src/components/PipelinePanel/index.tsx` | Pipeline panel orchestrator (replaces existing flat file). |
| `frontend/src/components/PipelinePanel/HexGrid.tsx` | SVG hex grid + imperative lit-map setter. |
| `frontend/src/components/PipelinePanel/CometCanvas.tsx` | SVG path + comet divs. |
| `frontend/src/components/PipelinePanel/ScopeCore.tsx` | Oscilloscope + stage label + readouts. |
| `frontend/src/components/PipelinePanel/PostStack.tsx` | Left 3D post stack. |
| `frontend/src/components/PipelinePanel/ReelDeck.tsx` | Right 3D reel canister deck. |
| `frontend/src/components/PipelinePanel/GlitchSweep.tsx` | Keyed sweep div. |
| `frontend/src/components/PipelinePanel/SlotCounter.tsx` | Digit roller. |
| `frontend/src/components/PipelinePanel/StatsStrip.tsx` | 4-cell stats row. |
| `frontend/src/components/PipelinePanel/StageTrack.tsx` | Dot-and-line stage indicator (extracted from existing inline code). |
| `frontend/src/components/PipelinePanel/PipelinePanel.module.css` | All PipelinePanel + sub-component styles (kept in one module to share `--accent` chains). Or per-subcomponent if it gets too long; the implementation decides. |
| `frontend/src/components/PhonePreview/index.tsx` | Top-of-right-column phone panel. |
| `frontend/src/components/PhonePreview/Phone.tsx` | Bezel + screen + scene bars + particles. |
| `frontend/src/components/PhonePreview/KineticReveal.tsx` | Word-by-word reveal helper. |
| `frontend/src/components/PhonePreview/scenes/Title.tsx` | Scene 1. |
| `frontend/src/components/PhonePreview/scenes/Hook.tsx` | Scene 2. |
| `frontend/src/components/PhonePreview/scenes/Proof.tsx` | Scene 3. |
| `frontend/src/components/PhonePreview/scenes/Cta.tsx` | Scene 4. |
| `frontend/src/components/PhonePreview/PhonePreview.module.css` | All phone styles. |
| `frontend/src/hooks/useElapsed.ts` | rAF-driven `mm:ss` ticker. |
| `frontend/src/hooks/usePipeSize.ts` | `ResizeObserver` wrapper for the pipe body element. |
| `frontend/src/hooks/usePipelineEngine.ts` | Single rAF loop owning comet ticks + hex lit map. |
| `frontend/src/hooks/usePhoneScenes.ts` | Auto-cycling scene state with reset on script change. |
| `frontend/src/utils/hex.ts` | `buildHexes(w, h)`, `findHexAt(cells, x, y)`. |
| `frontend/src/utils/text.ts` | `initials(name)`, helper used for comet labels. |

### Modified files

| Path | Change |
|---|---|
| `frontend/src/App.tsx` | New grid + dust mount + full-width terminal below. |
| `frontend/src/styles/tokens.css` | Add `--bg-4`, `--accent-2`, `--cyan`; nudge `--bg`; third body radial gradient. |
| `frontend/src/styles/app.module.css` | Grid `308 / 1fr / 408`, max-width 1480, terminal-strip margin, panel blur + semi-transparent gradient. |
| `frontend/src/components/Header.tsx` | Status pill gains elapsed timer (uses `useElapsed`). |
| `frontend/src/components/Header.module.css` | Brand sheen `::before`, pill backdrop-blur, icon-btn blur. |
| `frontend/src/components/ConfigurePanel.tsx` | No structural change; preserved. |
| `frontend/src/components/ConfigurePanel.module.css` | Source-card `::after` scan, run-btn `::after` hover sheen. |
| `frontend/src/components/ScriptsPanel.tsx` | Rewrite to compact horizontal cards + active state + click handler. |
| `frontend/src/components/ScriptsPanel.module.css` | New card styles + entry animation. |
| `frontend/src/components/Terminal.tsx` | No structural change; `level` already drives class. |
| `frontend/src/components/Terminal.module.css` | 2-column body, full-width strip dimensions, `--cyan` for info-tag. |
| `frontend/src/state/store.tsx` | New sub-state, new actions, new reducer branches, deferred-script gating. |
| `frontend/src/types.ts` | New `Comet` type; expand any helper types as needed. |
| `frontend/src/hooks/useCounter.ts` | Unchanged (still used by stats). |
| `frontend/src/hooks/useReducedMotion.ts` | Unchanged. |

### Deleted files

| Path | Reason |
|---|---|
| `frontend/src/components/Core.tsx` | Replaced by ScopeCore (no longer used). |
| `frontend/src/components/Core.module.css` | Replaced. |
| `frontend/src/components/PipelinePanel.tsx` | Replaced by `PipelinePanel/index.tsx`. |
| `frontend/src/components/PipelinePanel.module.css` | Replaced by `PipelinePanel/PipelinePanel.module.css`. |

---

## Test plan

The frontend has no existing test infrastructure (no jest/vitest config). Per existing CLAUDE.md guidance not present and no test framework set up, automated tests are not added here. Verification is manual + visual:

1. **Type check + build:** `cd frontend && npm run build` must pass (this runs `tsc --noEmit && vite build`).
2. **Idle state:** open `npm run dev`, confirm: header pill shows "Idle · agent ready" with no timer, pipe body shows STANDBY + flat scope wave + idle hex grid + empty post stack + empty reel deck, phone shows empty state, scripts panel shows "No scripts yet", terminal shows blinking-cursor prompt, dust drifting in viewport.
3. **Live run (real backend):**
   - Start the Python backend (`python main.py`).
   - Press Run pipeline. Verify: status pill shows live dot + "Live · scraping..." + ticking timer; glitch sweep on each stage change; comets spawn from left edge per `post_scraped` event; hex cells light along the comet path; oscilloscope wave spikes when a comet crosses centre; reels and scripts appear staggered behind real scrape events (script visible only after comet lands).
   - Click a script in the list: phone preview switches to it and cycles 4 scenes.
   - Wait for run completion: stage shows READY, timer freezes, no remaining comets.
4. **Stop mid-run:** press the Stop button — all comets clear, no orphan scripts left in pending.
5. **Reduced motion:** toggle macOS System Settings → Accessibility → Display → Reduce motion. Reload. Dust gone, comets show no trail, hex grid static, scope flat line, no glitch sweep, no kinetic reveal, no script entry stagger. Functionality otherwise identical.
6. **Narrow viewport:** resize browser below 1240 px. Grid collapses to single column; layout remains usable.
7. **SSE disconnect resilience:** kill the backend mid-run. Existing v1 `STREAM_ERROR` handling fires; comets in flight should still finish gracefully (no crash). New: pending scripts that never arrive get cleared on the next `RESET`.

---

## Implementation guidance

- Wrap `PhonePreview`, `Terminal`, `ConfigurePanel`, and individual `ScriptCard`s in `React.memo` so they don't re-render on every comet frame.
- The pipeline subtree (`PostStack`, `ReelDeck`, `ScopeCore`, `CometCanvas`, `HexGrid`) re-renders frequently — that's expected.
- Use `useLayoutEffect`, not `useEffect`, when reading `path.getTotalLength()` and the pipe body's `getBoundingClientRect()`.
- The pipe body's measured size must update on resize; use `ResizeObserver` in `usePipeSize`.
- Keep the comet path math in viewport units of the measured pipe body, not the logical 820×540 — easier than scaling.
- The hex lit map writes via an imperative ref API to avoid React re-renders at 20 Hz.

---

## What stays the same

- Backend SSE event types and shapes (see `events.py`, `orchestrator.py`).
- `subscribe(onMessage, onError)` API in `frontend/src/api.ts`.
- `startRun(count, tone)` / `stopRun()` calls.
- Authentication / scraping logic.
- v1 dropdown ARIA, focus rings, live regions.
- v1 stage sequence (`idle → scraping → parsing → generating → done`).
- v1 `useCounter` hook and `useReducedMotion` hook.
