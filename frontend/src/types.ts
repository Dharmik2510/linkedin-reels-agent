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
  hookRaw: string;
  dur: number;
  sceneCount: number;
  tags: string[];
  hashtags: string[];
  caption: string;
  cta: string;
  postUrl: string;
  body: string;
  author: string;
  role: string;
  initials: string;
  h: number;
  keywords: string[];
  edited?: boolean;
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
