import {
  createContext, useContext, useEffect, useMemo, useReducer, useRef,
  type ReactNode,
} from "react";
import { subscribe } from "../api";
import { usePipelineEngine } from "../hooks/usePipelineEngine";
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
          if (withLog.landed.has(script!.postIndex)) {
            const nextLanded = new Set(withLog.landed);
            nextLanded.delete(script!.postIndex);
            return commitScript({ ...withLog, landed: nextLanded }, script!);
          }
          // Otherwise buffer it.
          const nextPending = new Map(withLog.pendingScripts);
          nextPending.set(script!.postIndex, script!);
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
  const running = state.stage !== "idle" && state.stage !== "done";
  usePipelineEngine(state.comets, running, dispatch);
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
