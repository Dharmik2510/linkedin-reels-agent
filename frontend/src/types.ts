export type Tone = "Punchy" | "Story-led" | "Analytical" | "Educational";

export type Stage = "idle" | "scraping" | "parsing" | "generating" | "done";

export interface Post {
  id: string;
  author: string;
  role: string;
  body: string;
  h: number;
}

export interface Script {
  id: string;
  title: string;
  hook: string;
  dur: number;
  sceneCount: number;
  tags: string[];
  body: string;
}

export interface LogLine {
  t: string;
  tag: string;
  level: "info" | "ok" | "warn";
  msg: string;
}

// Raw backend event shape (current contract).
export interface RawEvent {
  type: string;
  agent: string;
  message: string;
  payload: Record<string, unknown>;
  timestamp: string;
}
