import type { Language, Tone } from "./types";

export async function startRun(
  num_posts: number,
  tone: Tone,
  language: Language,
): Promise<{ runId: string | null }> {
  const res = await fetch("/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ num_posts, tone, language }),
  });
  if (!res.ok && res.status !== 409) {
    throw new Error(`Run failed: ${res.status}`);
  }
  const data = (await res.json().catch(() => ({}))) as { run_id?: string };
  return { runId: data.run_id ?? null };
}

export async function submitFeedback(
  runId: string,
  stepId: string,
  rating: "up" | "down",
  postIndex: number | null,
  comment?: string,
): Promise<void> {
  const q = postIndex !== null ? `?post_index=${postIndex}` : "";
  await fetch(`/runs/${runId}/steps/${stepId}/feedback${q}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rating, comment: comment ?? null }),
  });
}

export async function stopRun(): Promise<void> {
  await fetch("/stop", { method: "POST" });
}

export class RegenerateError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "RegenerateError";
  }
}

export async function regenerateScript(
  post_index: number,
  tone?: Tone,
): Promise<void> {
  const res = await fetch(`/regenerate/${post_index}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tone ? { tone } : {}),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { status?: string };
    throw new RegenerateError(
      data.status ?? `Regenerate failed: ${res.status}`,
      res.status,
    );
  }
}

export function subscribe(
  onEvent: (e: MessageEvent) => void,
  onError?: (e: Event) => void,
): EventSource {
  const es = new EventSource("/stream");
  es.onmessage = onEvent;
  if (onError) es.onerror = onError;
  return es;
}
