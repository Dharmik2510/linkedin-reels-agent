# Handoff: Reelify Dashboard — v2 (Cinematic Pipeline)

A major visual + animation revamp of the v1 Reelify dashboard. **Same product, same data flow, same component contract** (count + tone → run → scraped → scripts) — but the pipeline visualization, layout, and motion are dramatically upgraded.

If you implemented v1 from the original handoff (`/design_handoff_reelify_dashboard/`), treat this as a **diff to apply on top of v1**. If you're starting fresh, this README plus the v1 README together describe the full design.

---

## Files in this bundle

| File | Purpose |
|---|---|
| `Reelify Dashboard v2.html` | Entry HTML — fonts, tokens, all CSS, mounts React app, ambient dust |
| `v2-shared.babel.js` | Sample data, icons, dropdown, slot counter, helpers (`useCounter`, `buildScript`, `buildLog`, `fmtElapsed`) |
| `v2-stage.babel.js` | Pipeline stage: `HexGrid`, `PostStack`, `ReelDeck`, `ScopeCore`, `CometCanvas` |
| `v2-sidebar.babel.js` | Right column: `PhonePreview` (kinetic auto-cycling scenes), `ScriptCard`, `Terminal` |
| `v2-app.babel.js` | Top-level `App`, state machine, run lifecycle, comet rAF loop |
| `v1_reference/` | The v1 HTML + JS prototype for side-by-side comparison |

Open `Reelify Dashboard v2.html` in a browser to see it running.

## Fidelity

**High-fidelity (hifi)**. Recreate pixel-perfectly using your stack's idioms — React + Tailwind, Vue + scoped CSS, SwiftUI, etc. The motion design IS the design here, so getting timings and easings right matters as much as the static layout.

---

## High-level diff vs v1

| Area | v1 | v2 |
|---|---|---|
| Layout | `320 / 1fr / 380` cols, terminal inside right column | `308 / 1fr / 408` cols, **terminal in full-width strip below** |
| Pipeline center | Rotating concentric rings + orbiting particles + bulb glyph | **Comet particles** + **oscilloscope waveform** + **hex honeycomb** |
| Posts (left of core) | 4 flying card list | **3D stacked 6-card pile** with perspective tilt |
| Reels (right of core) | 4 small reel preview cards | **3D stacked 5-card film canister deck** |
| Stats counters | Eased numeric span | **Slot-machine digit rollers** |
| Status pill | Stage label only | Stage label + **live elapsed mm:ss timer** |
| Stage transitions | Color / label swap | **Glitch sweep** band animation |
| Right column | Script list + terminal | **Phone preview** (NEW) + compact script list |
| Script cards | Vertical, hook quote + scene bars + tags | **Compact horizontal rows**, click to preview |
| Background | Static panel gradients | **Ambient drifting dust** across whole viewport |
| Brand mark / source card | Static | **Light sheen sweep** + **scanline overlay** |

---

## Design tokens — additions/changes

All v1 tokens still apply. New / modified:

```css
--bg:           oklch(0.15 0.008 70);    /* nudged darker */
--bg-4:         oklch(0.27 0.013 70);    /* NEW — for inner lines / chips */
--accent-2:     oklch(0.78 0.16 130);    /* NEW — accent variant */
--cyan:         oklch(0.82 0.10 220);    /* NEW — for terminal [info] tag color */
```

Body background gains a third radial gradient:
```css
radial-gradient(500px 400px at 50% 50%, oklch(0.20 0.02 130 / 0.30), transparent 70%)
```

Panels use a semi-transparent background + backdrop-blur for atmosphere:
```css
background: linear-gradient(180deg, oklch(0.21 0.010 70 / 0.85), oklch(0.17 0.008 70 / 0.85));
backdrop-filter: blur(6px);
```

---

## Layout — new grid

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Header                                                                       │
├──────────────┬───────────────────────────────────────┬────────────────────────┤
│              │                                       │  Phone preview         │
│  CONFIGURE   │            PIPELINE                   │  (auto-cycle scenes)   │
│  (308px)     │            (flex 1)                   │  (408px)               │
│              │                                       │                        │
│              │            stats strip                │  Compact script list   │
├──────────────┴───────────────────────────────────────┴────────────────────────┤
│ Terminal — full width, 2-column body                                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

`max-width: 1480px; padding: 22px 28px 28px`. Grid: `grid-template-columns: 308px minmax(0, 1fr) 408px; gap: 18px`. Terminal strip uses `margin-top: 18px`. Collapse to single column below 1240px.

---

## Component-by-component

### Status pill (header right)

Now includes a live elapsed timer:

```
●  Live · scraping saved posts  │  00:23
```

- `backdrop-filter: blur(8px)` over `oklch(0.20 0.010 70 / 0.6)` background.
- `1px` vertical separator between status text and timer.
- Timer color is `--fg`, `font-variant-numeric: tabular-nums`.
- Ticks via `requestAnimationFrame` while `running`, freezes on `done`, resets on stop / idle.
- Format: `mm:ss` zero-padded.

### Brand mark

Same 36×36 rounded gradient square + play-triangle, **plus** a `::before` light-streak that sweeps left → right every 4s:

```css
.brand-mark::before {
  content: ""; position: absolute; left: -50%; top: 0; bottom: 0; width: 30%;
  background: linear-gradient(90deg, transparent, oklch(1 0 0 / 0.5), transparent);
  transform: skewX(-20deg);
  animation: sheen 4s ease-in-out infinite;
}
@keyframes sheen { 0%, 100% { left: -50%; } 50% { left: 130%; } }
```

### Source card

Add an `::after` horizontal sweep — same idea as the brand sheen but more subtle, sweeping the full card every 3.5s:

```css
.config-source::after {
  content: ""; position: absolute; left: -100%; top: 0; bottom: 0; width: 100%;
  background: linear-gradient(90deg, transparent, oklch(0.88 0.19 128 / 0.10), transparent);
  animation: scan 3.5s linear infinite;
}
@keyframes scan { to { left: 100%; } }
```

### Run button — sheen on hover

Add a `::after` sheen that triggers only on hover:

```css
.run-btn::after {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent, oklch(1 0 0 / 0.25), transparent);
  transform: translateX(-100%);
}
.run-btn:hover::after { animation: btnSheen 0.9s ease-out; }
@keyframes btnSheen { to { transform: translateX(100%); } }
```

---

### Pipeline body — completely rebuilt

`.pipe-body` is `position: relative; height: 540px; overflow: hidden`. It contains five layered elements, in z-order from back to front:

#### 1. Hex honeycomb background

SVG flat-top hexagons tiled to cover the body. Geometry constants:

```js
const HEX_R  = 22;
const HEX_W  = HEX_R * 2;             // 44
const HEX_H  = Math.sqrt(3) * HEX_R;  // ~38.1
const HEX_DX = HEX_W * 0.75;          // 33  (column spacing)
```

For each column `q` (0..cols), each row `r` (0..rows):
```
cx = q * HEX_DX
cy = r * HEX_H + (q % 2 ? HEX_H / 2 : 0)
```

Each hex is a `<polygon>` with 6 points around `(cx, cy)` at radius `HEX_R - 1.5`.

Idle style: `fill: oklch(0.21 0.010 70 / 0.55); stroke: oklch(0.34 0.012 70 / 0.7)` 0.6px. Transitions back over 600ms.

Lit style (`.hex.lit`): `fill: oklch(0.55 0.16 130 / 0.18); stroke: oklch(0.88 0.19 128 / 0.55)`. Transition in over 50ms (snap on), 600ms decay.

A throttled callback (~20Hz) from the comet position stream finds the nearest hex cell (`findHexAt`: brute-force closest center) for each comet and marks it lit with an expiry of `now + 600ms`. An interval prunes expired entries from the map.

#### 2. Comet transport — the signature animation

A single SVG path defines the trajectory:

```
M 100 H/2 
  C 200 H/2-80, W/2-60 H/2+40, W/2 H/2 
  S W-200 H/2-40, W-100 H/2
```

(From left edge inward, dipping low through arc 1, peaking high through arc 2.)

Comet state shape:
```ts
{ id: number, t: number, label: string, post: Post, born: number }
```

Single rAF loop in `App`:
- `dt = (now - last) / 1000`
- For each comet: `t += dt * 0.42` (~2.4s end-to-end)
- When `t` crosses `0.5`, bump `intensity` counter (oscilloscope reads it)
- When `t >= 1`, fire an "arrival" callback that adds a reel to the deck + a script to the list, then drop the comet from state

Comet rendering — absolutely-positioned div per comet:
```
.comet
  transform: translate(x, y); translate(-50%, -50%) on inner
  opacity: 0 if t < 0.03 or t > 0.97 else 1

  .trail     →  26×2 gradient, rotated to path tangent
  .core-dot  →  8×8 accent circle, double-shadow glow
  .label     →  pill with author initials, accent border, backdrop-blur
```

Path positions come from `pathRef.current.getPointAtLength(t * totalLength)`. Tangent angle from a step ahead: `atan2(p2.y - p.y, p2.x - p.x)`.

Path styling:
- Base lane: `stroke: oklch(0.34 0.018 70 / 0.6); stroke-dasharray: 3 5; stroke-width: 1`
- Hot lane (overlay rendered when any comets exist): `stroke: oklch(0.88 0.19 128 / 0.6); stroke-dasharray: 5 7; stroke-width: 1.2; animation: laneFlow 1.4s linear infinite; filter: drop-shadow(0 0 3px accent/0.5)`
- `@keyframes laneFlow { to { stroke-dashoffset: -24; } }`

#### 3. Oscilloscope core (`ScopeCore`)

Centered absolutely, `left: 50%; top: 50%; transform: translate(-50%, -50%)`. Inner size 340×220, `border-radius: 14px`.

```css
.scope {
  background: radial-gradient(circle at center, oklch(0.20 0.03 130 / 0.7), oklch(0.16 0.010 70 / 0.2) 70%);
  border: 1px solid oklch(0.88 0.19 128 / 0.3);
  box-shadow:
    0 0 0 1px oklch(0.88 0.19 128 / 0.12),
    0 30px 60px oklch(0.88 0.19 128 / 0.18),
    inset 0 0 60px oklch(0 0 0 / 0.5);
}
```

**Inner grid lines:** background image of two 1px accent-tinted lines at 20px spacing, `opacity: 0.6`.

**Live waveform:** an `<svg>` filling the box (`viewBox="0 0 340 220" preserveAspectRatio="none"`). One `<path>` redrawn every animation frame with 60 segments:

```
amp += (targetAmp - amp) * 0.18         // lerp toward target
ms = t / 1000
for i in 0..60:
  x = (i / 60) * 340
  phase  = (i/60) * π*4 + ms*3.2
  phase2 = (i/60) * π*9 + ms*5
  y = 110 + sin(phase) * 220*0.18*amp + sin(phase2) * 220*0.05*amp
```

`targetAmp` jumps to `min(1.1, 0.18 + intensity * 0.3)` when `intensity` increments (comet crossed center), then snaps back to `0.20` after 280ms — so the wave spikes per comet.

Stroke `--accent`, 1.4px, `drop-shadow(0 0 5px oklch(0.88 0.19 128 / 0.7))`. A faint dashed centerline runs across at y=110.

**Top-left label:** pulsing dot + `SIGNAL · LIVE` in 10px Geist Mono `--accent` with text-shadow.

**Top-right readout:**
```
elapsed mm:ss
throughput X.X/s    ← scraped / max(1, elapsed/1000), 1 decimal
```

**Bottom-left big stage label:** `STANDBY` / `SCRAPE` / `PARSE` / `REELIFY` / `READY` in **Inter 800 / 28px / -0.02em**. Sub-label in 10px Geist Mono uppercase, color `--fg-3`. Drives off `stage`.

**Bottom progress bar:** 3px tall full-width strip, fills `(scrapedCount / count) * 100%` with `linear-gradient(90deg, --accent-deep, --accent)` + `box-shadow: 0 0 12px --accent`. Transition `width 0.4s ease`.

#### 4. 3D post stack (left) + reel deck (right)

Both columns absolute-positioned, top: 0; bottom: 0; 200px wide; `display: grid; place-items: center`; `perspective: 800px`. Top: a 10px-Geist-Mono uppercase column label. Bottom: a counter (26px Geist Mono number + 10px uppercase label).

**Stack wrapper** (`.stack`): 150×200, `transform-style: preserve-3d`, `transform: rotateY(-15deg) rotateX(8deg)` (mirrored on right: `rotateY(+15deg)`).

**Post stack cards** (up to 6 stacked, indexed `i = 0..5`):
- `transform: translate3d(i*-3, i*4, -i*10)` (mirrored x-sign on right deck)
- `opacity: 1 - i * 0.10`
- `z-index: 10 - i`
- Card content (`.stack-card`):
  - 28×28 hue-tinted round avatar (`linear-gradient(135deg, oklch(0.60 0.10 H), oklch(0.40 0.06 H))`)
  - Author name (`11px / 600 / --fg`), role (`9px Geist Mono / --fg-3`)
  - 4 placeholder lines (`.lines i`): 5px tall `--bg-4` bars at 88% / 60% / 78% / 40% widths
  - `.badge` at bottom: `post · NNN` mono pill in `--bg-4`

Recycling: when a post is scraped, shift the top card off and push a new one onto the bottom. Use the post's `id` and a synthetic `_key` to keep React keys stable.

**Reel deck cards** (`.reel-stack-card`, up to 5):
- Hue-tinted film-canister background:
  ```
  linear-gradient(160deg, oklch(0.32 0.10 H), oklch(0.18 0.04 H))
  ```
- 8px inset dashed border via `::before`
- 5-bar sprocket strip at top (`.sprocket span`: 4px tall, near-black rounded bars)
- 11px / 800 title, 9px Geist Mono meta (`{dur}s · {sceneCount} scenes`)
- 22×22 white play circle at bottom-right with hue-tinted play glyph

Fresh-arrival animation (`.reel-stack-card.fresh`):
```css
@keyframes reelFresh {
  0%   { transform: var(--rb-tx) translateY(-30px); opacity: 0; filter: brightness(2); }
  30%  { filter: brightness(1.5); }
  100% { opacity: 1; filter: brightness(1); }
}
```
Where `--rb-tx` is the card's normal `translate3d(...)` value, so the fresh animation overlays on top. Class removed after 950ms.

**Counters below each stack:** post stack shows `(count - scrapedCount).padStart(2,'0')` + label "REMAINING". Reel deck shows `reels.length.padStart(2,'0')` + label "READY".

#### 5. Glitch sweep (stage transitions)

A single `.glitch-sweep` div absolutely covers the pipe body, normally `opacity: 0; z-index: 5`. Background:

```css
linear-gradient(180deg,
  transparent           30%,
  oklch(0.88 0.19 128 / 0.05) 48%,
  oklch(0.88 0.19 128 / 0.25) 50%,
  oklch(0.88 0.19 128 / 0.05) 52%,
  transparent           70%
)
```

Animation when triggered (`.go` class):
```css
@keyframes gsweep {
  0%   { transform: translateY(-100%); opacity: 0; }
  30%  {                                opacity: 1; }
  100% { transform: translateY(100%);   opacity: 0; }
}
```
700ms ease-out.

**Trigger:** increment a `glitch` counter in state on every stage change. Use the counter as the React `key` on the sweep div so each increment remounts it and replays the animation from frame 0.

---

### Stats strip — slot-machine counters

`SlotCounter` component:

```jsx
function SlotCounter({ value, width = 3 }) {
  const str = String(Math.max(0, Math.round(value))).padStart(width, "0");
  return (
    <span style={{ display: "inline-flex", lineHeight: 1 }}>
      {str.split("").map((ch, i) => (
        <span className="digit" key={i}>
          <i style={{ transform: `translateY(-${parseInt(ch, 10) * 28}px)` }}>
            {[0,1,2,3,4,5,6,7,8,9].map(d => (
              <span style={{ display: "block", height: 28 }}>{d}</span>
            ))}
          </i>
        </span>
      ))}
    </span>
  );
}
```

CSS:
```css
.digit { display: inline-block; width: 14px; height: 28px; overflow: hidden; vertical-align: top; }
.digit > i { display: block; line-height: 28px; text-align: center;
             transition: transform 0.5s cubic-bezier(.4,0,.2,1);
             font-variant-numeric: tabular-nums; }
```

Stats values are still passed through `useCounter(target, 500)` for an eased ramp, then `SlotCounter` renders the visual roll. Widths: Scraped/Queue/Scripts use `width=3`, Avg duration uses `width=2`.

Stat row layout, font sizes, dividers unchanged from v1.

---

### Phone preview panel (NEW)

Top of right column. Panel has a row layout `grid-template-columns: 180px 1fr; gap: 18px; align-items: center` with `padding: 22px 18px`. The panel uses a radial gradient anchored on the phone side, hue-tinted per the current script (`--ph` CSS var):

```css
background: radial-gradient(300px 200px at 20% 50%, oklch(0.30 0.06 var(--ph) / 0.18), transparent 70%);
```

**Phone frame (180 × 320):**
- Outer: 28px radius, 6px padding (the "bezel"), bg `linear-gradient(160deg, --bg-4, --bg-2)`, border `1px --line-2`, `box-shadow: 0 20px 50px oklch(0 0 0 / 0.5), inset 0 0 0 1px oklch(1 0 0 / 0.04)`
- Inner screen: 22px radius, fills the bezel
- Screen background (hue per script):
  ```
  radial-gradient(circle at 30% 20%, oklch(0.55 0.18 H / 0.5), transparent 70%),
  linear-gradient(170deg, oklch(0.35 0.10 H), oklch(0.20 0.04 H))
  ```
  Transitions over 0.6s when script changes.
- 56×14 notch absolutely-positioned at top center (`background: oklch(0 0 0 / 0.7)`).
- Bottom: 4-bar scene progress (3px gap, 2px height each):
  - Past scenes: `oklch(1 0 0 / 0.9)` (full)
  - Current scene: filled by a `b` inner bar that animates `width: 0 → 100%` over `--scene-dur` (1800ms)
  - Future scenes: `oklch(1 0 0 / 0.25)`
- Decorative inner particles: 7 small white 3px circles drifting upward (`translate(--x, -200px) scale(1.2)`) over 2.2s ease-out infinite, each with a random x offset and staggered delay.

**Auto-cycle 4 scenes** every 1800ms. Reset `sceneIdx = 0` whenever `script.id` changes.

| # | Name | Content |
|---|---|---|
| 1 | **Title** | Author (9px Geist Mono uppercase, white/0.7) · Role · `REEL · NNN` ID · "A short take." in 28px / 800 / -0.02em — word-by-word kinetic reveal |
| 2 | **Hook** | `/ the hook` slug · the opening sentence rendered word-by-word (70ms stagger); first occurrence of each capitalized keyword wrapped in a `kbox` (black-translucent pill) for emphasis |
| 3 | **Proof** | `/ proof` · the full body text at 15px / 600, kinetic reveal at 28ms-per-word |
| 4 | **CTA** | `/ next` · "Save this · share it · steal it." in 26px / 800 · `by reelify.agent` micro-CTA with a 14px white dot |

The kinetic reveal helper:
```jsx
function KineticReveal({ text, stagger = 60 }) {
  return text.split(/\s+/).map((w, i) => (
    <span key={i} style={{
      display: "inline-block", marginRight: "0.25em",
      opacity: 0, transform: "translateY(6px)",
      animation: `kineticUp 0.45s cubic-bezier(.4,0,.2,1) ${i * stagger}ms forwards`,
    }}>{w}</span>
  ));
}
// @keyframes kineticUp { to { opacity: 1; transform: translateY(0); } }
```

Wrap each scene render in `<div key={sceneIdx}>` so animations restart cleanly on scene switch.

**Right of phone — meta column** (`.phone-meta`, `gap: 14px`):
- `// next up` — script title (`14px / 600 / --fg`)
- `// duration · scenes` — `{dur}s · {sceneCount} cuts` (Geist Mono 14px / 600)
- `// tags` — first 4 tags as outlined chips (10px Geist Mono, `--line-2` border, `oklch(0.20 0.010 70 / 0.6)` background)

**Empty state** (when no script generated yet): a centered block with mono label "No reel ready" and prompt "Generated reels will auto-preview here, with kinetic scenes for hook, proof, and CTA."

**Preview selection:** when the user clicks a script card in the list below, `activeScriptId` is set and the phone switches to that script. Default = most recent (`scripts[0]`).

---

### Script list — compact horizontal cards

Out: tall cards with hook quote / scene bars / tags. In: single-row chips:

```
┌──┬─────────────────────────────────────┬──┐
│01│ M. Okafor — Founder · Loomspace     │→ │
│  │ 32s · 5 scenes        ▮▮▮▮▮         │  │
└──┴─────────────────────────────────────┴──┘
```

- `.script-card`: flex row, `padding: 10px 12px`, `--bg-3` background, `1px --line-2`, `10px` radius, `gap: 10px; align-items: center`
- `.idx`: 22×22 rounded square, `oklch(0.30 0.04 130 / 0.5)` background, `--accent` text, `11px Geist Mono / 600`
- Body — title (`12px / 600`, single line, ellipsis truncated) + meta row:
  - duration (`--accent` colored)
  - "· N scenes"
  - mini scene bars at end (5×6px rounded bars, first bar `--accent`, rest `--accent-deep`)
- `.open`: 24×24 rounded square button with right arrow icon, `--bg-4` background

**Active state** (`previewScript.id === s.id`): `border: 1px solid --accent`, `background: oklch(0.30 0.04 130 / 0.18)`.

**Entry animation**: `opacity 0 → 1, translateX(20px → 0)` over 0.5s `cubic-bezier(.3,0,.2,1)` with `Math.min(idx, 6) * 30ms` stagger. **Direction change is intentional** — comes IN from the right to match the rightward flow of the pipeline.

List scrolls (`max-height: 290px`, `overflow: auto`, 6px scrollbar).

---

### Terminal — full-width strip below the grid

Moved out of the right column into its own panel below the 3-col grid. Same chrome (3 traffic-light dots + mono label + line counter) and same `.log-line` shape (timestamp · tag · message).

**New: 2-column body**:
```css
.terminal-body {
  columns: 2;
  column-gap: 32px;
  column-rule: 1px solid var(--line);
}
.log-line { break-inside: avoid; margin-bottom: 1px; }
```

Total height 180px.

**New log tags** in the streamed sequence (between `[rank]` and `[write]`):

| Tag | Level | Example message |
|---|---|---|
| `[warm]`   | info | warming LLM · ctx=8192 |
| `[scene]`  | info | scene-graph · 5 acts per reel |
| `[shot]`   | ok   | shotlist drafted · cuts=1.4/s |
| `[render]` | info | tts pre-render · voice=op-alta |
| `[qa]`     | ok   | QA pass · 0 violations |

Tag color now reads `--cyan` for `info`, `--accent` for `ok`, `--warn` for `warn`.

---

### Ambient drifting dust (NEW)

Vanilla JS, not React. After the page mounts, append a `position: fixed; inset: 0; pointer-events: none; z-index: 0` `.dust` container, and fill it with 40 spans:

```js
const N = 40;
for (let i = 0; i < N; i++) {
  const d = document.createElement('span');
  d.style.left = (Math.random() * 100) + 'vw';
  d.style.top  = (Math.random() * 100) + 'vh';
  d.style.opacity = (0.15 + Math.random() * 0.5).toFixed(2);
  d.style.animationDuration = (8 + Math.random() * 18).toFixed(1) + 's';
  d.style.animationDelay = (-Math.random() * 12).toFixed(1) + 's';   // negative = already in flight
  d.style.background = Math.random() < 0.6 ? 'oklch(0.88 0.19 128)' : 'oklch(0.78 0.10 80)';
  host.appendChild(d);
}
```

CSS:
```css
.dust span {
  position: absolute; width: 2px; height: 2px; border-radius: 50%;
  filter: blur(0.5px);
  animation: drift linear infinite;
}
@keyframes drift {
  from { transform: translate3d(0, 0, 0); }
  to   { transform: translate3d(120px, -80px, 0); }
}
```

The negative animation-delays mean particles are already spread along their trajectory at page load — no "all start from origin" pop-in.

---

## State additions (on top of v1)

```ts
reels:           Reel[]                 // top 5, separate from full scripts list
comets:          Comet[]                // currently in flight: { id, t, label, post, born }
intensity:       number                 // increments on each comet core-cross
elapsed:         number                 // ms since current run started
glitch:          number                 // increments on every stage change (drives sweep)
activeScriptId:  number | null          // which script the phone previews
pipeSize:        { w: number; h: number }  // measured pipe-body dims for comet math
```

### Single rAF loop (App scope)

Owns comet motion + cleanup:

```js
const SPEED = 0.42;  // 1/seconds; ~2.4s end-to-end
let last = performance.now();

function tick(now) {
  const dt = (now - last) / 1000; last = now;
  setComets(prev => {
    let bump = false;
    const next = [];
    for (const c of prev) {
      const nt = c.t + dt * SPEED;
      if (nt >= 1) {
        onCometDone(c);                     // emit reel + script
        continue;
      }
      if (c.t < 0.5 && nt >= 0.5) bump = true;
      next.push({ ...c, t: nt });
    }
    if (bump) setIntensity(i => i + 1);
    return next;
  });
  requestAnimationFrame(tick);
}
```

### Hex highlighting

Throttled comet-position callback (50ms gate) — for each comet, find nearest hex by squared distance, set `litMap[hex.id] = now + 600`. A pass through the map drops expired entries. Then `setLitMap({...})` on the hex layer.

### Run lifecycle changes

Same five stages as v1 (idle → scraping → parsing → generating → done). New behavior:
- On every stage change: `triggerGlitch()` (`setGlitch(g => g + 1)`).
- When a post is scraped, **add a comet** (not a flying card). The script + reel arrive when that comet completes (~2.4s later), so the scrape-event and the script-arrival are now temporally separated — feels more like a real pipeline.
- After the scrape loop, drain — poll every 250ms until `comets.length === 0` (cap at ~10s).

---

## Animation summary

| Element | Property | Duration / Easing |
|---|---|---|
| Status pill dot | box-shadow ping | 1.6s ease-out infinite |
| Status pill timer | rAF count-up | continuous while running |
| Brand mark sheen | left position | 4s ease-in-out infinite |
| Source card scan | left position | 3.5s linear infinite |
| Run button sheen | translateX | 0.9s ease-out on hover |
| Run button spinner | rotate | 0.7s linear infinite |
| Dust | translate3d | 8–26s linear infinite |
| Stack cards depth | static — no animation | — |
| Reel-deck fresh arrival | translateY + brightness | 0.9s ease-out |
| Comets | t advance | 2.4s (linear) end-to-end |
| Comet hot lane | dashoffset | 1.4s linear infinite |
| Oscilloscope wave | per-frame redraw | continuous |
| Oscilloscope amp lerp | factor 0.18/frame toward target | — |
| Hex lit decay | fill + stroke transition | 0.6s ease (snap on at 50ms) |
| Glitch sweep | translateY + opacity | 0.7s ease-out on each stage change |
| Stat slot rollers | translateY | 0.5s cubic-bezier(.4,0,.2,1) |
| Phone scene cycle | sceneIdx % 4 | 1.8s per scene |
| Phone scene fill bar | width 0→100% | 1.8s linear |
| Phone kinetic reveal | translateY + opacity per word | 0.45s ease, 60–70ms stagger |
| Phone particles | translateY -200px + scale | 2.2s ease-out infinite |
| Script card entry | translateX(20→0) + opacity | 0.5s ease-out, 30ms stagger |
| Log line | opacity | 0.2s ease |
| Terminal cursor | opacity blink | 1s steps(2) infinite |

### Reduced motion

Wrap the always-on animations in `@media (prefers-reduced-motion: reduce)`: disable dust drift, brand sheen, source scan, comet trails (keep dot motion), hex pulses (skip lighting), oscilloscope wave (show flat line with amplitude at intensity peaks only), reel fresh flash, phone particles. Use snap transitions for phone scenes (no kinetic per-word reveal — show full text immediately).

---

## Implementation guidance

- The v1 backend contract (SSE stream of `stage` / `post` / `script` / `log` / `end` events) is unchanged. The UI now consumes those same events but renders them very differently — most notably, the `script` arrival should be **animated as a comet's journey** rather than appearing instantly. Buffer post-scraped events into your comet state, let the rAF loop drain them, and trigger the persisted script slot only on comet arrival.
- The whole `App` re-renders at ~60fps during a run (because `comets` state mutates every frame). Wrap `PhonePreview`, `Terminal`, `ConfigPanel`, and individual `ScriptCard`s in `React.memo` (or your framework's equivalent) so they only re-render on relevant prop changes. The pipeline center (`PostStack`, `ReelDeck`, `ScopeCore`, `CometCanvas`) is expected to re-render frequently — that's fine.
- `getPointAtLength` needs the path element mounted before reading. Use a layout effect, not a regular effect.
- The pipe body should be measured at mount (`getBoundingClientRect`) and on resize so the path scales with the panel.
- Keep the file split sensible — in our prototype it's 4 files (shared / stage / sidebar / app). In your codebase, match your usual module conventions.

---

## What stays the same (read v1 README for full detail)

- Header chrome (brand + status pill + icon buttons)
- Configure panel (source card, count dropdown, tone chips, run button, quotas)
- Stage track (4 dots with line separators in the pipe header)
- Stats strip cells (Scraped / Queue / Scripts / Avg duration)
- Run lifecycle stages (`idle` → `scraping` → `parsing` → `generating` → `done`)
- `buildScript()` and `buildLog()` data contracts (extended, not changed)
- Sample data shape (`SAMPLE_POSTS`, `POST_COUNT_OPTIONS`, `TONES`)
- Authentication / scraping backend contract
- Accessibility responsibilities (dropdown ARIA, live regions, focus rings)
- Error state guidance (still undesigned — design before implementing)
