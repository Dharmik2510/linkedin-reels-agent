export type Tone = "Punchy" | "Story-led" | "Analytical" | "Educational";
export type Language = "en" | "gu" | "hi";

export type Stage =
  | "idle"
  | "scraping"
  | "analyzing"
  | "parsing"
  | "generating"
  | "done";

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

export interface AgentStep {
  stepId: string;
  runId: string | null;
  postIndex: number | null;
  agent: string;
  step: string;
  status: "started" | "completed" | "failed";
  message: string;
  model: string | null;
  costUsd: number;
  durationMs: number | null;
  reasoning: string | null;
  outputSummary: string | null;
  timestamp: string;
}

export interface Comet {
  id: number;
  postIndex: number;
  t: number;
  born: number;
  label: string;
  hue: number;
}

export interface RawEvent {
  type: string;
  agent: string;
  message: string;
  payload: Record<string, unknown>;
  timestamp: string;
}
