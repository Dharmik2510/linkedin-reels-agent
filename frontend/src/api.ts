import type { Tone } from "./types";

export async function startRun(num_posts: number, tone: Tone): Promise<void> {
  const res = await fetch("/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ num_posts, tone }),
  });
  if (!res.ok && res.status !== 409) {
    throw new Error(`Run failed: ${res.status}`);
  }
}

export async function stopRun(): Promise<void> {
  await fetch("/stop", { method: "POST" });
}

export function subscribe(onEvent: (e: MessageEvent) => void): EventSource {
  const es = new EventSource("/stream");
  es.onmessage = onEvent;
  return es;
}
