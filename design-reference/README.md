# Handoff: Reelify Dashboard

A high-fidelity, animated dashboard for an agent that scrapes a user's LinkedIn "Saved Posts" via Playwright and turns them into short-form video (reel) scripts. The user picks a post count + tone, runs the pipeline, and watches scraped posts flow through a transform core into generated reel scripts in real time.

---

## About the Design Files

The files in this bundle are **design references created in HTML**. They are prototypes showing the intended look, behavior, and animation — **not production code to copy directly**.

The task is to **recreate this design in the target codebase's existing environment** (React, Next.js, Vue, SwiftUI, etc.) using its established patterns, component library, state management, and styling system.

If the target project has no environment yet, choose a sensible stack — recommended: **React + Vite + Tailwind CSS** (or CSS Modules), with the actual scraping backend in **Node.js + Playwright** and reel-script generation via your LLM of choice.

## Fidelity

**High-fidelity (hifi).** Final colors, typography, spacing, motion, and interaction behavior are all decided. Recreate pixel-perfectly using the codebase's existing libraries and patterns.

---

## Files in this bundle

| File | Purpose |
|---|---|
| `Reelify Dashboard.html` | Entry point — fonts, CSS variables, global styles, layout |
| `app.babel.js` | React component tree, state machine, animations, sample data |

Open `Reelify Dashboard.html` in a browser to see the working prototype.

---

## Layout overview

Three-column grid inside a centered `1440px` max-width container with `22px 28px 28px` padding.

```
┌─────────────────────────────────────────────────────────────────────┐
│ Header: brand · spacer · status pill · bell · gear                  │
├──────────────┬─────────────────────────────────┬────────────────────┤
│              │  Pipeline header + stage track  │ Reel scripts list  │
│  CONFIGURE   │                                 │ (scrollable cards) │
│  - source    │  ┌───────┐  ┌─────┐  ┌────────┐ │                    │
│  - count dd  │  │ POSTS │→ │CORE │ →│ REELS  │ │                    │
│  - tone      │  └───────┘  └─────┘  └────────┘ │                    │
│  - run btn   │                                 ├────────────────────┤
│  - quotas    │  Stats strip (4 cells)          │ Playwright term    │
└──────────────┴─────────────────────────────────┴────────────────────┘
```

Grid: `grid-template-columns: 320px 1fr 380px; gap: 18px`. Collapse to single column below 1180px.

---

## Design Tokens

All defined as CSS custom properties in `Reelify Dashboard.html`. Values use **oklch** for color.

### Colors

| Token | Value | Use |
|---|---|---|
| `--bg` | `oklch(0.16 0.008 70)` | App background (warm near-black) |
| `--bg-2` | `oklch(0.20 0.010 70)` | Panel background |
| `--bg-3` | `oklch(0.24 0.012 70)` | Inset card / control background |
| `--line` | `oklch(0.30 0.012 70)` | Default borders / dividers |
| `--line-2` | `oklch(0.38 0.012 70)` | Stronger borders / control outlines |
| `--fg` | `oklch(0.96 0.012 80)` | Primary text |
| `--fg-2` | `oklch(0.78 0.010 80)` | Secondary text |
| `--fg-3` | `oklch(0.55 0.010 80)` | Muted text / labels |
| `--accent` | `oklch(0.88 0.19 128)` | Electric-lime primary accent |
| `--accent-deep` | `oklch(0.55 0.16 130)` | Deeper accent for gradients/done states |
| `--warn` | `oklch(0.82 0.15 70)` | Warning state |
| `--danger` | `oklch(0.70 0.18 25)` | Error / terminal red dot |

Body gets two radial-gradient highlights layered on top of `--bg`:
- `radial-gradient(1200px 700px at 70% -10%, oklch(0.24 0.04 130 / 0.18), transparent 60%)`
- `radial-gradient(900px 600px at -10% 110%, oklch(0.22 0.02 60 / 0.5), transparent 60%)`

### Typography

| Family | Source | Weights | Use |
|---|---|---|---|
| `Inter` | Google Fonts | 400 / 500 / 600 / 700 | UI, headings, body |
| `Geist Mono` | Google Fonts | 400 / 500 / 600 | Labels, numbers, status, terminal, dropdown values |

Type scale (sizes used):
- Brand name: `18px / 700 / -0.01em`
- Brand sub: `12px / Geist Mono / 0.08em uppercase`
- Panel titles: `11px / Geist Mono / 0.14em uppercase / --fg-3`
- Section labels (`// source`, `// scraped posts`): `10–12px / Geist Mono / 0.16em uppercase / --fg-3`
- Body / card titles: `13–14px / 600`
- Card body text: `12px / 1.35`
- Meta lines: `11px / Geist Mono`
- Stat numbers: `22px / Geist Mono / 600`
- Dropdown selected value: `16px / Geist Mono / 600`
- Terminal: `11px / Geist Mono / line-height 1.55`

### Spacing

| Token | Value | Use |
|---|---|---|
| Container padding | `22px 28px 28px` | App wrapper |
| Grid gap | `18px` | Between columns and stacked right-column panels |
| Panel padding | `18px` (20px x-padding in pipeline header) | Inner panel |
| Card padding | `10–12px` | Post / reel / script cards |
| Gap between stacked elements | `6 / 8 / 10 / 14 / 18px` (no formal scale — these are the values used) |

### Radii

- Panels: `14px`
- Cards / inputs / dropdowns: `10px`
- Inline chips, scene bars, tags, idx badge: `4–8px`
- Status pill: `999px`
- Logo mark: `8px`
- Core bulb / rings: `50%`

### Shadows

- Logo mark: `0 0 0 1px oklch(0.92 0.18 130 / 0.4), 0 6px 24px oklch(0.88 0.19 128 / 0.25)`
- Run button hover: `0 0 0 4px oklch(0.88 0.19 128 / 0.18)`
- Dropdown menu: `0 16px 40px oklch(0 0 0 / 0.5)`
- Core bulb: `0 0 60px oklch(0.88 0.19 128 / 0.25), inset 0 0 30px oklch(0 0 0 / 0.4)`
- Status dot ping: `box-shadow: 0 0 0 0 currentColor` animating to `0 0 0 8px transparent`
- Accent ticks on core ring: `0 0 6px var(--accent)`

---

## Screens / Views

There is **one screen** (the dashboard) with four state phases driven by the `stage` state variable:

| `stage` value | Trigger |
|---|---|
| `idle` | Default / after Stop |
| `scraping` | First phase of a run |
| `parsing` | After ~40% of posts scraped |
| `generating` | After ~70% of posts scraped |
| `done` | All posts processed |

The UI **does not change layout** between phases — only content, animations, and labels update. There is no navigation, no other route.

---

## Components

### 1. Header (`header.top`)

Full-width row, `padding-bottom: 18px`, `border-bottom: 1px solid --line`.

**Children left to right:**
- **Brand block** (`.brand`)
  - `.brand-mark` — `34×34` rounded square with a `linear-gradient(140deg, --accent, --accent-deep)` background and a small play-triangle SVG (size `18×18`, color `oklch(0.18 0.02 130)`) centered. A subtle vertical-line repeating-gradient overlay at `mix-blend-mode: overlay; opacity: 0.6` adds texture.
  - `.brand-name` — "Reelify", `18px / 700`.
  - `.brand-sub` — "saved · posts → reels", `12px Geist Mono` uppercase, `--fg-3`.
- **Spacer** (`flex: 1`).
- **Status pill** (`.status-pill`) — pill-shaped, `--bg-2` background, `1px --line-2` border, `12px Geist Mono` text. Contains a `.status-dot` and dynamic label per stage:
  - `idle`: `"Idle · agent ready"`, neutral dot
  - `scraping`: `"Live · scraping saved posts"`, pulsing accent dot
  - `parsing`: `"Live · parsing content"`, pulsing accent dot
  - `generating`: `"Live · generating scripts"`, pulsing accent dot
  - `done`: `"Run complete · N scripts ready"`, neutral dot
- **Bell icon button** and **Gear icon button** (`.icon-btn`, `34×34`, `8px` radius, `--bg-2` background). Decorative — no menus.

**Pulsing dot animation** (`.status-dot.live`): 1.6s infinite — `box-shadow` ramps from `0 0 0 0 currentColor` (opacity 1) to `0 0 0 8px transparent` (opacity 0.6).

### 2. Configure panel (left column)

Standard panel chrome:
- `background: linear-gradient(180deg, --bg-2, oklch(0.18 0.008 70))`
- `border: 1px solid --line`
- `border-radius: 14px`
- `padding: 18px`

**Panel title row** (`.panel-title`): a `18×18` rounded square with letter `A` + label `"Configure run"`, both `11px Geist Mono / 0.14em uppercase / --fg-3`.

**Source card** — labeled `// source`. `.config-source` row:
- `32×32` icon tile with bookmark SVG, color `--accent`.
- Title `"Saved posts"` (`14px / 600`) + meta `"@you · session ok"` (`11px Geist Mono / --fg-3`).
- Trailing `8×8` pulsing accent dot.

**Post count dropdown** — labeled `// number of posts`. Custom (not native `<select>`):
- Trigger: full-width, `12px 14px` padding, `--bg-3` background, `1px --line-2` border, `10px` radius.
- Value cluster: number in `16px Geist Mono / 600`, then unit + estimate ("posts · ~1m 30s · 2 min") in `12px Geist Mono / --fg-3`.
- Chevron rotates 180° on open (`0.18s ease`).
- Menu: absolutely positioned `6px` below trigger, `--bg-2`-ish background `oklch(0.22 0.010 70)`, max height `240px`, scrollable. Each `.dd-opt` row: post count (right-aligned digit) + estimate. Hover → `--bg-3` background. Selected → `--accent` text.
- Options: `[5, 10, 15, 25, 50, 100]` with estimates listed in `app.babel.js`'s `POST_COUNT_OPTIONS` array.
- Closes on outside click (mousedown on document).
- Disabled while a run is in progress.

**Tone chips** — labeled `// reel tone`. 2×2 grid (`grid-template-columns: 1fr 1fr; gap: 6px`):
- Options: `["Punchy", "Story-led", "Analytical", "Educational"]`
- Default chip: `--bg-3` background, `1px --line-2`, `12px Geist Mono / --fg-2`.
- Selected: background `oklch(0.30 0.04 130 / 0.35)`, border `--accent`, text `--accent`.
- Disabled during run.

**Run button** (`.run-btn`):
- Idle / done state: `background: --accent`, text `oklch(0.18 0.03 130)` (dark on lime), `14px / 700 / 0.02em`.
- Content: spark icon + label `"Run pipeline"` (or `"Run again"` after a successful run).
- Hover: outer ring shadow `0 0 0 4px oklch(0.88 0.19 128 / 0.18)`.
- Active: `transform: translateY(1px)`.
- Running state: same shape, but replaces icon with a 14×14 spinning circle (2px accent border, right side transparent, `0.7s linear infinite`) and label becomes `"Stop run"`.

**Quotas** — `padding-top: 14px; border-top: 1px dashed --line-2`. Two cells in a 2-col grid:
- "Credits" → `214` with a 62%-filled bar.
- "Storage" → `1.4gb` with a 28%-filled bar.
- Bar: `4px` tall, `--bg-3` background, `--accent` fill, `2px` radius. **Decorative — these don't reflect real state.**

### 3. Transform pipeline panel (center)

Panel uses `padding: 0` and `overflow: hidden` because it has its own internal sections.

**Pipe header** (`padding: 18px 20px; border-bottom: 1px solid --line`):
- Left: label "B · Transform pipeline".
- Right: **Stage track** — 4 dots labeled `01 · Scrape`, `02 · Parse`, `03 · Generate`, `04 · Ready`, separated by `14px × 1px` lines. Per stage:
  - Default: `6×6` dot `--line-2`, text `--fg-3`.
  - Active (current stage): dot `--accent` with `0 0 8px --accent` glow, text `--fg`.
  - Done (past stages): dot `--accent-deep`, text `--fg-2`.

**Pipe body** — `height: 460px; display: grid; grid-template-columns: 1fr 280px 1fr`. A faint dot/grid pattern is layered as `::before` using two linear-gradients at `32px` spacing, radial-masked to fade out at the edges, `opacity: 0.25`.

**Left column (`.pipe-col.left`)** — labeled `// scraped posts`, top-left.
- Up to 4 visible `.post-card` rows stacked with `gap: 10px`, vertically centered.
- Each card: `--bg-3` background, `1px --line-2`, `10px` radius, `10–12px` padding. Contains a `28×28` round avatar (linear-gradient from `oklch(0.55 0.10 H)` to `oklch(0.40 0.06 H)` with hue `H` set via the `--h` custom property per post) and two text lines: meta (`11px Geist Mono / --fg-3`) and body (`12px / --fg-2`, truncated to 82 chars + ellipsis).
- During a run, the topmost card animates out via class `.flying` → `transform: translateX(80%); opacity: 0` over `0.6s cubic-bezier(.7,0,.3,1)` and a new card is pushed onto the bottom. Cards further down the stack get class `.staged` and drop to `opacity: 0.35`.

**Center column (`.core-wrap`)** — the animated transform core. Contains:
- 4 nested `.ring` divs (concentric circles): outer (full bounds), `.r1` (inset 20px), `.r2` (inset 50px, dashed), `.r3` (inset 80px). Each ring is a thin `1px --line-2` border at 50% radius.
- `.ring.spin1` rotates `360deg` over `18s linear infinite`. `.spin2` rotates the opposite direction over `14s`. `.spin3` over `10s`. The outermost ring also carries 4 small ticks on its perimeter: a `2×8px` accent tick with `0 0 6px --accent` glow at top, and three neutral ticks at bottom/left/right.
- `<Particles>` SVG layer (240×240 absolute) with 9 circles orbiting the center. Each circle has a random phase, radius (50–100), and speed (0.4–1.0). Updated each animation frame: position `(cx + cos(a)·r, cy + sin(a)·r·0.95)` where `a = phase + dt · speed · (running ? 1.2 : 0.25)`. Opacity `0.85` when running, `0.35` when idle. Color `--accent` with `drop-shadow(0 0 4px --accent)`.
- `.core-bulb` — `110×110` circle at the center. Background is a layered radial gradient (highlight at 30% 30% in light accent, secondary at 70% 70% in deep accent, base `oklch(0.22 0.02 130)`). Inner shadow `inset 0 0 30px oklch(0 0 0 / 0.4)`. A `::before` pseudo-element with a 1px accent ring animates from `scale(0.7)` opacity 0.9 to `scale(1.4)` opacity 0 over 3s infinite.
- Inside the bulb: a glyph block — a large symbol (`✓`, `↯`, or `—`) at `22px / 700 / --fg` followed by a state label at `11px Geist Mono / 0.08em uppercase / --accent` with a text-shadow glow. Labels: `STANDBY` (idle), `SCRAPING`, `PARSING`, `REELIFY` (during generating), `READY` (done).

**Connector lines** (`.connector` SVG absolute over the whole pipe body):
- Five curved bezier paths from the left edge (`x = -20`, varying y) curving into the center, plus five from the center curving out to the right.
- Base style: `stroke: oklch(0.35 0.02 70); stroke-width: 1.2; stroke-dasharray: 4 4`.
- During a run, an overlay set of the same paths uses `--accent` with `stroke-dasharray: 6 8`, `stroke-width: 1.6`, `drop-shadow(0 0 4px accent)`. The `stroke-dashoffset` animates from 0 to `-28` over `1.4s linear infinite` (creating the flowing-current effect). Each path gets a `0.08s` staggered animation-delay.

**Right column (`.pipe-col.right`)** — labeled `// generated reels`, top-right. Up to 4 most-recent reel preview cards, right-aligned. Each card (`.reel-card`):
- `220px` wide, `--bg-3` background, `1px --line-2`, `12px` radius, `10px` padding.
- `.reel-thumb` — `40×56` portrait-orientation thumbnail with a linear-gradient (per-hue, mirroring the source post's color), repeating horizontal-line overlay at `mix-blend-mode` for a "video frame" texture, and a centered play triangle (14×14 icon, white at 0.85 alpha).
- Title (`12px / 600`) and a meta row (`10px Geist Mono`) with duration (bold accent) and scene count.
- Entry transition: starts at `opacity: 0; transform: translateX(-30%)`, transitions to `in` state over `0.5–0.6s ease`. Staggered by index (`transitionDelay: i * 50ms`).

**Stats strip** (`.pipe-stats`, `border-top: 1px solid --line`): 4 equal cells separated by `1px --line` verticals.
- "Scraped" — current / total (animated counter, eased over 600ms via cubic-out).
- "In queue" — `total - scraped`.
- "Scripts" — count, plus a `+N` delta in `--accent` when running.
- "Avg duration" — average reel duration in seconds.

All numbers ease in via the `useCounter(target, durMs=600)` hook in `app.babel.js`.

### 4. Reel scripts panel (right column, top)

Panel title "C · Reel scripts" + a mono `"N ready"` count on the right.

**Empty state** (`.empty-state`):
- "No scripts yet" label in `11px Geist Mono / 0.16em uppercase / --fg-2`.
- Subtext: `Press <accent>Run pipeline</accent> to generate from saved posts.`

**Script list** (`.results-list`):
- Vertical stack with `gap: 10px`, `max-height: 360px`, custom scrollbar (`6px` wide, `--line-2` thumb, `3px` radius).

**Script card** (`.script-card`):
- `--bg-3` background, `1px --line-2`, `10px` radius, `12px` padding.
- Entry animation: `opacity: 0 → 1` and `translateY(8px) → 0` over `0.45s cubic-bezier(.4,0,.2,1)`, staggered by index up to 5 (`i * 40ms`).
- **Row 1**: 22×22 index badge (`.idx`, `oklch(0.30 0.04 130 / 0.5)` background, accent text, `11px Geist Mono / 600`) with zero-padded number — then title (`13px / 600`, flex-1) — then duration pill (`.dur`, `10px Geist Mono`, `--bg` background, `1px --line-2`, `4px` radius, padding `2px 6px`).
- **Hook block** (`.hook`): the post's opening sentence wrapped in quotes. `11px / italic / --fg-2 / line-height 1.4`. Background `oklch(0.20 0.01 70)`, left border `2px solid --accent`, padded `8px 10px`, radius `0 6px 6px 0`.
- **Scene bars** (`.scenes`): `display: flex; gap: 2px; margin-top: 8px`. One `.scene-bar` per scene (4–6 scenes per script). Each: `flex: 1`, `height: 3px`, `--bg` track, `2px` radius. First bar gets `.hl` class with `--accent` fill; the rest fill with `--accent-deep`. Widths vary per scene to suggest different scene lengths.
- **Tags row** (`.tags`): wrap-flex `gap: 4px`. Tags include `#<tone>` plus 3 tone-specific tags from a small map (see below). Each tag: `10px Geist Mono / --fg-3`, `1px --line-2` border, `4px` radius, padding `2px 6px`.

### 5. Playwright terminal (right column, bottom)

Panel uses `padding: 0`, `height: 200px`, `overflow: hidden`.

**Terminal head** (`.terminal-head`):
- 3 traffic-light dots (`8×8` each, colors: red `oklch(0.65 0.18 25)`, amber `oklch(0.78 0.14 80)`, green `oklch(0.70 0.15 145)`).
- Label `"playwright · agent.log"`, `10px Geist Mono / 0.14em uppercase / --fg-3`.
- Right: `"N lines"` count.

**Terminal body** (`.terminal-body`):
- Padding `10px 14px`, `11px Geist Mono / line-height 1.55`.
- Auto-scrolls to bottom on every new log line.
- Idle state: `$ reelify --watch` followed by a blinking accent cursor (`7×12px` block, `1s steps(2)` blink).
- Log lines (`.log-line`) animate in via `opacity 0 → 1 over 0.2s`. Each line has 3 columns:
  - Timestamp (`HH:MM:SS.cs`, `--fg-3`)
  - Tag (`[boot]`, `[auth]`, …) — colored by level: info = `oklch(0.75 0.10 230)` (blue), ok = `--accent`, warn = amber. Fixed `60px` width.
  - Message — `--fg`. `<em>` inline spans render in `--fg-3` (no italic) for de-emphasized values.

**Log script** for a run (in order):
1. `[boot]` `spawn chromium v124.0 · headless`
2. `[auth]` `restoring session cookie li_at · *****`
3. `[nav]`  `goto /my-items/saved-posts`
4. `[wait]` `waitFor [data-id=feed-list] · 412ms`
5. `[scroll]` `autoscroll to load n={count}`
6. `[parse]` `extracted {count} posts · dedup ok`
7. `[embed]` `embedding hooks · model e5-mistral`
8. `[rank]` `ranked by virality · σ=0.71`
9. `[gen]` `generating scripts · tone={tone}`
10. `[write]` `wrote {count} reel scripts to /out`
11. `[done]` `pipeline complete · idle`

These are illustrative only — the real backend will emit its own. Treat the schema (timestamp · tag · level · message) as the contract.

---

## Interactions & Behavior

### Run pipeline (primary CTA)

1. User picks count + tone, clicks **Run pipeline**.
2. State sets to `scraping`. Log lines 1–5 stream in with `120–280ms` gaps between them.
3. A loop runs `count` iterations:
   - Each iteration adds a new post card on the left and increments `scrapedCount`.
   - The topmost card animates out via the `.flying` class.
   - Delay between iterations: `90 + random*70 ms`.
   - At 40% progress → `stage = 'parsing'`, push log line 6.
   - At 70% progress → `stage = 'generating'`, push log lines 7–9.
   - Starting at 50% progress, each iteration also emits a script card (added to the **top** of the right-side script list).
4. After the loop, push log lines 10–11 and set `stage = 'done'`.

The state machine lives in the `startRun` callback in `app.babel.js`. Implement equivalently — but **swap the simulated loop for real Playwright + LLM calls** in your backend, streaming events over WebSocket / SSE / polling.

### Stop / Run again

- Clicking **Stop run** while running calls `stop()` which resets `stage` to `idle`, clears scripts and log lines.
- After `done`, the button label becomes "Run again" and re-runs from scratch.

### Hover / focus states

- `.icon-btn` hover: text becomes `--fg`, border becomes `--accent`.
- `.dd-trigger` hover: no visible change (cursor only).
- `.dd-opt` hover: background `--bg-3`, text `--fg`.
- `.tone-chip` hover: text `--fg` (no other change unless selected).
- `.run-btn` hover: outer ring shadow (see Shadows section).
- `.run-btn` active: `translateY(1px)`.

### Responsive

At `≤ 1180px` the grid collapses to a single column. The pipeline body's fixed 460px height should be preserved on desktop; consider reducing it or making the center column scroll on mobile. The current prototype is desktop-first — refine mobile in the target framework.

---

## State Management

In the prototype (React `useState`):

| State | Type | Drives |
|---|---|---|
| `count` | `number` (5/10/15/25/50/100) | Post count selector |
| `tone` | `string` | Tone chip selection |
| `stage` | `'idle' \| 'scraping' \| 'parsing' \| 'generating' \| 'done'` | Status pill, stage track, core glyph, run button label |
| `posts` | array of `{id, author, role, body, h, _key}` | Left column post cards (max 4 visible) |
| `scripts` | array of `{id, title, hook, dur, sceneCount, tags, _animIdx}` | Right column reel cards (top 4) + script list (all) |
| `logLines` | array of `{tag, level, msg, t}` | Terminal |
| `scrapedCount` | `number` | Stats: Scraped + In queue counters |
| `errors` | `number` | Reserved for error count (not currently surfaced) |

In production:
- Replace `useState` with whatever state lib the codebase uses (Redux, Zustand, MobX, signals, etc.).
- Replace the simulated loop with a **server-sent event stream** from the backend that emits `post:scraped`, `script:generated`, `stage:changed`, and `log:line` events. The UI subscribes and updates the same state slots.
- Persist run history server-side so the user can revisit past runs.

### Suggested backend contract

```
POST /api/runs
  body: { count: number, tone: string }
  returns: { runId: string }

GET /api/runs/:runId/stream  (SSE)
  events:
    stage      data: { stage: 'scraping' | 'parsing' | 'generating' | 'done' }
    post       data: { id, author, role, body, h }
    script     data: { id, title, hook, dur, sceneCount, tags, body }
    log        data: { t, tag, level, msg }
    error      data: { code, message }
    end        data: { totalScripts: number, ms: number }

GET /api/runs/:runId           returns the complete record (for reload)
DELETE /api/runs/:runId        stop / cleanup
```

---

## Animations & Transitions (summary)

| Element | Property | Duration / Easing |
|---|---|---|
| `.status-dot.live` | box-shadow ping | `1.6s ease-out infinite` |
| `.icon-btn`, chips, dropdown chev | colors, rotate | `0.12–0.18s ease` |
| Run-button hover ring | box-shadow | `0.2s ease` |
| Run-button spinner | rotate | `0.7s linear infinite` |
| `.post-card.flying` | translate + opacity | `0.6s cubic-bezier(.7,0,.3,1)` |
| `.reel-card.in` | translateX + opacity | `0.5–0.6s ease`, staggered `i * 50ms` |
| `.script-card` entry | translateY + opacity | `0.45s cubic-bezier(.4,0,.2,1)`, staggered `i * 40ms` |
| `.ring.spin1/2/3` | rotate | `18s / 14s / 10s linear infinite` |
| `.core-bulb::before` | scale + opacity ring | `3s ease-out infinite` |
| `.connector path.live` | dashoffset | `1.4s linear infinite`, staggered |
| Particles orbit | x/y per frame | requestAnimationFrame |
| `.log-line` | opacity in | `0.2s ease` |
| Terminal cursor | opacity | `1s steps(2) infinite` |
| Stat numbers | eased count-up | `600ms cubic-out` |

Respect `prefers-reduced-motion` in production: disable the orbiting particles, ring rotations, dashed-line motion, and pulse rings; reduce card-entry transitions to instant or simple cross-fades.

---

## Sample data

`SAMPLE_POSTS` in `app.babel.js` is an array of 12 fake posts (author, role, body) used both as placeholder content and to seed the run loop. Replace with real scraped data. Each post also has an `h` hue value (0–360) used to vary card avatar / reel thumbnail colors so the lineup doesn't look monotone — preserve this in real data (derive a stable hue from the author name or post ID).

`POST_COUNT_OPTIONS` defines the dropdown values and their estimated read-times.

`TONES` defines the 4 tone chips.

`buildScript(post, tone, idx)` builds a fake script object from a post — replace with the real LLM call result. Keep the same shape:
```ts
{
  id: number,
  title: string,        // "Author — Role"
  hook: string,         // opening quote, ≤ 90 chars + ellipsis
  dur: number,          // seconds (15–60 typical)
  sceneCount: number,   // 4–6
  tags: string[],       // ["#tone", "#kw1", "#kw2", "#kw3"]
}
```

Tag pool by tone:
```js
{
  Punchy:        ["#hook", "#shortform", "#snap"],
  "Story-led":   ["#story", "#arc", "#voiceover"],
  Analytical:    ["#data", "#insight", "#proof"],
  Educational:   ["#teach", "#breakdown", "#tutorial"],
}
```

---

## Assets

No external assets, images, or third-party icons are used. All icons are inline SVGs defined in the `Ico` object inside `app.babel.js`:

- `bookmark` — source-card icon
- `play` — reel thumbnail centerpiece + brand mark glyph
- `chev` — dropdown chevron
- `spark` — run button icon
- `gear`, `bell` — header icon-buttons

You can swap these for your icon library (Lucide, Heroicons, etc.) — they were chosen to be 1-to-1 with common icon sets.

---

## Notes for the implementer

- **Do not recreate LinkedIn UI or branding.** The design intentionally uses a neutral bookmark icon and the generic phrase "Saved posts" — this is a third-party agent that reads from a LinkedIn session, not LinkedIn itself. Keep brand chrome neutral.
- The **simulated run loop is for demo only.** Wire real Playwright (Node) on the backend; the front-end's job is to render the streamed events.
- Authentication: the prototype shows a session-cookie phrase (`li_at · *****`). In reality the user will need to either paste a session cookie, OAuth in, or run a managed login flow inside the agent — pick whichever pattern fits the product, but reflect its state in the source card's `meta` line and trailing status dot.
- **Accessibility:** the custom dropdown uses `role="listbox"` / `role="option"` / `aria-haspopup` / `aria-selected`. Add full keyboard nav (↑/↓/Enter/Esc) in production. Buttons all have visible focus rings by default in most frameworks — ensure parity. The status pill and stage track should be announced as live regions during a run.
- **Error states are not designed.** If the scraper fails (no session, rate limit, network), surface the error inside the terminal with `level: 'warn'` and a red status dot, and add an inline banner above the run button. Ask design for those screens if needed.
- **Persistence:** consider storing the most recent run in localStorage or server-side so a refresh during a long run resumes the stream rather than starting over.
