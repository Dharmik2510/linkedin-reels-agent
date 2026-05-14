# Reelify Dashboard v2 — Cinematic Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the full v2 cinematic-pipeline redesign to the existing v1 React/TypeScript frontend in a single cutover — new layout, hex grid, comet engine, oscilloscope, 3D stacks, phone preview, slot counters, glitch sweep, ambient dust, full-width terminal, compact script cards — while keeping the real SSE backend stream as the data source and gating script arrival on comet landing.

**Architecture:** Extend the existing `useReducer` store with comet/landed/pending-script sub-state. A single rAF engine batches comet position updates into one `COMET_FRAME` action per frame. SSE events drive comet spawns; scripts are buffered until their comet lands. Each visual is its own focused component under `frontend/src/components/`, sharing tokens via CSS Modules.

**Tech Stack:** React 18, TypeScript, CSS Modules (existing). No new dependencies. No new test framework — verification is `tsc --noEmit && vite build` + manual browser smoke test per the spec.

**Spec:** `docs/superpowers/specs/2026-05-13-v2-cinematic-pipeline-design.md`

**Visual reference:** `design_handoff_reelify_dashboard_v2/Reelify Dashboard v2.html` + `v2-*.babel.js`. Open the HTML in a browser for behaviour reference; **do not** copy code shapes — recreate idiomatically in React + TypeScript + CSS Modules.

**Note on testing:** This codebase has no automated test framework. The spec calls for manual verification only. Each task ends with `npm run build` (or `tsc --noEmit`) + an explicit visual check in `npm run dev`. Don't add a test framework as part of this work.

---

## Task ordering rationale

Implementation order is foundations → chrome → pipeline → sidebar → integration:

1. **Foundations (1–6):** tokens, types, store, hooks, utils. Nothing renders differently yet but typechecks clean and the store is v2-shaped.
2. **Chrome (7–10):** dust, header, configure-panel polish, new grid + terminal-strip layout. Page should look "v2-ish" with v1 pipeline core still in the middle.
3. **Pipeline rebuild (11–19):** replace the rotating-rings Core with the cinematic stage piece-by-piece, wiring the engine.
4. **Sidebar (20–22):** PhonePreview, compact ScriptsPanel, and the right-column structure.
5. **Terminal & cleanup (23–25):** full-width terminal, App.tsx wiring, deletions, final smoke test.

Between milestones the page should still build and run, even if some sections are visibly half-cooked.

---

## Task 1: New CSS tokens + body background

**Files:**
- Modify: `frontend/src/styles/tokens.css`

- [ ] **Step 1: Update tokens**

Replace the file contents with:

```css
:root {
  color-scheme: dark;

  --bg:        oklch(0.15 0.008 70);
  --bg-2:      oklch(0.19 0.010 70);
  --bg-3:      oklch(0.23 0.012 70);
  --bg-4:      oklch(0.27 0.013 70);
  --line:      oklch(0.30 0.012 70);
  --line-2:    oklch(0.38 0.012 70);
  --fg:        oklch(0.97 0.012 80);
  --fg-2:      oklch(0.78 0.010 80);
  --fg-3:      oklch(0.55 0.010 80);
  --accent:      oklch(0.88 0.19 128);
  --accent-2:    oklch(0.78 0.16 130);
  --accent-deep: oklch(0.50 0.14 130);
  --cyan:        oklch(0.82 0.10 220);
  --warn:        oklch(0.82 0.15 70);
  --danger:      oklch(0.70 0.18 25);
  --info:        oklch(0.75 0.10 230);

  --radius-panel: 16px;
  --radius-card: 10px;
  --radius-chip: 4px;
  --radius-pill: 999px;
}

* { box-sizing: border-box; }

html, body, #root {
  margin: 0;
  padding: 0;
  min-height: 100vh;
}

body {
  background:
    radial-gradient(1100px 700px at 75% -15%, oklch(0.30 0.06 130 / 0.16), transparent 65%),
    radial-gradient(900px 600px at -10% 115%, oklch(0.22 0.03 60 / 0.5), transparent 65%),
    radial-gradient(500px 400px at 50% 50%, oklch(0.20 0.02 130 / 0.30), transparent 70%),
    var(--bg);
  color: var(--fg);
  font-family: "Inter", system-ui, sans-serif;
  font-feature-settings: "cv11", "ss01";
  overflow-x: hidden;
}

.mono {
  font-family: "Geist Mono", ui-monospace, monospace;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}
```

The notable changes from v1: `--bg` nudged to 0.15, `--bg-2`/`--bg-3` slightly nudged, added `--bg-4`, `--accent-2`, `--cyan`, third body radial gradient at 50/50, panel radius bumped to 16 px.

- [ ] **Step 2: Verify build**

Run: `cd frontend && npm run build`

Expected: passes. The new tokens are unused by other selectors yet; no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/styles/tokens.css
git commit -m "feat(v2): new design tokens + ambient body gradient

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Type definitions for v2 state

**Files:**
- Modify: `frontend/src/types.ts`

- [ ] **Step 1: Extend types**

Replace `frontend/src/types.ts` with:

```ts
export type Tone = "Punchy" | "Story-led" | "Analytical" | "Educational";

export type Stage = "idle" | "scraping" | "parsing" | "generating" | "done";

export interface Post {
  id: string;
  author: string;
  role: string;
  body: string;
  h: number;
  postIndex: number;
}

export interface Script {
  id: string;
  postIndex: number;
  title: string;
  hook: string;
  dur: number;
  sceneCount: number;
  tags: string[];
  body: string;
  author: string;
  role: string;
  initials: string;
  h: number;
  keywords: string[];
}

export interface LogLine {
  t: string;
  tag: string;
  level: "info" | "ok" | "warn";
  msg: string;
}

export interface Comet {
  id: number;
  postIndex: number;
  t: number;          // 0..1 along the path
  born: number;       // performance.now() at spawn
  label: string;      // e.g. "MO"
  hue: number;        // 0..360
}

// Raw backend event shape (unchanged from v1).
export interface RawEvent {
  type: string;
  agent: string;
  message: string;
  payload: Record<string, unknown>;
  timestamp: string;
}
```

`Post` and `Script` now carry `postIndex`. `Script` also has `author`, `role`, `initials`, `h`, and `keywords` (everything `PhonePreview` needs to render its 4 scenes).

- [ ] **Step 2: Verify typecheck fails**

Run: `cd frontend && npx tsc --noEmit`

Expected: fails — the existing `derivePost` / `deriveScript` in `state/store.tsx` don't produce the new required fields yet. That's expected. Note the errors for Task 3.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types.ts
git commit -m "feat(v2): extend Post/Script types with v2 fields, add Comet type

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

(Yes, commit even though the build doesn't pass yet — Task 3 will fix the store and the next commit lands the working pair. This keeps the diff readable.)

---

## Task 3: Store — comet/landed/pendingScripts sub-state + new reducer branches

**Files:**
- Modify: `frontend/src/state/store.tsx`

- [ ] **Step 1: Rewrite the store**

Replace `frontend/src/state/store.tsx` with:

```tsx
import {
  createContext, useContext, useEffect, useMemo, useReducer, useRef,
  type ReactNode,
} from "react";
import { subscribe } from "../api";
import type {
  Comet, LogLine, Post, RawEvent, Script, Stage, Tone,
} from "../types";

interface RunState {
  count: number;
  tone: Tone;
  stage: Stage;
  posts: Post[];                          // rolling buffer, last 6
  scripts: Script[];                      // visible scripts (gated on comet landing)
  logLines: LogLine[];
  scrapedCount: number;
  totalPosts: number;

  // v2 additions
  comets: Comet[];
  landed: Set<number>;                    // post indices whose comet has landed but script not yet seen
  pendingScripts: Map<number, Script>;    // scripts received but comet hasn't landed yet
  intensity: number;
  elapsedStart: number | null;
  glitch: number;
  activeScriptId: string | null;
}

export type Action =
  | { type: "SET_COUNT"; n: number }
  | { type: "SET_TONE"; tone: Tone }
  | { type: "RESET" }
  | { type: "EVENT"; ev: RawEvent }
  | { type: "STREAM_ERROR" }
  | { type: "COMET_FRAME"; ticks: { id: number; t: number }[]; landed: number[]; intensityBump: boolean }
  | { type: "SET_ACTIVE_SCRIPT"; id: string | null };

const initial: RunState = {
  count: 10,
  tone: "Punchy",
  stage: "idle",
  posts: [],
  scripts: [],
  logLines: [],
  scrapedCount: 0,
  totalPosts: 0,
  comets: [],
  landed: new Set(),
  pendingScripts: new Map(),
  intensity: 0,
  elapsedStart: null,
  glitch: 0,
  activeScriptId: null,
};

function hashHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .join("")
    .slice(0, 2);
}

function timeStamp(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const cs = String(Math.floor(d.getMilliseconds() / 10)).padStart(2, "0");
  return `${hh}:${mm}:${ss}.${cs}`;
}

let cometIdSeq = 0;
function nextCometId(): number {
  cometIdSeq += 1;
  return cometIdSeq;
}

function derivePost(raw: RawEvent): Post | null {
  const p = raw.payload?.post as Record<string, unknown> | undefined;
  if (!p) return null;
  const postIndex = Number(raw.payload?.index ?? -1);
  if (postIndex < 0) return null;
  const author = String(p.author ?? "Unknown");
  const text = String(p.text_content ?? "");
  return {
    id: `post-${postIndex}`,
    postIndex,
    author,
    role: "saved post",
    body: text.length > 82 ? text.slice(0, 80) + "…" : text,
    h: hashHue(author),
  };
}

function deriveScript(raw: RawEvent): Script | null {
  const s = raw.payload?.script as Record<string, unknown> | undefined;
  if (!s) return null;
  const postIndex = Number(raw.payload?.post_index ?? -1);
  if (postIndex < 0) return null;
  const body = String(s.script ?? "");
  const hook = String(s.hook ?? "");
  const author = String((raw.payload?.post as Record<string, unknown> | undefined)?.author ?? "Unknown");
  const role = String((raw.payload?.post as Record<string, unknown> | undefined)?.role ?? "saved post");
  const wordCount = body.split(/\s+/).filter(Boolean).length;
  const dur = Math.max(15, Math.min(60, Math.round(wordCount / 2.5)));
  const sceneCount = Math.max(3, Math.min(6, body.split(/\n/).filter(Boolean).length || 4));
  const hashtags = (s.hashtags as string[] | undefined) ?? [];
  const keywords = (body.match(/\b[A-Z][a-z]+\b/g) ?? []).slice(0, 2);
  return {
    id: `script-${postIndex}`,
    postIndex,
    title: hook.length > 60 ? hook.slice(0, 58) + "…" : hook,
    hook: `"${hook}"`,
    dur,
    sceneCount,
    tags: hashtags.slice(0, 4).map((t) => `#${t.replace(/^#/, "")}`),
    body,
    author,
    role,
    initials: initials(author),
    h: hashHue(author),
    keywords,
  };
}

function logFromEvent(raw: RawEvent): LogLine | null {
  const t = timeStamp(raw.timestamp);
  switch (raw.type) {
    case "orchestrator_start":   return { t, tag: "boot",   level: "info", msg: raw.message };
    case "scraper_login":         return { t, tag: "auth",   level: "info", msg: raw.message };
    case "scraper_verification":  return { t, tag: "auth",   level: "warn", msg: raw.message };
    case "scraper_navigating":    return { t, tag: "nav",    level: "info", msg: raw.message };
    case "scraper_scrolling":     return { t, tag: "scroll", level: "info", msg: raw.message };
    case "scraper_done":          return { t, tag: "parse",  level: "ok",   msg: raw.message };
    case "post_scraped":          return { t, tag: "post",   level: "info", msg: raw.message };
    case "content_generating":    return { t, tag: "gen",    level: "info", msg: raw.message };
    case "content_ready":         return { t, tag: "write",  level: "ok",   msg: raw.message };
    case "content_error":         return { t, tag: "gen",    level: "warn", msg: raw.message };
    case "orchestrator_complete": return { t, tag: "done",   level: "ok",   msg: raw.message };
    case "error":                 return { t, tag: "err",    level: "warn", msg: raw.message };
    case "stage_changed":         return null;
    default:                      return { t, tag: raw.agent.slice(0, 6), level: "info", msg: raw.message };
  }
}

function emptyV2Slice(): Pick<RunState, "comets" | "landed" | "pendingScripts" | "intensity" | "glitch" | "activeScriptId"> {
  return {
    comets: [],
    landed: new Set(),
    pendingScripts: new Map(),
    intensity: 0,
    glitch: 0,
    activeScriptId: null,
  };
}

function commitScript(state: RunState, script: Script): RunState {
  return {
    ...state,
    scripts: [script, ...state.scripts].slice(0, 50),
  };
}

function reducer(state: RunState, action: Action): RunState {
  switch (action.type) {
    case "SET_COUNT": return { ...state, count: action.n };
    case "SET_TONE":  return { ...state, tone: action.tone };

    case "RESET":
      return {
        ...state,
        stage: "idle",
        posts: [],
        scripts: [],
        logLines: [],
        scrapedCount: 0,
        totalPosts: 0,
        elapsedStart: null,
        ...emptyV2Slice(),
      };

    case "SET_ACTIVE_SCRIPT":
      return { ...state, activeScriptId: action.id };

    case "EVENT": {
      const { ev } = action;
      const log = logFromEvent(ev);
      const withLog: RunState = log
        ? { ...state, logLines: [...state.logLines, log].slice(-200) }
        : state;

      switch (ev.type) {
        case "orchestrator_start": {
          const total = Number(ev.payload?.num_posts ?? state.count);
          return {
            ...withLog,
            stage: "scraping",
            scrapedCount: 0,
            totalPosts: total,
            posts: [],
            scripts: [],
            elapsedStart: performance.now(),
            ...emptyV2Slice(),
          };
        }

        case "stage_changed": {
          const stage = String(ev.payload?.stage ?? "idle") as Stage;
          return { ...withLog, stage, glitch: state.glitch + 1 };
        }

        case "post_scraped": {
          const post = derivePost(ev);
          if (!post) return withLog;
          const comet: Comet = {
            id: nextCometId(),
            postIndex: post.postIndex,
            t: 0,
            born: performance.now(),
            label: initials(post.author),
            hue: post.h,
          };
          const trimmed = withLog.posts.length >= 6 ? withLog.posts.slice(1) : withLog.posts;
          return {
            ...withLog,
            scrapedCount: withLog.scrapedCount + 1,
            posts: [...trimmed, post],
            comets: [...withLog.comets, comet],
          };
        }

        case "content_ready": {
          const script = deriveScript(ev);
          if (!script) return withLog;
          // If the comet has already landed, commit the script now.
          if (withLog.landed.has(script.postIndex)) {
            const nextLanded = new Set(withLog.landed);
            nextLanded.delete(script.postIndex);
            return commitScript({ ...withLog, landed: nextLanded }, script);
          }
          // Otherwise buffer it.
          const nextPending = new Map(withLog.pendingScripts);
          nextPending.set(script.postIndex, script);
          return { ...withLog, pendingScripts: nextPending };
        }

        case "orchestrator_complete":
          return { ...withLog, stage: "done", glitch: state.glitch + 1 };

        default:
          return withLog;
      }
    }

    case "STREAM_ERROR": {
      const t = (new Date()).toLocaleTimeString("en-GB", { hour12: false });
      const log: LogLine = {
        t, tag: "stream", level: "warn",
        msg: "SSE connection lost — backend may be offline",
      };
      return {
        ...state,
        stage: state.stage === "idle" || state.stage === "done" ? state.stage : "idle",
        logLines: [...state.logLines, log].slice(-200),
      };
    }

    case "COMET_FRAME": {
      const tickMap = new Map<number, number>();
      for (const x of action.ticks) tickMap.set(x.id, x.t);
      const landedSet = new Set(action.landed);

      let next: RunState = state;
      // 1. drop landed comets; commit/queue their scripts
      if (landedSet.size > 0) {
        const survivors: Comet[] = [];
        let nextLanded = next.landed;
        let nextPending = next.pendingScripts;
        let toCommit: Script[] = [];
        for (const c of next.comets) {
          if (landedSet.has(c.id)) {
            const pending = nextPending.get(c.postIndex);
            if (pending) {
              if (nextPending === next.pendingScripts) nextPending = new Map(nextPending);
              nextPending.delete(c.postIndex);
              toCommit.push(pending);
            } else {
              if (nextLanded === next.landed) nextLanded = new Set(nextLanded);
              nextLanded.add(c.postIndex);
            }
          } else {
            survivors.push(c);
          }
        }
        next = { ...next, comets: survivors, landed: nextLanded, pendingScripts: nextPending };
        for (const s of toCommit) next = commitScript(next, s);
      }

      // 2. apply per-comet t updates
      if (tickMap.size > 0) {
        next = {
          ...next,
          comets: next.comets.map((c) => {
            const nt = tickMap.get(c.id);
            return nt === undefined ? c : { ...c, t: nt };
          }),
        };
      }

      // 3. intensity bump
      if (action.intensityBump) {
        next = { ...next, intensity: next.intensity + 1 };
      }

      return next;
    }

    default:
      return state;
  }
}

interface StoreCtx {
  state: RunState;
  dispatch: React.Dispatch<Action>;
}

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    sourceRef.current = subscribe(
      (m) => {
        try {
          const ev = JSON.parse(m.data) as RawEvent;
          dispatch({ type: "EVENT", ev });
        } catch {
          /* keep-alive comment frame */
        }
      },
      () => dispatch({ type: "STREAM_ERROR" }),
    );
    return () => sourceRef.current?.close();
  }, []);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}
```

Key behaviours encoded:
- `post_scraped` spawns a comet but **doesn't** add a visible script.
- `content_ready` commits immediately if the corresponding comet already landed; otherwise buffers in `pendingScripts`.
- `COMET_FRAME` drops landed comets and either commits their pending script or marks `landed`.
- `RESET` and `orchestrator_start` clear the v2 sub-state.
- `stage_changed` and `orchestrator_complete` increment `glitch` for sweep replay.

- [ ] **Step 2: Verify typecheck passes**

Run: `cd frontend && npx tsc --noEmit`

Expected: passes. (The existing v1 components still consume the same `state.posts` / `state.scripts` shape; the added fields are non-breaking.)

- [ ] **Step 3: Verify build**

Run: `cd frontend && npm run build`

Expected: passes.

- [ ] **Step 4: Smoke-test in dev**

Run: `cd frontend && npm run dev` (background; user keeps it running).

Open the dashboard. v1 UI should still render exactly as before. Start a run and confirm: header pill updates through stages, terminal logs stream in, scripts populate (they will appear *before* any v2 deferral works, because nothing dispatches `COMET_FRAME` yet, so `comets[]` just keeps growing harmlessly — this is the worst behaviour we'll see in this task; it gets cleaned up in Task 6).

Actually, important: without the engine, comets accumulate forever and visible `scripts` never get populated (because `content_ready` always buffers into `pendingScripts`). That means **`ScriptsPanel` will appear empty during a run**. This is intentional and temporary. Note it for the milestone check.

To unbreak the demo while building the engine, **temporarily** add this hack at the top of the `content_ready` reducer case for Tasks 3–5:

```ts
// TEMP: until usePipelineEngine is wired in Task 6, commit scripts directly.
// Remove this line in Task 6.
return commitScript(withLog, script);
```

Place it **above** the `if (withLog.landed.has(...))` check. Mark with a comment so it's easy to find. Task 6 removes it.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/state/store.tsx
git commit -m "feat(v2): store sub-state for comets, pending scripts, glitch, elapsed

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Utility functions — hex math, text helpers

**Files:**
- Create: `frontend/src/utils/hex.ts`
- Create: `frontend/src/utils/text.ts`

- [ ] **Step 1: Write hex utils**

Create `frontend/src/utils/hex.ts`:

```ts
export const HEX_R = 22;
export const HEX_W = HEX_R * 2;
export const HEX_H = Math.sqrt(3) * HEX_R;
export const HEX_DX = HEX_W * 0.75;

export interface HexCell {
  id: string;
  cx: number;
  cy: number;
  points: string;
}

function hexPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(2)},${(cy + Math.sin(a) * r).toFixed(2)}`);
  }
  return pts.join(" ");
}

export function buildHexes(width: number, height: number): HexCell[] {
  const cells: HexCell[] = [];
  const cols = Math.ceil(width / HEX_DX) + 2;
  const rows = Math.ceil(height / HEX_H) + 2;
  for (let q = -1; q < cols; q++) {
    for (let r = -1; r < rows; r++) {
      const cx = q * HEX_DX;
      const cy = r * HEX_H + ((q & 1) ? HEX_H / 2 : 0);
      cells.push({ id: `${q},${r}`, cx, cy, points: hexPoints(cx, cy, HEX_R - 1.5) });
    }
  }
  return cells;
}

export function findHexAt(cells: HexCell[], x: number, y: number): HexCell | null {
  let best: HexCell | null = null;
  let bestD = Infinity;
  for (const c of cells) {
    const dx = c.cx - x;
    const dy = c.cy - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}
```

- [ ] **Step 2: Write text utils**

Create `frontend/src/utils/text.ts`:

```ts
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .join("")
    .slice(0, 2);
}

export function fmtElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && npm run build`

Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/utils
git commit -m "feat(v2): hex math + text helpers

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Hooks — useElapsed, usePipeSize

**Files:**
- Create: `frontend/src/hooks/useElapsed.ts`
- Create: `frontend/src/hooks/usePipeSize.ts`

- [ ] **Step 1: Write useElapsed**

Create `frontend/src/hooks/useElapsed.ts`:

```ts
import { useEffect, useState } from "react";

/**
 * Returns elapsed ms since `start` (a performance.now() timestamp).
 * Ticks on rAF while `running`. Freezes at the last value when `running` flips false.
 * When `start === null`, returns 0.
 */
export function useElapsed(running: boolean, start: number | null): number {
  const [ms, setMs] = useState(0);

  useEffect(() => {
    if (start === null) {
      setMs(0);
      return;
    }
    if (!running) {
      setMs(performance.now() - start);
      return;
    }
    let raf = 0;
    const tick = () => {
      setMs(performance.now() - start);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, start]);

  return ms;
}
```

- [ ] **Step 2: Write usePipeSize**

Create `frontend/src/hooks/usePipeSize.ts`:

```ts
import { useLayoutEffect, useState, type RefObject } from "react";

export interface PipeSize { w: number; h: number; }

const FALLBACK: PipeSize = { w: 820, h: 540 };

/**
 * Tracks the bounding-box size of the given element. Uses ResizeObserver when
 * available, falls back to a one-shot measurement on mount.
 */
export function usePipeSize(ref: RefObject<HTMLElement>): PipeSize {
  const [size, setSize] = useState<PipeSize>(FALLBACK);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    };
    measure();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [ref]);

  return size;
}
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && npm run build`

Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/useElapsed.ts frontend/src/hooks/usePipeSize.ts
git commit -m "feat(v2): useElapsed + usePipeSize hooks

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Pipeline engine — single rAF loop owning comet ticks

**Files:**
- Create: `frontend/src/hooks/usePipelineEngine.ts`

- [ ] **Step 1: Write the engine**

Create `frontend/src/hooks/usePipelineEngine.ts`:

```ts
import { useEffect, useRef, type Dispatch } from "react";
import type { Action } from "../state/store";
import type { Comet } from "../types";

const SPEED = 0.42; // 1 / seconds-to-traverse; ~2.4s end-to-end

/**
 * Owns the single rAF loop that advances all comets. Dispatches one batched
 * COMET_FRAME action per frame. Active whenever `comets.length > 0`; once
 * empty AND the run is not running, the loop suspends.
 */
export function usePipelineEngine(
  comets: Comet[],
  running: boolean,
  dispatch: Dispatch<Action>,
): void {
  // Mirror comets into a ref so the loop reads the latest list without re-binding.
  const cometsRef = useRef<Comet[]>(comets);
  cometsRef.current = comets;

  const runningRef = useRef(running);
  runningRef.current = running;

  const shouldRun = comets.length > 0 || running;

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let active = false;

    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;

      const list = cometsRef.current;
      if (list.length === 0 && !runningRef.current) {
        active = false;
        return;
      }

      const ticks: { id: number; t: number }[] = [];
      const landed: number[] = [];
      let intensityBump = false;

      for (const c of list) {
        const nt = c.t + dt * SPEED;
        if (nt >= 1) {
          landed.push(c.id);
        } else {
          ticks.push({ id: c.id, t: nt });
        }
        if (c.t < 0.5 && nt >= 0.5) intensityBump = true;
      }

      if (ticks.length > 0 || landed.length > 0 || intensityBump) {
        dispatch({ type: "COMET_FRAME", ticks, landed, intensityBump });
      }

      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      if (active) return;
      active = true;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };

    if (cometsRef.current.length > 0 || runningRef.current) start();

    return () => {
      cancelAnimationFrame(raf);
      active = false;
    };
  }, [dispatch, shouldRun]);
}
```

Note on dependencies: the effect re-runs when the boolean expression `comets.length > 0 || running` changes value. This causes a clean (cancel + restart) when the loop transitions between idle and active.

- [ ] **Step 2: Wire engine into the StoreProvider so it's always mounted**

Modify `frontend/src/state/store.tsx`. Add this import at the top:

```ts
import { usePipelineEngine } from "../hooks/usePipelineEngine";
```

Then inside `StoreProvider`, after the `useReducer` call and before the `useEffect` for `subscribe`, add:

```tsx
const running = state.stage !== "idle" && state.stage !== "done";
usePipelineEngine(state.comets, running, dispatch);
```

- [ ] **Step 3: Remove the TEMP hack from Task 3**

Open `frontend/src/state/store.tsx`. Find the `content_ready` case's `// TEMP:` line and delete it. The reducer should now properly buffer scripts into `pendingScripts` and only commit them on comet landing.

- [ ] **Step 4: Verify build**

Run: `cd frontend && npm run build`

Expected: passes.

- [ ] **Step 5: Smoke-test**

Run: `cd frontend && npm run dev`. Start a run via the existing v1 Run button.

Expected behaviour (still with v1 visuals):
- Scripts panel populates with a noticeable lag after each scrape (the ~2.4 s comet flight). Specifically: each script appears ~2.4 s after the post is scraped. If the LLM is slower than 2.4 s, the comet lands first and the script appears as soon as the LLM finishes.
- After the run completes, the script count matches `count`.
- Counting in the dev tools React Profiler: comets state slot should clear back to `[]` within ~3 s of the last scrape.

If scripts are not appearing at all, check that the engine effect is firing — log `comets.length` and the `COMET_FRAME` dispatches in the reducer.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/hooks/usePipelineEngine.ts frontend/src/state/store.tsx
git commit -m "feat(v2): rAF pipeline engine — scripts gated on comet landing

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Ambient dust

**Files:**
- Create: `frontend/src/components/Dust.tsx`
- Create: `frontend/src/components/Dust.module.css`

- [ ] **Step 1: Write the CSS**

Create `frontend/src/components/Dust.module.css`:

```css
.dust {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

.dust span {
  position: absolute;
  width: 2px;
  height: 2px;
  border-radius: 50%;
  filter: blur(0.5px);
  animation: drift linear infinite;
}

@keyframes drift {
  from { transform: translate3d(0, 0, 0); }
  to   { transform: translate3d(120px, -80px, 0); }
}
```

- [ ] **Step 2: Write the component**

Create `frontend/src/components/Dust.tsx`:

```tsx
import { useEffect, useRef } from "react";
import { useReducedMotion } from "../hooks/useReducedMotion";
import styles from "./Dust.module.css";

const PARTICLE_COUNT = 40;

export default function Dust() {
  const reduced = useReducedMotion();
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduced) return;
    const host = hostRef.current;
    if (!host) return;
    host.innerHTML = "";
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const d = document.createElement("span");
      d.style.left = (Math.random() * 100) + "vw";
      d.style.top = (Math.random() * 100) + "vh";
      d.style.opacity = (0.15 + Math.random() * 0.5).toFixed(2);
      d.style.animationDuration = (8 + Math.random() * 18).toFixed(1) + "s";
      d.style.animationDelay = (-Math.random() * 12).toFixed(1) + "s";
      d.style.background = Math.random() < 0.6
        ? "oklch(0.88 0.19 128)"
        : "oklch(0.78 0.10 80)";
      host.appendChild(d);
    }
    return () => { host.innerHTML = ""; };
  }, [reduced]);

  if (reduced) return null;
  return <div className={styles.dust} ref={hostRef} aria-hidden="true" />;
}
```

- [ ] **Step 3: Mount it in App.tsx (temporary placement)**

Modify `frontend/src/App.tsx`. Add the import and mount `<Dust />` as the first child:

```tsx
import styles from "./styles/app.module.css";
import Header from "./components/Header";
import ConfigurePanel from "./components/ConfigurePanel";
import PipelinePanel from "./components/PipelinePanel";
import ScriptsPanel from "./components/ScriptsPanel";
import Terminal from "./components/Terminal";
import Dust from "./components/Dust";

export default function App() {
  return (
    <div className={styles.app}>
      <Dust />
      <Header />
      <div className={styles.grid}>
        <ConfigurePanel />
        <PipelinePanel />
        <div className={styles.rightColumn}>
          <ScriptsPanel />
          <Terminal />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Smoke-test**

Run: `cd frontend && npm run dev`. Open the page.

Expected: faint greenish/amber particles drifting diagonally up-and-to-the-right across the viewport, behind the dashboard. Toggle macOS "Reduce motion" — particles disappear entirely.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Dust.tsx frontend/src/components/Dust.module.css frontend/src/App.tsx
git commit -m "feat(v2): ambient drifting dust background

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Header — elapsed timer in pill + brand sheen

**Files:**
- Modify: `frontend/src/components/Header.tsx`
- Modify: `frontend/src/components/Header.module.css`

- [ ] **Step 1: Add the sheen + blur CSS**

Modify `frontend/src/components/Header.module.css`. Find the `.brandMark` rule and add an `overflow: hidden` to it, then add these new rules at the end of the file (before any `@media` blocks):

```css
.brandMark::before {
  content: "";
  position: absolute;
  left: -50%;
  top: 0;
  bottom: 0;
  width: 30%;
  background: linear-gradient(90deg, transparent, oklch(1 0 0 / 0.5), transparent);
  transform: skewX(-20deg);
  animation: sheen 4s ease-in-out infinite;
}

@keyframes sheen {
  0%, 100% { left: -50%; }
  50%      { left: 130%; }
}

.statusPill {
  backdrop-filter: blur(8px);
  background: oklch(0.20 0.010 70 / 0.6);
}

.iconBtn {
  backdrop-filter: blur(8px);
  background: oklch(0.20 0.010 70 / 0.6);
}

.sep {
  width: 1px;
  height: 12px;
  background: var(--line-2);
}

.timer {
  color: var(--fg);
  font-variant-numeric: tabular-nums;
}

@media (prefers-reduced-motion: reduce) {
  .brandMark::before { animation: none; }
}
```

The existing `.brandMark` rule already has `position: relative; overflow: hidden;` per the v1 module — verify and add `overflow: hidden` if not present.

- [ ] **Step 2: Update Header.tsx to show the timer**

Modify `frontend/src/components/Header.tsx`. Replace the whole file with:

```tsx
import { useStore } from "../state/store";
import { useElapsed } from "../hooks/useElapsed";
import { fmtElapsed } from "../utils/text";
import { Bell, Gear, Play } from "../icons";
import styles from "./Header.module.css";

const STATUS_LABEL: Record<string, string> = {
  idle:       "Idle · agent ready",
  scraping:   "Live · scraping saved posts",
  parsing:    "Live · parsing content",
  generating: "Live · generating scripts",
};

export default function Header() {
  const { state } = useStore();
  const running = state.stage !== "idle" && state.stage !== "done";
  const elapsed = useElapsed(running, state.elapsedStart);
  const label =
    state.stage === "done"
      ? `Run complete · ${state.scripts.length} scripts ready`
      : STATUS_LABEL[state.stage] ?? "Idle · agent ready";
  const showTimer = state.elapsedStart !== null;

  return (
    <header className={styles.top}>
      <div className={styles.brand}>
        <div className={styles.brandMark}>
          <Play />
        </div>
        <div>
          <div className={styles.brandName}>Reelify</div>
          <div className={styles.brandSub}>saved · posts → reels</div>
        </div>
      </div>
      <div className={styles.spacer} />
      <div className={styles.statusPill} role="status" aria-live="polite">
        <span className={`${styles.dot} ${running ? styles.live : ""}`} />
        <span>{label}</span>
        {showTimer && (
          <>
            <span className={styles.sep} />
            <span className={styles.timer}>{fmtElapsed(elapsed)}</span>
          </>
        )}
      </div>
      <button className={styles.iconBtn} aria-label="Notifications">
        <Bell />
      </button>
      <button className={styles.iconBtn} aria-label="Settings">
        <Gear />
      </button>
    </header>
  );
}
```

- [ ] **Step 3: Smoke-test**

Run dev. Idle: pill says "Idle · agent ready", no timer. Start a run: timer ticks `00:00 → 00:01 → ...`. Complete the run: timer freezes. Press Stop / Reset: timer disappears.

Brand mark: a light streak should sweep across the gradient square once every 4 s.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Header.tsx frontend/src/components/Header.module.css
git commit -m "feat(v2): elapsed timer in status pill + brand-mark sheen

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: ConfigurePanel — source-card scan + run-button hover sheen

**Files:**
- Modify: `frontend/src/components/ConfigurePanel.module.css`

- [ ] **Step 1: Add scan + sheen CSS**

Add to the end of `frontend/src/components/ConfigurePanel.module.css`:

```css
.source {
  position: relative;
  overflow: hidden;
}

.source::after {
  content: "";
  position: absolute;
  left: -100%;
  top: 0;
  bottom: 0;
  width: 100%;
  background: linear-gradient(90deg, transparent, oklch(0.88 0.19 128 / 0.10), transparent);
  animation: configScan 3.5s linear infinite;
  pointer-events: none;
}

@keyframes configScan {
  to { left: 100%; }
}

.runBtn {
  position: relative;
  overflow: hidden;
}

.runBtn::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, oklch(1 0 0 / 0.25), transparent);
  transform: translateX(-100%);
  pointer-events: none;
}

.runBtn:hover::after {
  animation: runSheen 0.9s ease-out;
}

@keyframes runSheen {
  to { transform: translateX(100%); }
}

@media (prefers-reduced-motion: reduce) {
  .source::after { animation: none; opacity: 0; }
  .runBtn:hover::after { animation: none; }
}
```

If the existing `.source` rule does not already include `position: relative; overflow: hidden;`, merge those into it instead of declaring a new `.source` block. Same for `.runBtn` — merge in `position: relative; overflow: hidden;` rather than redeclaring.

- [ ] **Step 2: Smoke-test**

Run dev. The source card should have a faint green sweep crossing it every 3.5 s. Hover the Run button: a brighter white sheen crosses it once.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ConfigurePanel.module.css
git commit -m "feat(v2): source-card scan + run-btn hover sheen

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: App layout — new grid + terminal-strip placeholder

**Files:**
- Modify: `frontend/src/styles/app.module.css`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Rewrite app.module.css**

Replace `frontend/src/styles/app.module.css` with:

```css
.app {
  max-width: 1480px;
  margin: 0 auto;
  padding: 22px 28px 28px;
  position: relative;
}

.grid {
  position: relative;
  z-index: 1;
  margin-top: 20px;
  display: grid;
  grid-template-columns: 308px minmax(0, 1fr) 408px;
  gap: 18px;
  align-items: stretch;
}

.rightCol {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 0;
}

.termStrip {
  margin-top: 18px;
  position: relative;
  z-index: 1;
}

@media (max-width: 1240px) {
  .grid { grid-template-columns: 1fr; }
}

@media (max-width: 900px) {
  .app {
    padding: 16px 16px 24px;
  }
  .grid {
    gap: 14px;
    margin-top: 16px;
  }
  .rightCol {
    gap: 14px;
  }
}

@media (max-width: 600px) {
  .app {
    padding: 12px 10px 20px;
  }
  .grid {
    gap: 12px;
    margin-top: 12px;
  }
  .termStrip {
    margin-top: 14px;
  }
}

.panel {
  background: linear-gradient(180deg, oklch(0.21 0.010 70 / 0.85), oklch(0.17 0.008 70 / 0.85));
  border: 1px solid var(--line);
  border-radius: var(--radius-panel);
  padding: 18px;
  position: relative;
  backdrop-filter: blur(6px);
}

@media (max-width: 600px) {
  .panel {
    padding: 14px;
    border-radius: 12px;
  }
}

.panelFlush {
  composes: panel;
  padding: 0;
  overflow: hidden;
}
```

Notable changes vs v1: max-width 1480, new column widths 308/1fr/408, single breakpoint at 1240, panel uses blur + semi-transparent gradient, new `.termStrip` class.

- [ ] **Step 2: Restructure App.tsx**

Modify `frontend/src/App.tsx`:

```tsx
import styles from "./styles/app.module.css";
import Header from "./components/Header";
import ConfigurePanel from "./components/ConfigurePanel";
import PipelinePanel from "./components/PipelinePanel";
import ScriptsPanel from "./components/ScriptsPanel";
import Terminal from "./components/Terminal";
import Dust from "./components/Dust";

export default function App() {
  return (
    <div className={styles.app}>
      <Dust />
      <Header />
      <div className={styles.grid}>
        <ConfigurePanel />
        <PipelinePanel />
        <div className={styles.rightCol}>
          {/* PhonePreview will land here in Task 21 */}
          <ScriptsPanel />
        </div>
      </div>
      <div className={styles.termStrip}>
        <Terminal />
      </div>
    </div>
  );
}
```

Note the `rightCol` class (renamed from `rightColumn`) and the terminal moving below the grid.

- [ ] **Step 3: Smoke-test**

Run dev. The pipeline panel should expand wider (since the right column is narrower without a phone preview yet). The terminal should now span the full width below the grid. All v1 visuals still appear inside their panels.

Below 1240 px viewport: everything stacks into a single column.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/styles/app.module.css frontend/src/App.tsx
git commit -m "feat(v2): new grid layout + terminal as full-width strip

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: PipelinePanel folder scaffold

The next several tasks create the pipeline subtree. We start by moving the existing `PipelinePanel.tsx` into a folder so we can add sibling components, then replace pieces one by one.

**Files:**
- Create: `frontend/src/components/PipelinePanel/index.tsx`
- Create: `frontend/src/components/PipelinePanel/PipelinePanel.module.css`
- Delete: `frontend/src/components/PipelinePanel.tsx`
- Delete: `frontend/src/components/PipelinePanel.module.css`

- [ ] **Step 1: Create the new folder**

```bash
mkdir -p frontend/src/components/PipelinePanel
```

- [ ] **Step 2: Move + rename**

Move the existing file to the new location (we'll edit it in subsequent tasks):

```bash
git mv frontend/src/components/PipelinePanel.tsx frontend/src/components/PipelinePanel/index.tsx
git mv frontend/src/components/PipelinePanel.module.css frontend/src/components/PipelinePanel/PipelinePanel.module.css
```

- [ ] **Step 3: Fix import paths inside `index.tsx`**

The file imports `./Core` and `./PipelinePanel.module.css`. Update them:

```ts
import Core from "../Core";
import styles from "./PipelinePanel.module.css";
```

`Core.tsx` and `Core.module.css` stay in `components/` for now — they get deleted in Task 19.

- [ ] **Step 4: Verify build**

Run: `cd frontend && npm run build`

Expected: passes. The page looks identical to Task 10.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/PipelinePanel
git commit -m "refactor(v2): nest PipelinePanel in its own folder

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: HexGrid component

**Files:**
- Create: `frontend/src/components/PipelinePanel/HexGrid.tsx`

- [ ] **Step 1: Write the component**

Create `frontend/src/components/PipelinePanel/HexGrid.tsx`:

```tsx
import { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import { buildHexes } from "../../utils/hex";

export interface HexGridHandle {
  setLit(map: Record<string, number>): void;
}

interface Props {
  width: number;
  height: number;
}

const HexGrid = forwardRef<HexGridHandle, Props>(function HexGrid({ width, height }, ref) {
  const cells = useMemo(() => buildHexes(width, height), [width, height]);
  const [lit, setLit] = useState<Record<string, number>>({});

  useImperativeHandle(ref, () => ({
    setLit(map: Record<string, number>) {
      setLit(map);
    },
  }), []);

  return (
    <svg
      className="hex-svg"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    >
      {cells.map((c) => (
        <polygon
          key={c.id}
          className={lit[c.id] ? "hex lit" : "hex"}
          points={c.points}
        />
      ))}
    </svg>
  );
});

export default HexGrid;
```

- [ ] **Step 2: Add hex CSS to PipelinePanel.module.css**

Add to the end of `frontend/src/components/PipelinePanel/PipelinePanel.module.css`:

```css
.body :global(.hex) {
  fill: oklch(0.21 0.010 70 / 0.55);
  stroke: oklch(0.34 0.012 70 / 0.7);
  stroke-width: 0.6;
  transition: fill 0.6s ease, stroke 0.6s ease;
}

.body :global(.hex.lit) {
  fill: oklch(0.55 0.16 130 / 0.18);
  stroke: oklch(0.88 0.19 128 / 0.55);
  transition: fill 0.05s, stroke 0.05s;
}
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && npm run build`

Expected: passes. (HexGrid is not yet rendered anywhere.)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/PipelinePanel/HexGrid.tsx frontend/src/components/PipelinePanel/PipelinePanel.module.css
git commit -m "feat(v2): HexGrid component + lit-cell styles

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: CometCanvas component

**Files:**
- Create: `frontend/src/components/PipelinePanel/CometCanvas.tsx`

- [ ] **Step 1: Write the component**

Create `frontend/src/components/PipelinePanel/CometCanvas.tsx`:

```tsx
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
```

- [ ] **Step 2: Add comet + lane CSS**

Append to `frontend/src/components/PipelinePanel/PipelinePanel.module.css`:

```css
.body :global(.lane) {
  fill: none;
  stroke: oklch(0.34 0.018 70 / 0.6);
  stroke-width: 1;
  stroke-dasharray: 3 5;
}

.body :global(.lane.hot) {
  stroke: oklch(0.88 0.19 128 / 0.6);
  stroke-width: 1.2;
  stroke-dasharray: 5 7;
  animation: laneFlow 1.4s linear infinite;
  filter: drop-shadow(0 0 3px oklch(0.88 0.19 128 / 0.5));
}

@keyframes laneFlow {
  to { stroke-dashoffset: -24; }
}

.body :global(.comet) {
  will-change: transform, opacity;
  transition: opacity 0.25s ease;
}

.body :global(.comet .core-dot) {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 12px var(--accent), 0 0 24px oklch(0.88 0.19 128 / 0.5);
  position: relative;
}

.body :global(.comet .trail) {
  position: absolute;
  right: 6px;
  top: 3px;
  width: 26px;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--accent));
  filter: blur(0.5px);
  transform-origin: right center;
}

.body :global(.comet .label) {
  position: absolute;
  left: 14px;
  top: -5px;
  font-family: "Geist Mono", monospace;
  font-size: 10px;
  padding: 2px 6px;
  background: oklch(0.20 0.010 70 / 0.85);
  border: 1px solid oklch(0.88 0.19 128 / 0.4);
  border-radius: 4px;
  color: var(--accent);
  white-space: nowrap;
  backdrop-filter: blur(4px);
}

@media (prefers-reduced-motion: reduce) {
  .body :global(.lane.hot) { animation: none; }
}
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && npm run build`

Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/PipelinePanel/CometCanvas.tsx frontend/src/components/PipelinePanel/PipelinePanel.module.css
git commit -m "feat(v2): CometCanvas — SVG path + per-comet divs

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: ScopeCore component

**Files:**
- Create: `frontend/src/components/PipelinePanel/ScopeCore.tsx`

- [ ] **Step 1: Write the component**

Create `frontend/src/components/PipelinePanel/ScopeCore.tsx`:

```tsx
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
```

- [ ] **Step 2: Add scope CSS**

Append to `frontend/src/components/PipelinePanel/PipelinePanel.module.css`:

```css
.body :global(.core-zone) {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 340px;
  height: 220px;
  z-index: 3;
}

.body :global(.scope) {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, oklch(0.20 0.03 130 / 0.7), oklch(0.16 0.010 70 / 0.2) 70%);
  border: 1px solid oklch(0.88 0.19 128 / 0.3);
  border-radius: 14px;
  overflow: hidden;
  box-shadow:
    0 0 0 1px oklch(0.88 0.19 128 / 0.12),
    0 30px 60px oklch(0.88 0.19 128 / 0.18),
    inset 0 0 60px oklch(0 0 0 / 0.5);
}

.body :global(.scope .gridlines) {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(oklch(0.88 0.19 128 / 0.08) 1px, transparent 1px),
    linear-gradient(90deg, oklch(0.88 0.19 128 / 0.08) 1px, transparent 1px);
  background-size: 20px 20px;
  opacity: 0.6;
}

.body :global(.scope svg) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.body :global(.scope-progress) {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 3px;
  background: oklch(0 0 0 / 0.4);
}

.body :global(.scope-progress > i) {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--accent-deep), var(--accent));
  box-shadow: 0 0 12px var(--accent);
  transition: width 0.4s ease;
}

.body :global(.scope-label) {
  position: absolute;
  top: 10px;
  left: 14px;
  font-family: "Geist Mono", monospace;
  font-size: 10px;
  color: var(--accent);
  letter-spacing: 0.16em;
  text-shadow: 0 0 8px oklch(0.88 0.19 128 / 0.5);
}

.body :global(.scope-label .dot) {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  margin-right: 6px;
  vertical-align: 1px;
  animation: scopePing 1.6s ease-out infinite;
}

@keyframes scopePing {
  0%   { box-shadow: 0 0 0 0 currentColor; opacity: 1; }
  80%  { box-shadow: 0 0 0 8px transparent; opacity: 0.6; }
  100% { box-shadow: 0 0 0 0 transparent; opacity: 1; }
}

.body :global(.scope-readout) {
  position: absolute;
  right: 14px;
  top: 10px;
  font-family: "Geist Mono", monospace;
  font-size: 10px;
  color: var(--fg-2);
  letter-spacing: 0.06em;
  text-align: right;
}

.body :global(.scope-stage) {
  position: absolute;
  left: 14px;
  bottom: 14px;
  font-family: "Inter", sans-serif;
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--fg);
  line-height: 1;
}

.body :global(.scope-stage small) {
  display: block;
  font-family: "Geist Mono", monospace;
  font-size: 10px;
  font-weight: 500;
  color: var(--fg-3);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  margin-top: 6px;
}
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && npm run build`

Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/PipelinePanel/ScopeCore.tsx frontend/src/components/PipelinePanel/PipelinePanel.module.css
git commit -m "feat(v2): ScopeCore oscilloscope with live waveform + readouts

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: PostStack component

**Files:**
- Create: `frontend/src/components/PipelinePanel/PostStack.tsx`

- [ ] **Step 1: Write the component**

Create `frontend/src/components/PipelinePanel/PostStack.tsx`:

```tsx
import type { Post } from "../../types";

interface Props {
  posts: Post[];
  totalCount: number;
  scrapedCount: number;
}

export default function PostStack({ posts, totalCount, scrapedCount }: Props) {
  const visible = posts.slice(-6).reverse(); // newest first → renders at index 0 (front of stack)
  const remaining = Math.max(0, totalCount - scrapedCount);

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
              key={p.id}
              className="stack-card"
              style={{
                ["--h" as never]: p.h,
                transform: `translate3d(${x}px, ${y}px, ${z}px)`,
                opacity: 1 - i * 0.10,
                zIndex: 10 - i,
              }}
            >
              <div className="row">
                <div className="av" style={{ ["--h" as never]: p.h }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="card-author">{p.author}</div>
                  <div className="card-role">{p.role}</div>
                </div>
              </div>
              <div className="lines">
                <i /><i /><i /><i />
              </div>
              <div className="badge">post · {String(p.postIndex).padStart(3, "0")}</div>
            </div>
          );
        })}
      </div>
      <div className="stack-counter">
        <div className="v">{String(remaining).padStart(2, "0")}</div>
        <div className="k">remaining</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add stack CSS (shared between PostStack and ReelDeck)**

Append to `frontend/src/components/PipelinePanel/PipelinePanel.module.css`:

```css
.body :global(.stack-col) {
  position: absolute;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 200px;
  perspective: 800px;
  z-index: 2;
}

.body :global(.stack-col.left)  { left: 20px; }
.body :global(.stack-col.right) { right: 20px; }

.body :global(.stack-label) {
  position: absolute;
  top: 16px;
  left: 0;
  right: 0;
  font-family: "Geist Mono", monospace;
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--fg-3);
  text-align: center;
}

.body :global(.stack-counter) {
  position: absolute;
  bottom: 16px;
  left: 0;
  right: 0;
  text-align: center;
  font-family: "Geist Mono", monospace;
}

.body :global(.stack-counter .v) {
  font-size: 26px;
  font-weight: 600;
  color: var(--fg);
  font-variant-numeric: tabular-nums;
}

.body :global(.stack-counter .k) {
  font-size: 10px;
  color: var(--fg-3);
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.body :global(.stack) {
  position: relative;
  width: 150px;
  height: 200px;
  transform-style: preserve-3d;
  transform: rotateY(-15deg) rotateX(8deg);
}

.body :global(.stack-col.right .stack) {
  transform: rotateY(15deg) rotateX(8deg);
}

.body :global(.stack-card) {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, var(--bg-3), oklch(0.20 0.010 70));
  border: 1px solid var(--line-2);
  border-radius: 10px;
  box-shadow: 0 6px 20px oklch(0 0 0 / 0.4);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: transform 0.5s cubic-bezier(.4,0,.2,1), opacity 0.4s ease;
}

.body :global(.stack-card .av) {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  flex-shrink: 0;
  background: linear-gradient(135deg, oklch(0.60 0.10 var(--h, 60)), oklch(0.40 0.06 var(--h, 60)));
  border: 1px solid var(--line-2);
}

.body :global(.stack-card .row) {
  display: flex;
  gap: 8px;
  align-items: center;
}

.body :global(.stack-card .card-author) {
  font-size: 11px;
  font-weight: 600;
  color: var(--fg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.body :global(.stack-card .card-role) {
  font-size: 9px;
  font-family: "Geist Mono", monospace;
  color: var(--fg-3);
  letter-spacing: 0.05em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.body :global(.stack-card .lines i) {
  display: block;
  height: 5px;
  background: var(--bg-4);
  border-radius: 3px;
  margin-bottom: 5px;
}

.body :global(.stack-card .lines i:nth-child(1)) { width: 88%; }
.body :global(.stack-card .lines i:nth-child(2)) { width: 60%; }
.body :global(.stack-card .lines i:nth-child(3)) { width: 78%; }
.body :global(.stack-card .lines i:nth-child(4)) { width: 40%; }

.body :global(.stack-card .badge) {
  margin-top: auto;
  align-self: flex-start;
  font-family: "Geist Mono", monospace;
  font-size: 9px;
  padding: 2px 5px;
  border-radius: 3px;
  background: var(--bg-4);
  color: var(--fg-3);
  letter-spacing: 0.05em;
}
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && npm run build`

Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/PipelinePanel/PostStack.tsx frontend/src/components/PipelinePanel/PipelinePanel.module.css
git commit -m "feat(v2): 3D PostStack with hue-tinted avatars + rotating counter

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 16: ReelDeck component

**Files:**
- Create: `frontend/src/components/PipelinePanel/ReelDeck.tsx`

- [ ] **Step 1: Write the component**

Create `frontend/src/components/PipelinePanel/ReelDeck.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import type { Script } from "../../types";
import { Play } from "../../icons";
import { useReducedMotion } from "../../hooks/useReducedMotion";

interface Props {
  scripts: Script[];
}

export default function ReelDeck({ scripts }: Props) {
  const visible = scripts.slice(0, 5);
  const reduced = useReducedMotion();
  const [freshId, setFreshId] = useState<string | null>(null);
  const lastTopId = useRef<string | null>(null);

  useEffect(() => {
    const top = visible[0]?.id ?? null;
    if (top && top !== lastTopId.current && !reduced) {
      setFreshId(top);
      const id = window.setTimeout(() => setFreshId(null), 950);
      lastTopId.current = top;
      return () => window.clearTimeout(id);
    }
    lastTopId.current = top;
    return undefined;
  }, [visible[0]?.id, reduced]);

  return (
    <div className="stack-col right">
      <div className="stack-label">// reels · output</div>
      <div className="stack">
        {visible.map((r, i) => {
          const z = -i * 10;
          const y = i * 5;
          const x = i * 3;
          const tx = `translate3d(${x}px, ${y}px, ${z}px)`;
          const fresh = r.id === freshId;
          return (
            <div
              key={r.id}
              className={"reel-stack-card" + (fresh ? " fresh" : "")}
              style={{
                ["--h" as never]: r.h,
                ["--rb-tx" as never]: tx,
                transform: tx,
                opacity: 1 - i * 0.10,
                zIndex: 10 - i,
              }}
            >
              <div className="sprocket"><span /><span /><span /><span /><span /></div>
              <div className="reel-title">{r.title}</div>
              <div className="reel-meta">{r.dur}s · {r.sceneCount} scenes</div>
              <div className="play"><Play width={10} height={10} /></div>
            </div>
          );
        })}
      </div>
      <div className="stack-counter">
        <div className="v">{String(scripts.length).padStart(2, "0")}</div>
        <div className="k">ready</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add reel CSS**

Append to `frontend/src/components/PipelinePanel/PipelinePanel.module.css`:

```css
.body :global(.reel-stack-card) {
  position: absolute;
  inset: 0;
  background: linear-gradient(160deg, oklch(0.32 0.10 var(--h, 130)), oklch(0.18 0.04 var(--h, 130)));
  border: 1px solid oklch(0.5 0.10 var(--h, 130) / 0.6);
  border-radius: 10px;
  box-shadow: 0 6px 20px oklch(0 0 0 / 0.5);
  padding: 10px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: transform 0.5s cubic-bezier(.4,0,.2,1), opacity 0.4s ease;
}

.body :global(.reel-stack-card::before) {
  content: "";
  position: absolute;
  inset: 8px;
  border-radius: 8px;
  border: 1px dashed oklch(1 0 0 / 0.15);
  pointer-events: none;
}

.body :global(.reel-stack-card .sprocket) {
  display: flex;
  gap: 4px;
  margin-bottom: 6px;
}

.body :global(.reel-stack-card .sprocket span) {
  flex: 1;
  height: 4px;
  background: oklch(0 0 0 / 0.35);
  border-radius: 1px;
}

.body :global(.reel-stack-card .reel-title) {
  font-size: 11px;
  font-weight: 700;
  color: oklch(1 0 0 / 0.92);
  line-height: 1.2;
}

.body :global(.reel-stack-card .reel-meta) {
  font-family: "Geist Mono", monospace;
  font-size: 9px;
  color: oklch(1 0 0 / 0.7);
  margin-top: 4px;
}

.body :global(.reel-stack-card .play) {
  position: absolute;
  right: 10px;
  bottom: 10px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: oklch(1 0 0 / 0.9);
  display: grid;
  place-items: center;
  color: oklch(0.2 0.06 var(--h, 130));
}

.body :global(.reel-stack-card.fresh) {
  animation: reelFresh 0.9s ease-out;
}

@keyframes reelFresh {
  0%   { transform: var(--rb-tx) translateY(-30px); opacity: 0; filter: brightness(2); }
  30%  { filter: brightness(1.5); }
  100% { opacity: 1; filter: brightness(1); }
}

@media (prefers-reduced-motion: reduce) {
  .body :global(.reel-stack-card.fresh) { animation: none; }
}
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && npm run build`

Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/PipelinePanel/ReelDeck.tsx frontend/src/components/PipelinePanel/PipelinePanel.module.css
git commit -m "feat(v2): 3D ReelDeck — film canisters with fresh-arrival flash

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 17: SlotCounter, StatsStrip, StageTrack, GlitchSweep

These four are small enough to land in one task.

**Files:**
- Create: `frontend/src/components/PipelinePanel/SlotCounter.tsx`
- Create: `frontend/src/components/PipelinePanel/StatsStrip.tsx`
- Create: `frontend/src/components/PipelinePanel/StageTrack.tsx`
- Create: `frontend/src/components/PipelinePanel/GlitchSweep.tsx`

- [ ] **Step 1: SlotCounter**

Create `frontend/src/components/PipelinePanel/SlotCounter.tsx`:

```tsx
interface Props {
  value: number;
  width?: number;
}

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

export default function SlotCounter({ value, width = 3 }: Props) {
  const str = String(Math.max(0, Math.round(value))).padStart(width, "0");
  return (
    <span style={{ display: "inline-flex", lineHeight: 1 }}>
      {str.split("").map((ch, i) => (
        <span className="digit" key={i}>
          <i style={{ transform: `translateY(-${parseInt(ch, 10) * 28}px)` }}>
            {DIGITS.map((d) => (
              <span key={d} style={{ display: "block", height: 28 }}>{d}</span>
            ))}
          </i>
        </span>
      ))}
    </span>
  );
}
```

- [ ] **Step 2: StatsStrip**

Create `frontend/src/components/PipelinePanel/StatsStrip.tsx`:

```tsx
import { useCounter } from "../../hooks/useCounter";
import SlotCounter from "./SlotCounter";

interface Props {
  scraped: number;
  count: number;
  queued: number;
  scripts: number;
  avgDur: number;
}

export default function StatsStrip({ scraped, count, queued, scripts, avgDur }: Props) {
  const scrapedDisp = useCounter(scraped, 500);
  const queuedDisp = useCounter(queued, 500);
  const scriptsDisp = useCounter(scripts, 500);
  const avgDisp = useCounter(avgDur, 500);

  return (
    <div className="pipe-stats">
      <div className="stat">
        <div className="k">Scraped</div>
        <div className="v">
          <SlotCounter value={scrapedDisp} width={3} />
          <small>/ {String(count).padStart(3, "0")}</small>
        </div>
      </div>
      <div className="stat">
        <div className="k">In queue</div>
        <div className="v"><SlotCounter value={queuedDisp} width={3} /></div>
      </div>
      <div className="stat">
        <div className="k">Scripts</div>
        <div className="v"><SlotCounter value={scriptsDisp} width={3} /></div>
      </div>
      <div className="stat">
        <div className="k">Avg duration</div>
        <div className="v">
          <SlotCounter value={avgDisp} width={2} />
          <small>s</small>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: StageTrack**

Create `frontend/src/components/PipelinePanel/StageTrack.tsx`:

```tsx
import type { Stage } from "../../types";

const ITEMS: { k: string; label: string }[] = [
  { k: "scrape", label: "01 · Scrape" },
  { k: "parse",  label: "02 · Parse" },
  { k: "gen",    label: "03 · Generate" },
  { k: "ready",  label: "04 · Ready" },
];

const STAGE_IDX: Record<Stage, number> = {
  idle: -1,
  scraping: 0,
  parsing: 1,
  generating: 2,
  done: 3,
};

export default function StageTrack({ stage }: { stage: Stage }) {
  const idx = STAGE_IDX[stage];
  return (
    <div className="stage-track">
      {ITEMS.map((it, i) => {
        const klass = i === idx ? "active" : i < idx ? "done" : "";
        return (
          <span key={it.k} style={{ display: "inline-flex", alignItems: "center" }}>
            <span className={`stage-dot ${klass}`}>
              <i /> {it.label}
            </span>
            {i < ITEMS.length - 1 && <span className="stage-sep" />}
          </span>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: GlitchSweep**

Create `frontend/src/components/PipelinePanel/GlitchSweep.tsx`:

```tsx
import { useReducedMotion } from "../../hooks/useReducedMotion";

export default function GlitchSweep({ tick }: { tick: number }) {
  const reduced = useReducedMotion();
  if (reduced || tick === 0) return null;
  // The `key` prop is supplied by the parent — re-keying on `tick` remounts and replays the animation.
  return <div className="glitch-sweep go" />;
}
```

- [ ] **Step 5: Add CSS for all four**

Append to `frontend/src/components/PipelinePanel/PipelinePanel.module.css`:

```css
/* slot counter */
.body :global(.digit) {
  display: inline-block;
  width: 14px;
  height: 28px;
  overflow: hidden;
  vertical-align: top;
}

.body :global(.digit > i) {
  display: block;
  font-style: normal;
  line-height: 28px;
  text-align: center;
  transition: transform 0.5s cubic-bezier(.4,0,.2,1);
  font-variant-numeric: tabular-nums;
}

/* stage track */
.head :global(.stage-track) {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: "Geist Mono", monospace;
  font-size: 11px;
}

.head :global(.stage-dot) {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--fg-3);
}

.head :global(.stage-dot i) {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--line-2);
}

.head :global(.stage-dot.active) { color: var(--fg); }
.head :global(.stage-dot.active i) {
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent);
}

.head :global(.stage-dot.done) { color: var(--fg-2); }
.head :global(.stage-dot.done i) { background: var(--accent-deep); }

.head :global(.stage-sep) {
  width: 14px;
  height: 1px;
  background: var(--line-2);
}

/* stats strip */
.pipeStats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border-top: 1px solid var(--line);
}

.pipeStats :global(.stat) {
  padding: 14px 18px;
  border-right: 1px solid var(--line);
}

.pipeStats :global(.stat:last-child) { border-right: 0; }

.pipeStats :global(.stat .k) {
  font-family: "Geist Mono", monospace;
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--fg-3);
}

.pipeStats :global(.stat .v) {
  font-family: "Geist Mono", monospace;
  font-size: 24px;
  font-weight: 600;
  color: var(--fg);
  margin-top: 4px;
  display: flex;
  align-items: baseline;
  gap: 4px;
  line-height: 1;
}

.pipeStats :global(.stat .v small) {
  font-size: 11px;
  color: var(--fg-3);
  font-weight: 400;
}

/* glitch sweep */
.body :global(.glitch-sweep) {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(180deg,
    transparent 30%,
    oklch(0.88 0.19 128 / 0.05) 48%,
    oklch(0.88 0.19 128 / 0.25) 50%,
    oklch(0.88 0.19 128 / 0.05) 52%,
    transparent 70%);
  opacity: 0;
  z-index: 5;
}

.body :global(.glitch-sweep.go) {
  animation: gsweep 0.7s ease-out;
}

@keyframes gsweep {
  0%   { transform: translateY(-100%); opacity: 0; }
  30%  { opacity: 1; }
  100% { transform: translateY(100%); opacity: 0; }
}
```

- [ ] **Step 6: Verify build**

Run: `cd frontend && npm run build`

Expected: passes.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/PipelinePanel
git commit -m "feat(v2): SlotCounter + StatsStrip + StageTrack + GlitchSweep

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 18: Wire pipeline subtree into PipelinePanel/index.tsx

This task replaces the existing `index.tsx` with the new orchestrator. After this lands, the cinematic pipeline is fully live.

**Files:**
- Modify: `frontend/src/components/PipelinePanel/index.tsx`
- Modify: `frontend/src/components/PipelinePanel/PipelinePanel.module.css`

- [ ] **Step 1: Restructure PipelinePanel.module.css panel/head/body classes**

The existing `PipelinePanel.module.css` was inherited from v1 and uses class names like `.panel`, `.head`, `.body`, `.stats`. Keep the names but adjust the styles to match v2 panel chrome. Locate the existing `.panel`, `.head`, `.body`, `.stats` rules at the top of the file and replace them with:

```css
.panel {
  composes: panel from "../../styles/app.module.css";
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--line);
}

.headTitle {
  font-family: "Geist Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--fg-3);
  display: flex;
  align-items: center;
}

.headTitle .badge {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  background: var(--bg-3);
  color: var(--fg-2);
  display: inline-grid;
  place-items: center;
  font-size: 10px;
  margin-right: 6px;
}

.body {
  position: relative;
  height: 540px;
  flex: 0 0 540px;
  overflow: hidden;
}
```

Notes:
- `composes: panel from global` — CSS Modules' way to inherit the global `.panel` class. If that syntax doesn't work in this Vite setup, instead duplicate the panel styles inline here.
- Delete any leftover v1 rules below this point that referenced `.left`, `.right`, `.col`, `.colLabel`, `.postCard`, `.flying`, `.staged`, `.postAvatar`, `.postMeta`, `.postBody`, `.reelCard`, `.reelThumb`, `.reelInfo`, `.reelTitle`, `.reelMeta`, `.in`, `.active`, `.done`, `.stageItem`, `.stageDot`, `.stageGap`, `.stats`, `.stat`, `.statLabel`, `.statValue`, `.statDelta`, `.headBadge`. Many of these are obsolete with the new sub-components.

Use a careful read-through of the existing CSS file and remove only the legacy v1 rules; keep the new v2 rules added in Tasks 12–17 intact.

- [ ] **Step 2: Rewrite PipelinePanel/index.tsx**

Replace `frontend/src/components/PipelinePanel/index.tsx` with:

```tsx
import { useCallback, useMemo, useRef } from "react";
import { useStore } from "../../state/store";
import { usePipeSize } from "../../hooks/usePipeSize";
import { buildHexes, findHexAt, type HexCell } from "../../utils/hex";
import HexGrid, { type HexGridHandle } from "./HexGrid";
import CometCanvas from "./CometCanvas";
import ScopeCore from "./ScopeCore";
import PostStack from "./PostStack";
import ReelDeck from "./ReelDeck";
import GlitchSweep from "./GlitchSweep";
import StatsStrip from "./StatsStrip";
import StageTrack from "./StageTrack";
import styles from "./PipelinePanel.module.css";

interface CometPosition { id: number; x: number; y: number; }

export default function PipelinePanel() {
  const { state } = useStore();
  const bodyRef = useRef<HTMLDivElement>(null);
  const hexRef = useRef<HexGridHandle>(null);
  const litMapRef = useRef<Record<string, number>>({});
  const lastHexPushRef = useRef(0);
  const size = usePipeSize(bodyRef);

  const cells: HexCell[] = useMemo(() => buildHexes(size.w, size.h), [size.w, size.h]);

  const onCometPositions = useCallback((positions: CometPosition[]) => {
    const now = performance.now();
    if (now - lastHexPushRef.current < 50) return; // throttle to ~20 Hz
    lastHexPushRef.current = now;
    const map = { ...litMapRef.current };
    for (const k of Object.keys(map)) if (map[k]! < now) delete map[k];
    for (const p of positions) {
      const cell = findHexAt(cells, p.x, p.y);
      if (cell) map[cell.id] = now + 600;
    }
    litMapRef.current = map;
    hexRef.current?.setLit(map);
  }, [cells]);

  const running = state.stage !== "idle" && state.stage !== "done";
  const progress = state.stage === "done"
    ? 1
    : Math.min(1, state.totalPosts === 0 ? 0 : state.scrapedCount / state.totalPosts);

  const queued = Math.max(0, state.totalPosts - state.scrapedCount);
  const avgDur = state.scripts.length
    ? Math.round(state.scripts.reduce((s, x) => s + x.dur, 0) / state.scripts.length)
    : 0;

  return (
    <section className={styles.panel}>
      <div className={styles.head}>
        <div className={styles.headTitle}>
          <span className="badge">B</span>
          <span>Transform pipeline</span>
        </div>
        <StageTrack stage={state.stage} />
      </div>

      <div className={styles.body} ref={bodyRef}>
        <HexGrid ref={hexRef} width={size.w} height={size.h} />
        <CometCanvas comets={state.comets} width={size.w} height={size.h} onPositions={onCometPositions} />
        <PostStack posts={state.posts} totalCount={state.totalPosts || state.count} scrapedCount={state.scrapedCount} />
        <ReelDeck scripts={state.scripts} />
        <ScopeCore
          stage={state.stage}
          progress={progress}
          intensity={state.intensity}
          scraped={state.scrapedCount}
          elapsedStart={state.elapsedStart}
          running={running}
        />
        <GlitchSweep key={state.glitch} tick={state.glitch} />
      </div>

      <StatsStrip
        scraped={state.scrapedCount}
        count={state.totalPosts || state.count}
        queued={queued}
        scripts={state.scripts.length}
        avgDur={avgDur}
      />
    </section>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && npm run build`

Expected: passes. Type errors should be limited to the (now-orphaned) `Core` import path if it lingers anywhere — search for it and delete unused imports.

- [ ] **Step 4: Smoke-test**

Run dev. Open the dashboard.

Expected at idle:
- Pipeline body shows the hex honeycomb background, an empty post stack on the left, empty reel deck on the right, and the oscilloscope core dead-centre with a flat-ish wave and "STANDBY" label.
- Stage track at the top shows all four stages dimmed.
- Stats row at the bottom shows 0/000, 000, 000, 00s.

Expected during a run:
- "SCRAPE" stage label kicks in with a glitch sweep flash.
- For each scrape: a comet spawns from left-edge, flies the S-curve, lights up hex cells under its path, and lands at the right deck. Then a fresh reel card flips into the deck with a brightness flash.
- Oscilloscope wave spikes when the comet crosses midpoint.
- Stage label progresses through SCRAPE → PARSE → REELIFY → READY with a glitch sweep at each.
- Stats counters roll over via the slot-roller animation.
- Elapsed time and throughput readouts update in the scope's top-right corner.

If hex cells are not lighting, the throttle is too aggressive or the path-to-hex mapping is off — verify the `onCometPositions` callback fires and `cell.id`s match.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/PipelinePanel
git commit -m "feat(v2): wire cinematic pipeline — hex, comets, scope, stacks, glitch

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 19: Delete obsolete v1 Core

**Files:**
- Delete: `frontend/src/components/Core.tsx`
- Delete: `frontend/src/components/Core.module.css`

- [ ] **Step 1: Delete files**

```bash
git rm frontend/src/components/Core.tsx frontend/src/components/Core.module.css
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && npm run build`

Expected: passes. No remaining imports of `Core` anywhere.

- [ ] **Step 3: Commit**

```bash
git commit -m "chore(v2): remove legacy Core component (replaced by ScopeCore)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 20: PhonePreview — panel + scenes + kinetic reveal

**Files:**
- Create: `frontend/src/components/PhonePreview/index.tsx`
- Create: `frontend/src/components/PhonePreview/Phone.tsx`
- Create: `frontend/src/components/PhonePreview/KineticReveal.tsx`
- Create: `frontend/src/components/PhonePreview/scenes/Title.tsx`
- Create: `frontend/src/components/PhonePreview/scenes/Hook.tsx`
- Create: `frontend/src/components/PhonePreview/scenes/Proof.tsx`
- Create: `frontend/src/components/PhonePreview/scenes/Cta.tsx`
- Create: `frontend/src/components/PhonePreview/PhonePreview.module.css`

- [ ] **Step 1: KineticReveal**

Create `frontend/src/components/PhonePreview/KineticReveal.tsx`:

```tsx
import { useReducedMotion } from "../../hooks/useReducedMotion";

interface Props {
  text: string;
  stagger?: number;
}

export default function KineticReveal({ text, stagger = 60 }: Props) {
  const reduced = useReducedMotion();
  const words = text.split(/\s+/);
  if (reduced) return <span>{text}</span>;
  return (
    <span style={{ display: "inline-block" }}>
      {words.map((w, i) => (
        <span
          key={i}
          style={{
            display: "inline-block",
            marginRight: "0.25em",
            opacity: 0,
            transform: "translateY(6px)",
            animation: `kineticUp 0.45s cubic-bezier(.4,0,.2,1) ${i * stagger}ms forwards`,
          }}
        >
          {w}
        </span>
      ))}
    </span>
  );
}
```

- [ ] **Step 2: Scene components**

Create `frontend/src/components/PhonePreview/scenes/Title.tsx`:

```tsx
import type { Script } from "../../../types";
import KineticReveal from "../KineticReveal";

export default function Title({ script }: { script: Script }) {
  return (
    <>
      <div className="phone-author">{script.author}</div>
      <div style={{
        marginTop: 4, fontSize: 10, fontFamily: "Geist Mono, monospace",
        color: "oklch(1 0 0 / 0.6)",
      }}>{script.role}</div>
      <div style={{ marginTop: "auto", marginBottom: 18 }}>
        <div style={{
          fontSize: 11, fontFamily: "Geist Mono, monospace",
          letterSpacing: "0.16em", textTransform: "uppercase",
          color: "oklch(1 0 0 / 0.6)",
        }}>
          reel · {script.id.replace(/^script-/, "").padStart(3, "0")}
        </div>
        <div style={{
          fontWeight: 800, fontSize: 28, lineHeight: 1.05,
          letterSpacing: "-0.02em", marginTop: 4,
        }}>
          <KineticReveal text="A short take." />
        </div>
      </div>
    </>
  );
}
```

Create `frontend/src/components/PhonePreview/scenes/Hook.tsx`:

```tsx
import type { Script } from "../../../types";
import { useReducedMotion } from "../../../hooks/useReducedMotion";

export default function Hook({ script }: { script: Script }) {
  const reduced = useReducedMotion();
  const text = script.hook.replace(/^"|"$/g, "").trim();
  const words = text.split(/\s+/);
  const seen = new Set<string>();
  return (
    <>
      <div className="phone-author">/ the hook</div>
      <div className="phone-hook" style={{ marginTop: 16 }}>
        <span>
          {words.map((w, i) => {
            const norm = w.replace(/[^a-zA-Z]/g, "").toLowerCase();
            const isKw =
              script.keywords.some((k) => k.toLowerCase() === norm) &&
              !seen.has(norm);
            if (isKw) seen.add(norm);
            const content = isKw ? <span className="kbox">{w}</span> : w;
            if (reduced) {
              return <span key={i} style={{ marginRight: "0.25em" }}>{content}</span>;
            }
            return (
              <span key={i} style={{
                display: "inline-block", marginRight: "0.25em",
                opacity: 0, transform: "translateY(8px)",
                animation: `kineticUp 0.5s cubic-bezier(.4,0,.2,1) ${i * 70}ms forwards`,
              }}>{content}</span>
            );
          })}
        </span>
      </div>
      <div style={{ marginTop: "auto" }} />
    </>
  );
}
```

Create `frontend/src/components/PhonePreview/scenes/Proof.tsx`:

```tsx
import type { Script } from "../../../types";
import KineticReveal from "../KineticReveal";

export default function Proof({ script }: { script: Script }) {
  return (
    <>
      <div className="phone-author">/ proof</div>
      <div style={{ marginTop: 16, fontWeight: 600, fontSize: 15, lineHeight: 1.3 }}>
        <KineticReveal text={script.body} stagger={28} />
      </div>
    </>
  );
}
```

Create `frontend/src/components/PhonePreview/scenes/Cta.tsx`:

```tsx
import KineticReveal from "../KineticReveal";

export default function Cta() {
  return (
    <>
      <div className="phone-author">/ next</div>
      <div style={{ marginTop: "auto", marginBottom: 20 }}>
        <div style={{
          fontWeight: 800, fontSize: 26, lineHeight: 1.05,
          letterSpacing: "-0.02em",
        }}>
          <KineticReveal text="Save this · share it · steal it." />
        </div>
        <div className="phone-cta" style={{ marginTop: 14 }}>
          <i /> by reelify.agent
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 3: Phone (frame, screen, scenes, particles)**

Create `frontend/src/components/PhonePreview/Phone.tsx`:

```tsx
import { useEffect, useState } from "react";
import type { Script } from "../../types";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import Title from "./scenes/Title";
import Hook from "./scenes/Hook";
import Proof from "./scenes/Proof";
import Cta from "./scenes/Cta";

const SCENE_COUNT = 4;
const SCENE_DUR = 1800;

export default function Phone({ script }: { script: Script }) {
  const [sceneIdx, setSceneIdx] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => { setSceneIdx(0); }, [script.id]);
  useEffect(() => {
    const id = window.setInterval(() => {
      setSceneIdx((i) => (i + 1) % SCENE_COUNT);
    }, SCENE_DUR);
    return () => window.clearInterval(id);
  }, [script.id]);

  const particles = Array.from({ length: 7 }, (_, i) => ({
    x: 10 + (i * 21) % 150,
    delay: (i * 0.31).toFixed(2),
    dx: ((i % 2) ? 1 : -1) * (5 + i * 3),
  }));

  return (
    <div className="phone">
      <div className="phone-screen" style={{ ["--ph" as never]: script.h }}>
        <div className="phone-notch" />
        {!reduced && (
          <div className="phone-particles">
            {particles.map((p, i) => (
              <span key={i} style={{
                left: p.x + "px",
                bottom: "30px",
                ["--x" as never]: p.dx + "px",
                animationDelay: p.delay + "s",
              }} />
            ))}
          </div>
        )}
        <div className="phone-ui" key={sceneIdx}>
          {sceneIdx === 0 && <Title script={script} />}
          {sceneIdx === 1 && <Hook script={script} />}
          {sceneIdx === 2 && <Proof script={script} />}
          {sceneIdx === 3 && <Cta />}
        </div>
        <div className="phone-scenes">
          {Array.from({ length: SCENE_COUNT }).map((_, i) => (
            <i
              key={i + "-" + sceneIdx}
              className={i < sceneIdx ? "done" : i === sceneIdx ? "now" : ""}
              style={{ ["--scene-dur" as never]: SCENE_DUR + "ms" }}
            >
              {i === sceneIdx && <b />}
            </i>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: PhonePreview panel**

Create `frontend/src/components/PhonePreview/index.tsx`:

```tsx
import { useStore } from "../../state/store";
import Phone from "./Phone";
import styles from "./PhonePreview.module.css";

export default function PhonePreview() {
  const { state } = useStore();
  const preview = state.activeScriptId
    ? state.scripts.find((s) => s.id === state.activeScriptId) ?? state.scripts[0]
    : state.scripts[0];

  if (!preview) {
    return (
      <section className={`${styles.panel} ${styles.phonePanel}`}>
        <div className={styles.head}>
          <span><span className={styles.num}>D</span>Reel preview</span>
          <span style={{ color: "var(--fg-3)" }}>idle</span>
        </div>
        <div className={styles.stage}>
          <div className={styles.empty}>
            <div className={styles.emptyBig}>No reel ready</div>
            Generated reels will auto-preview here, with kinetic scenes for hook, proof, and CTA.
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={`${styles.panel} ${styles.phonePanel}`}>
      <div className={styles.head}>
        <span><span className={styles.num}>D</span>Reel preview · auto-play</span>
      </div>
      <div className={styles.stage} style={{ ["--ph" as never]: preview.h }}>
        <Phone script={preview} />
        <div className={styles.meta}>
          <div>
            <div className={styles.k}>// next up</div>
            <div className={styles.v}>{preview.title}</div>
          </div>
          <div>
            <div className={styles.k}>// duration · scenes</div>
            <div className={`${styles.v} ${styles.mono}`}>
              {preview.dur}s · {preview.sceneCount} cuts
            </div>
          </div>
          <div>
            <div className={styles.k}>// tags</div>
            <div className={styles.tags}>
              {preview.tags.slice(0, 4).map((t) => <span key={t}>{t}</span>)}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: PhonePreview.module.css**

Create `frontend/src/components/PhonePreview/PhonePreview.module.css`:

```css
.panel {
  composes: panel from "../../styles/app.module.css";
}

.phonePanel {
  padding: 0;
  overflow: hidden;
}

.head {
  padding: 14px 18px;
  border-bottom: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-family: "Geist Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--fg-3);
}

.num {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  display: inline-grid;
  place-items: center;
  background: var(--bg-3);
  color: var(--fg-2);
  font-size: 10px;
  margin-right: 6px;
}

.stage {
  padding: 22px 18px;
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 18px;
  align-items: center;
  background: radial-gradient(300px 200px at 20% 50%, oklch(0.30 0.06 var(--ph, 130) / 0.18), transparent 70%);
}

.meta {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.k {
  font-family: "Geist Mono", monospace;
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--fg-3);
  margin-bottom: 4px;
}

.v {
  font-size: 14px;
  font-weight: 600;
  color: var(--fg);
  line-height: 1.3;
}

.mono {
  font-family: "Geist Mono", monospace;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tags span {
  font-family: "Geist Mono", monospace;
  font-size: 10px;
  color: var(--fg-2);
  padding: 2px 6px;
  border: 1px solid var(--line-2);
  border-radius: 4px;
  background: oklch(0.20 0.010 70 / 0.6);
}

.empty {
  grid-column: 1 / -1;
  text-align: center;
  padding: 36px 18px;
  color: var(--fg-3);
  font-size: 13px;
}

.emptyBig {
  font-family: "Geist Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--fg-2);
  margin-bottom: 6px;
}

/* Phone frame + screen */
:global(.phone) {
  position: relative;
  width: 180px;
  height: 320px;
  border-radius: 28px;
  padding: 6px;
  background: linear-gradient(160deg, var(--bg-4), var(--bg-2));
  border: 1px solid var(--line-2);
  box-shadow: 0 20px 50px oklch(0 0 0 / 0.5), inset 0 0 0 1px oklch(1 0 0 / 0.04);
}

:global(.phone-screen) {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 22px;
  background:
    radial-gradient(circle at 30% 20%, oklch(0.55 0.18 var(--ph, 130) / 0.5), transparent 70%),
    linear-gradient(170deg, oklch(0.35 0.10 var(--ph, 130)), oklch(0.20 0.04 var(--ph, 130)));
  overflow: hidden;
  transition: background 0.6s ease;
}

:global(.phone-notch) {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  width: 56px;
  height: 14px;
  background: oklch(0 0 0 / 0.7);
  border-radius: 7px;
  z-index: 3;
}

:global(.phone-ui) {
  position: absolute;
  inset: 0;
  padding: 28px 14px 14px;
  display: flex;
  flex-direction: column;
  color: oklch(1 0 0 / 0.96);
}

:global(.phone-author) {
  font-family: "Geist Mono", monospace;
  font-size: 9px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: oklch(1 0 0 / 0.7);
}

:global(.phone-hook) {
  margin-top: auto;
  margin-bottom: 12px;
  font-weight: 800;
  font-size: 19px;
  line-height: 1.15;
  letter-spacing: -0.01em;
  text-shadow: 0 2px 12px oklch(0 0 0 / 0.4);
}

:global(.phone-hook .kbox) {
  display: inline-block;
  padding: 0 4px;
  background: oklch(0 0 0 / 0.4);
  border-radius: 3px;
}

:global(.phone-cta) {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: "Geist Mono", monospace;
  font-size: 10px;
  color: oklch(1 0 0 / 0.85);
  letter-spacing: 0.05em;
}

:global(.phone-cta i) {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: oklch(1 0 0 / 0.95);
  display: inline-block;
}

:global(.phone-scenes) {
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: 6px;
  display: flex;
  gap: 3px;
  z-index: 4;
}

:global(.phone-scenes i) {
  flex: 1;
  height: 2px;
  background: oklch(1 0 0 / 0.25);
  border-radius: 1px;
  overflow: hidden;
}

:global(.phone-scenes i.done) { background: oklch(1 0 0 / 0.9); }

:global(.phone-scenes i.now b) {
  display: block;
  height: 100%;
  background: oklch(1 0 0 / 0.9);
  animation: sceneFill var(--scene-dur, 1.5s) linear forwards;
}

@keyframes sceneFill { from { width: 0; } to { width: 100%; } }

:global(.phone-particles) {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

:global(.phone-particles span) {
  position: absolute;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: oklch(1 0 0 / 0.9);
  opacity: 0;
  animation: phonePart 2.2s ease-out infinite;
}

@keyframes phonePart {
  0%   { transform: translate(var(--x, 0px), 0) scale(0.5); opacity: 0; }
  20%  { opacity: 0.9; }
  100% { transform: translate(var(--x, 0px), -200px) scale(1.2); opacity: 0; }
}

@keyframes kineticUp { to { opacity: 1; transform: translateY(0); } }

@media (prefers-reduced-motion: reduce) {
  :global(.phone-particles) { display: none; }
  :global(.phone-scenes i.now b) { animation: none; width: 100%; }
}
```

- [ ] **Step 6: Verify build**

Run: `cd frontend && npm run build`

Expected: passes.

- [ ] **Step 7: Mount PhonePreview in App.tsx**

Modify `frontend/src/App.tsx`:

```tsx
import styles from "./styles/app.module.css";
import Header from "./components/Header";
import ConfigurePanel from "./components/ConfigurePanel";
import PipelinePanel from "./components/PipelinePanel";
import ScriptsPanel from "./components/ScriptsPanel";
import Terminal from "./components/Terminal";
import Dust from "./components/Dust";
import PhonePreview from "./components/PhonePreview";

export default function App() {
  return (
    <div className={styles.app}>
      <Dust />
      <Header />
      <div className={styles.grid}>
        <ConfigurePanel />
        <PipelinePanel />
        <div className={styles.rightCol}>
          <PhonePreview />
          <ScriptsPanel />
        </div>
      </div>
      <div className={styles.termStrip}>
        <Terminal />
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Smoke-test**

Run dev. Start a run. Once at least one script lands, the phone preview should appear at the top of the right column. Watch it cycle: Title → Hook → Proof → CTA, ~1.8 s each, with per-word reveal. When new scripts land, the preview stays on the current one until the user clicks (wiring for that lands in Task 21).

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/PhonePreview frontend/src/App.tsx
git commit -m "feat(v2): PhonePreview with auto-cycling kinetic scenes

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 21: ScriptsPanel — compact horizontal cards + click-to-preview

**Files:**
- Modify: `frontend/src/components/ScriptsPanel.tsx`
- Modify: `frontend/src/components/ScriptsPanel.module.css`

- [ ] **Step 1: Rewrite ScriptsPanel.tsx**

Replace `frontend/src/components/ScriptsPanel.tsx`:

```tsx
import { useStore } from "../state/store";
import { Chev } from "../icons";
import styles from "./ScriptsPanel.module.css";

export default function ScriptsPanel() {
  const { state, dispatch } = useStore();
  const activeId = state.activeScriptId ?? state.scripts[0]?.id ?? null;

  return (
    <section className={styles.panel}>
      <div className={styles.head}>
        <div className={styles.headTitle}>
          <span className={styles.badge}>E</span>
          <span>Reel scripts</span>
        </div>
        <span className={styles.count}>{state.scripts.length} ready</span>
      </div>

      {state.scripts.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyBig}>No scripts yet</div>
          Press <span style={{ color: "var(--accent)" }}>Run pipeline</span> to generate from saved posts.
        </div>
      ) : (
        <div className={styles.list}>
          {state.scripts.map((s, i) => {
            const active = activeId === s.id;
            return (
              <button
                key={s.id}
                type="button"
                className={`${styles.card} ${active ? styles.active : ""}`}
                style={{ animationDelay: `${Math.min(i, 6) * 30}ms` }}
                onClick={() => dispatch({ type: "SET_ACTIVE_SCRIPT", id: s.id })}
              >
                <span className={styles.idx}>{String(i + 1).padStart(2, "0")}</span>
                <span className={styles.body}>
                  <span className={styles.title}>{s.title}</span>
                  <span className={styles.row}>
                    <span className={styles.dur}>{s.dur}s</span>
                    <span>· {s.sceneCount} scenes</span>
                    <span className={styles.scenesMini}>
                      {Array.from({ length: Math.min(5, s.sceneCount) }).map((_, k) => (
                        <i key={k} className={k === 0 ? styles.miniHl : ""} />
                      ))}
                    </span>
                  </span>
                </span>
                <span className={styles.open}><Chev width={12} height={12} /></span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Rewrite ScriptsPanel.module.css**

Replace `frontend/src/components/ScriptsPanel.module.css`:

```css
.panel {
  composes: panel from "../styles/app.module.css";
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  font-family: "Geist Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--fg-3);
}

.headTitle {
  display: flex;
  align-items: center;
}

.badge {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  display: inline-grid;
  place-items: center;
  background: var(--bg-3);
  color: var(--fg-2);
  font-size: 10px;
  margin-right: 6px;
}

.count {
  font-size: 10px;
  color: var(--fg-3);
}

.empty {
  padding: 26px 12px;
  text-align: center;
  color: var(--fg-3);
  font-size: 12px;
}

.emptyBig {
  font-family: "Geist Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--fg-2);
  margin-bottom: 6px;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: auto;
  max-height: 290px;
  padding-right: 4px;
}

.list::-webkit-scrollbar { width: 6px; }
.list::-webkit-scrollbar-thumb { background: var(--line-2); border-radius: 3px; }

.card {
  appearance: none;
  text-align: left;
  background: var(--bg-3);
  border: 1px solid var(--line-2);
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  gap: 10px;
  align-items: center;
  opacity: 0;
  transform: translateX(20px);
  animation: scriptIn 0.5s cubic-bezier(.3,0,.2,1) forwards;
  color: var(--fg);
  cursor: pointer;
  font-family: inherit;
}

.card:hover {
  border-color: var(--accent);
}

.card.active {
  border-color: var(--accent);
  background: oklch(0.30 0.04 130 / 0.18);
}

@keyframes scriptIn {
  to { opacity: 1; transform: translateX(0); }
}

.idx {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: oklch(0.30 0.04 130 / 0.5);
  color: var(--accent);
  font-family: "Geist Mono", monospace;
  font-size: 11px;
  display: grid;
  place-items: center;
  font-weight: 600;
  flex-shrink: 0;
}

.body {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.title {
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row {
  margin-top: 4px;
  display: flex;
  gap: 8px;
  align-items: center;
  font-family: "Geist Mono", monospace;
  font-size: 10px;
  color: var(--fg-3);
}

.dur { color: var(--accent); }

.scenesMini {
  display: inline-flex;
  gap: 1px;
  margin-left: auto;
}

.scenesMini i {
  width: 5px;
  height: 6px;
  background: var(--accent-deep);
  border-radius: 1px;
}

.miniHl { background: var(--accent) !important; }

.open {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: var(--bg-4);
  border: 1px solid var(--line-2);
  color: var(--fg-2);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

@media (prefers-reduced-motion: reduce) {
  .card { animation: none; opacity: 1; transform: none; }
}
```

- [ ] **Step 3: Smoke-test**

Run dev. Start a run. Each new script row should slide in from the right with a 30 ms stagger. Click a card: the phone preview switches to that script, and the clicked card gets the active (accent-bordered) treatment.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ScriptsPanel.tsx frontend/src/components/ScriptsPanel.module.css
git commit -m "feat(v2): compact horizontal script cards + click-to-preview

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 22: Terminal — full-width strip with 2-column body

**Files:**
- Modify: `frontend/src/components/Terminal.tsx`
- Modify: `frontend/src/components/Terminal.module.css`

- [ ] **Step 1: Update Terminal.tsx**

Replace `frontend/src/components/Terminal.tsx`:

```tsx
import { useEffect, useRef } from "react";
import { useStore } from "../state/store";
import styles from "./Terminal.module.css";

export default function Terminal() {
  const { state } = useStore();
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [state.logLines.length]);

  const running = state.stage !== "idle" && state.stage !== "done";

  return (
    <section className={styles.panel}>
      <div className={styles.head}>
        <div className={styles.dots}><i /><i /><i /></div>
        <span>playwright · agent.log</span>
        <span className={styles.subhead}>· stream</span>
        <div className={styles.spacer} />
        <span className={styles.count}>{state.logLines.length} lines</span>
      </div>
      <div className={styles.body} ref={bodyRef}>
        {state.logLines.length === 0 && (
          <div className={styles.idle}>
            $ reelify --watch <span className={styles.cursor} />
          </div>
        )}
        {state.logLines.map((l, i) => (
          <div key={i} className={`${styles.line} ${styles[l.level] ?? ""}`}>
            <span className={styles.t}>{l.t}</span>
            <span className={styles.tag}>[{l.tag}]</span>
            <span className={styles.msg}>{l.msg}</span>
          </div>
        ))}
        {running && (
          <div className={styles.idle}>$ <span className={styles.cursor} /></div>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Update Terminal.module.css**

Replace `frontend/src/components/Terminal.module.css`:

```css
.panel {
  composes: panel from "../styles/app.module.css";
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 180px;
}

.head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--line);
  font-family: "Geist Mono", monospace;
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--fg-3);
}

.dots {
  display: flex;
  gap: 4px;
  margin-right: 8px;
}

.dots i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.dots i:nth-child(1) { background: oklch(0.65 0.18 25); }
.dots i:nth-child(2) { background: oklch(0.78 0.14 80); }
.dots i:nth-child(3) { background: oklch(0.70 0.15 145); }

.subhead {
  margin-left: 12px;
  color: var(--fg-3);
}

.spacer { flex: 1; }

.count {
  color: var(--fg-3);
}

.body {
  flex: 1;
  overflow: auto;
  padding: 10px 16px;
  font-family: "Geist Mono", monospace;
  font-size: 11px;
  line-height: 1.55;
  color: var(--fg-2);
  columns: 2;
  column-gap: 32px;
  column-rule: 1px solid var(--line);
}

.body::-webkit-scrollbar { width: 6px; }
.body::-webkit-scrollbar-thumb { background: var(--line-2); border-radius: 3px; }

.line {
  display: flex;
  gap: 8px;
  opacity: 0;
  animation: logIn 0.2s ease forwards;
  break-inside: avoid;
  margin-bottom: 1px;
}

@keyframes logIn { to { opacity: 1; } }

.line .t {
  color: var(--fg-3);
  flex-shrink: 0;
}

.line .tag {
  flex-shrink: 0;
  min-width: 56px;
  color: var(--fg-3);
}

.line.info .tag { color: var(--cyan); }
.line.ok   .tag { color: var(--accent); }
.line.warn .tag { color: var(--warn); }

.line .msg {
  color: var(--fg);
  min-width: 0;
}

.idle {
  color: var(--fg-3);
  break-inside: avoid;
}

.cursor {
  display: inline-block;
  width: 7px;
  height: 12px;
  background: var(--accent);
  vertical-align: -2px;
  animation: blink 1s steps(2) infinite;
}

@keyframes blink { 50% { opacity: 0; } }

@media (max-width: 1240px) {
  .body { columns: 1; column-rule: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .line { animation: none; opacity: 1; }
}
```

The level → tag-colour mapping flips to `var(--cyan)` for info and `var(--accent)` for ok, per the spec.

- [ ] **Step 3: Smoke-test**

Run dev. Start a run. The terminal strip should span full width below the grid, log lines should appear in 2 columns with a faint divider rule, info tags should be cyan-tinted, ok tags accent-green, warn tags yellow.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Terminal.tsx frontend/src/components/Terminal.module.css
git commit -m "feat(v2): full-width terminal strip + 2-col body + cyan info tags

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 23: Memoize stable consumers to dodge frame-rate re-renders

**Files:**
- Modify: `frontend/src/components/PhonePreview/index.tsx`
- Modify: `frontend/src/components/Terminal.tsx`
- Modify: `frontend/src/components/ConfigurePanel.tsx`
- Modify: `frontend/src/components/ScriptsPanel.tsx`

The store re-renders at ~60 Hz while comets are flying. Components that don't depend on `comets[]`, `intensity`, or `elapsedStart` should opt out via `React.memo`.

- [ ] **Step 1: Wrap each component**

For each of the four files, change the default export from a function declaration to a memoized component. Concrete example for `PhonePreview/index.tsx`:

Find:
```tsx
export default function PhonePreview() {
  // ...
}
```

Replace with:
```tsx
import { memo } from "react";

function PhonePreview() {
  // ...
}

export default memo(PhonePreview);
```

Repeat for `Terminal`, `ConfigurePanel`, and `ScriptsPanel`. Don't memo `Header` (it consumes `elapsedStart` indirectly via `useElapsed`, but only re-renders when `state.stage` changes — actually it does re-render every frame because `useElapsed` ticks `setMs`; but that's local state, not from the store — so memo isn't useful there). Don't memo `PipelinePanel` — it intentionally re-renders every frame to project comet positions.

Wait — the four components above all subscribe to `useStore()`, which re-emits a fresh `state` object on every `COMET_FRAME`. `memo` won't help unless we also stop them from re-running entirely. Better: extract just the fields they need via a memoized selector.

Concrete fix: at the top of each of those four files, replace `const { state } = useStore();` with selective destructuring + a `useMemo` to stabilize the shape. Example:

```tsx
import { memo, useMemo } from "react";
import { useStore } from "../state/store";

function Terminal() {
  const { state } = useStore();
  const view = useMemo(
    () => ({ logLines: state.logLines, stage: state.stage }),
    [state.logLines, state.stage],
  );
  // ...use `view` instead of `state`...
}
```

For PhonePreview, the relevant fields are `state.scripts`, `state.activeScriptId`. For ConfigurePanel: `state.count`, `state.tone`, `state.stage`. For ScriptsPanel: `state.scripts`, `state.activeScriptId`, and the `dispatch`.

This is the simplest pattern; React still walks the tree (so `memo` alone wouldn't have helped), but each component's expensive body only re-executes when its actual deps change because the JSX consumed below is keyed on `view.*` values that don't churn.

Apply this pattern to all four files. Show the final code only for `Terminal.tsx`:

```tsx
import { useEffect, useMemo, useRef } from "react";
import { useStore } from "../state/store";
import styles from "./Terminal.module.css";

export default function Terminal() {
  const { state } = useStore();
  const view = useMemo(
    () => ({ logLines: state.logLines, stage: state.stage }),
    [state.logLines, state.stage],
  );

  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [view.logLines.length]);

  const running = view.stage !== "idle" && view.stage !== "done";

  return (
    <section className={styles.panel}>
      {/* ...rest unchanged, swap state.* → view.* ... */}
    </section>
  );
}
```

For `PhonePreview/index.tsx`, `ConfigurePanel.tsx`, and `ScriptsPanel.tsx`, apply the same pattern. Drop the `memo` wrapper — the `useMemo`-of-view is sufficient.

- [ ] **Step 2: Verify build**

Run: `cd frontend && npm run build`

Expected: passes.

- [ ] **Step 3: Smoke-test**

Run dev. Open React DevTools profiler. Start a run. Confirm: while comets are flying, `PipelinePanel` and its children re-render every frame (expected), but `Terminal`, `PhonePreview`, `ConfigurePanel`, and `ScriptsPanel` only re-render when their actual dependencies change. The page should feel smooth under load (50–100 post run).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/PhonePreview/index.tsx frontend/src/components/Terminal.tsx frontend/src/components/ConfigurePanel.tsx frontend/src/components/ScriptsPanel.tsx
git commit -m "perf(v2): stabilize stable consumers via useMemo views

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 24: Full manual verification pass

This is the final acceptance check before declaring v2 cutover complete. No code changes — only running through the scenarios in the spec and confirming each works.

**Files:** none (verification only)

- [ ] **Step 1: Clean build**

Run: `cd frontend && npm run build`

Expected: passes with no warnings.

- [ ] **Step 2: Idle state**

Start dev server (`npm run dev`) and the backend (`python main.py` from repo root). Open the dashboard.

Confirm:
- [ ] Header pill shows "Idle · agent ready" with no timer.
- [ ] Brand mark has a slow light-sheen sweep.
- [ ] Pipeline body shows hex honeycomb + flat oscilloscope + "STANDBY" label.
- [ ] Post stack and reel deck are empty (no cards), counters read 00.
- [ ] Phone preview shows "No reel ready" empty state.
- [ ] Scripts panel shows "No scripts yet".
- [ ] Terminal shows blinking-cursor prompt.
- [ ] Ambient dust drifting across the viewport.

- [ ] **Step 3: Run lifecycle**

Press "Run pipeline" with count = 10, tone = Punchy.

Confirm:
- [ ] Status pill switches to "Live · scraping..." + live-pinging dot + ticking mm:ss timer.
- [ ] Glitch sweep flashes through the pipe body on the SCRAPE stage entry.
- [ ] Comets spawn at the left edge as `post_scraped` events arrive, one per post.
- [ ] Each comet flies the S-curve from left to right, leaving hex cells lit along its path.
- [ ] Oscilloscope wave spikes when each comet crosses the centre.
- [ ] After a comet lands (~2.4 s post-spawn), a fresh reel card flashes into the right deck.
- [ ] Soon after, the corresponding script row appears in the script list with a slide-in animation.
- [ ] Stats counters (scraped, queue, scripts, avg dur) roll over with slot-machine digits.
- [ ] Stage label progresses through SCRAPE → PARSE → REELIFY with a glitch sweep on each transition.
- [ ] Throughput readout updates (scraped / elapsed).

- [ ] **Step 4: Script interaction**

- [ ] Click a script in the list — phone preview switches to it, current card gets accent border.
- [ ] Phone cycles Title → Hook → Proof → CTA every 1.8 s with per-word reveal.

- [ ] **Step 5: Completion**

Wait for the run to finish.

Confirm:
- [ ] Stage shows READY. Status pill shows "Run complete · N scripts ready".
- [ ] Elapsed timer freezes at the final value.
- [ ] No remaining comets on screen.
- [ ] `scripts.length === count` (counts match).
- [ ] Phone preview keeps cycling on the active script.

- [ ] **Step 6: Stop mid-run**

Start another run. After 3–4 scrapes, press Stop.

Confirm:
- [ ] All comets clear instantly.
- [ ] Status returns to idle.
- [ ] No orphan scripts left in pending — start a fresh run and confirm `scripts.length` ends at the new count, not (old-pending + new).

- [ ] **Step 7: Reduced motion**

In macOS System Settings → Accessibility → Display → enable Reduce motion. Reload the dashboard.

Confirm during a run:
- [ ] Dust is gone.
- [ ] Comets show only the core dot + label (no trail, no hot-lane animation).
- [ ] Hex grid stays static.
- [ ] Oscilloscope shows a flat centreline (no continuous wave).
- [ ] No glitch sweep.
- [ ] No reel-fresh brightness flash.
- [ ] No phone particles.
- [ ] No per-word kinetic reveal (scenes appear all at once).
- [ ] No script-card stagger.

Disable Reduce motion again for normal use.

- [ ] **Step 8: Narrow viewport**

Resize the browser to < 1240 px.

Confirm:
- [ ] Grid collapses to single column.
- [ ] Terminal stays full-width.
- [ ] Page is usable end-to-end.

- [ ] **Step 9: SSE disconnect**

While running, kill the backend (Ctrl-C `main.py`).

Confirm:
- [ ] "SSE connection lost" warning shows in the terminal as a warn line.
- [ ] Any in-flight comets still land normally.
- [ ] No console errors / crashes.

Restart backend and start a new run — should work cleanly.

- [ ] **Step 10: Commit verification doc (optional)**

If any of the above failed, note the failure in a short doc and fix before declaring complete. If everything passed, no commit needed — proceed to the wrap-up.

- [ ] **Step 11: Wrap-up commit (only if there were fixups during verification)**

```bash
git add <fixed files>
git commit -m "fix(v2): verification-pass fixes

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Done

At the end of this plan the dashboard should match the v2 README's visual + behavioural spec, gated against the real SSE backend stream, with reduced-motion fallbacks in place.

**Files created (count):** 23 (3 hooks, 2 utils, 1 Dust, 9 PipelinePanel subtree, 8 PhonePreview subtree). **Files modified (count):** 9 (App, store, types, tokens, app.module.css, Header pair, ConfigurePanel.module.css, ScriptsPanel pair, Terminal pair). **Files deleted (count):** 2 (Core pair).

If anything in the spec was missed during implementation, surface it in the verification pass (Task 24) rather than papering over.
