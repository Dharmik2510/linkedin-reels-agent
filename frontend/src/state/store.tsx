import {
  createContext, useContext, useEffect, useMemo, useReducer, useRef,
  type ReactNode,
} from "react";
import { subscribe } from "../api";
import type {
  LogLine, Post, RawEvent, Script, Stage, Tone,
} from "../types";

interface RunState {
  count: number;
  tone: Tone;
  stage: Stage;
  posts: Post[];           // most-recent 4 (rolling buffer)
  flying: string;          // id of currently flying-out post
  scripts: Script[];
  logLines: LogLine[];
  scrapedCount: number;
  totalPosts: number;
}

type Action =
  | { type: "SET_COUNT"; n: number }
  | { type: "SET_TONE"; tone: Tone }
  | { type: "RESET" }
  | { type: "EVENT"; ev: RawEvent }
  | { type: "STREAM_ERROR" };

const initial: RunState = {
  count: 10,
  tone: "Punchy",
  stage: "idle",
  posts: [],
  flying: "",
  scripts: [],
  logLines: [],
  scrapedCount: 0,
  totalPosts: 0,
};

function hashHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

function timeStamp(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const cs = String(Math.floor(d.getMilliseconds() / 10)).padStart(2, "0");
  return `${hh}:${mm}:${ss}.${cs}`;
}

function deriveScript(raw: RawEvent): Script | null {
  const s = raw.payload?.script as Record<string, unknown> | undefined;
  if (!s) return null;
  const idx = (raw.payload?.post_index as number | undefined) ?? 0;
  const body = String(s.script ?? "");
  const hook = String(s.hook ?? "");
  const wordCount = body.split(/\s+/).filter(Boolean).length;
  const dur = Math.max(15, Math.min(60, Math.round(wordCount / 2.5)));
  const sceneCount = Math.max(3, Math.min(6, body.split(/\n/).filter(Boolean).length || 4));
  const hashtags = (s.hashtags as string[] | undefined) ?? [];
  return {
    id: `script-${idx}`,
    title: hook.length > 60 ? hook.slice(0, 58) + "…" : hook,
    hook: `"${hook}"`,
    dur,
    sceneCount,
    tags: hashtags.slice(0, 4).map((t) => `#${t.replace(/^#/, "")}`),
    body,
  };
}

function derivePost(raw: RawEvent): Post | null {
  const p = raw.payload?.post as Record<string, unknown> | undefined;
  if (!p) return null;
  const author = String(p.author ?? "Unknown");
  const text = String(p.text_content ?? "");
  const idx = raw.payload?.index ?? raw.timestamp;
  return {
    id: `post-${idx}`,
    author,
    role: "saved post",
    body: text.length > 82 ? text.slice(0, 80) + "…" : text,
    h: hashHue(author),
  };
}

function logFromEvent(raw: RawEvent): LogLine | null {
  const t = timeStamp(raw.timestamp);
  switch (raw.type) {
    case "orchestrator_start":
      return { t, tag: "boot", level: "info", msg: raw.message };
    case "scraper_login":
      return { t, tag: "auth", level: "info", msg: raw.message };
    case "scraper_verification":
      return { t, tag: "auth", level: "warn", msg: raw.message };
    case "scraper_navigating":
      return { t, tag: "nav", level: "info", msg: raw.message };
    case "scraper_scrolling":
      return { t, tag: "scroll", level: "info", msg: raw.message };
    case "scraper_done":
      return { t, tag: "parse", level: "ok", msg: raw.message };
    case "post_scraped":
      return { t, tag: "post", level: "info", msg: raw.message };
    case "content_generating":
      return { t, tag: "gen", level: "info", msg: raw.message };
    case "content_ready":
      return { t, tag: "write", level: "ok", msg: raw.message };
    case "content_error":
      return { t, tag: "gen", level: "warn", msg: raw.message };
    case "orchestrator_complete":
      return { t, tag: "done", level: "ok", msg: raw.message };
    case "error":
      return { t, tag: "err", level: "warn", msg: raw.message };
    case "stage_changed":
      return null; // stage changes drive UI directly, not the log
    default:
      return { t, tag: raw.agent.slice(0, 6), level: "info", msg: raw.message };
  }
}

function reducer(state: RunState, action: Action): RunState {
  switch (action.type) {
    case "SET_COUNT":
      return { ...state, count: action.n };
    case "SET_TONE":
      return { ...state, tone: action.tone };
    case "RESET":
      return {
        ...state,
        stage: "idle",
        posts: [],
        flying: "",
        scripts: [],
        logLines: [],
        scrapedCount: 0,
        totalPosts: 0,
      };
    case "EVENT": {
      const { ev } = action;
      const next: RunState = { ...state };
      const log = logFromEvent(ev);
      if (log) next.logLines = [...state.logLines, log].slice(-200);

      switch (ev.type) {
        case "orchestrator_start": {
          const total = Number(ev.payload?.num_posts ?? state.count);
          return {
            ...next,
            stage: "scraping",
            scrapedCount: 0,
            totalPosts: total,
            posts: [],
            scripts: [],
            flying: "",
          };
        }
        case "stage_changed": {
          const stage = String(ev.payload?.stage ?? "idle") as Stage;
          return { ...next, stage };
        }
        case "post_scraped": {
          const post = derivePost(ev);
          if (!post) return next;
          const previousFly = state.posts[state.posts.length - 1]?.id ?? "";
          const trimmed = state.posts.length >= 4 ? state.posts.slice(1) : state.posts;
          return {
            ...next,
            scrapedCount: state.scrapedCount + 1,
            posts: [...trimmed, post],
            flying: previousFly,
          };
        }
        case "content_ready": {
          const script = deriveScript(ev);
          if (!script) return next;
          return {
            ...next,
            scripts: [script, ...state.scripts].slice(0, 30),
          };
        }
        case "orchestrator_complete":
          return { ...next, stage: "done" };
        default:
          return next;
      }
    }
    case "STREAM_ERROR": {
      const t = (new Date()).toLocaleTimeString("en-GB", { hour12: false });
      const log: LogLine = {
        t,
        tag: "stream",
        level: "warn",
        msg: "SSE connection lost — backend may be offline",
      };
      return {
        ...state,
        stage: state.stage === "idle" || state.stage === "done" ? state.stage : "idle",
        logLines: [...state.logLines, log].slice(-200),
      };
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
