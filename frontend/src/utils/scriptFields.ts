import type { Script } from "../types";

export interface ScriptEditableFields {
  hookRaw: string;
  body: string;
  caption: string;
  cta: string;
}

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

export function pickEditable(script: Script): ScriptEditableFields {
  return {
    hookRaw: script.hookRaw,
    body: script.body,
    caption: script.caption,
    cta: script.cta,
  };
}

export function fieldsEqual(a: ScriptEditableFields, b: ScriptEditableFields): boolean {
  return (
    a.hookRaw === b.hookRaw &&
    a.body === b.body &&
    a.caption === b.caption &&
    a.cta === b.cta
  );
}

export function buildScriptFromApi(
  postIndex: number,
  rawScript: Record<string, unknown>,
  postMeta: Record<string, unknown> | undefined,
  opts?: { edited?: boolean },
): Script {
  const body = String(rawScript.script ?? "");
  const hookRaw = String(rawScript.hook ?? "");
  const caption = String(rawScript.caption ?? "");
  const cta = String(rawScript.cta ?? "");
  const author = String(postMeta?.author ?? "Unknown");
  const role = String(postMeta?.role ?? "saved post");
  const postUrl = String(postMeta?.post_url ?? "");
  const hashtags = (rawScript.hashtags as string[] | undefined) ?? [];
  const wordCount = body.split(/\s+/).filter(Boolean).length;
  const dur = Math.max(15, Math.min(60, Math.round(wordCount / 2.5)));
  const sceneCount = Math.max(3, Math.min(6, body.split(/\n/).filter(Boolean).length || 4));
  const keywords = (body.match(/\b[A-Z][a-z]+\b/g) ?? []).slice(0, 2);
  return {
    id: `script-${postIndex}`,
    postIndex,
    title: hookRaw.length > 60 ? hookRaw.slice(0, 58) + "…" : hookRaw,
    hook: hookRaw ? `"${hookRaw}"` : "",
    hookRaw,
    dur,
    sceneCount,
    tags: hashtags.slice(0, 4).map((t) => `#${t.replace(/^#/, "")}`),
    hashtags,
    caption,
    cta,
    postUrl,
    body,
    author,
    role,
    initials: initials(author),
    h: hashHue(author),
    keywords,
    edited: opts?.edited ?? false,
  };
}

export function applyScriptEdits(script: Script, fields: ScriptEditableFields): Script {
  const next = buildScriptFromApi(
    script.postIndex,
    {
      hook: fields.hookRaw,
      script: fields.body,
      caption: fields.caption,
      cta: fields.cta,
      hashtags: script.hashtags,
    },
    { author: script.author, role: script.role, post_url: script.postUrl },
    { edited: true },
  );
  return { ...next, id: script.id };
}
