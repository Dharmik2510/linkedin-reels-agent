import type { Script } from "../types";

export function formatTeleprompter(script: Script): string {
  const lines = [script.hookRaw || script.hook.replace(/^"|"$/g, ""), "", script.body];
  return lines.join("\n").trim();
}

export function formatInstagramPack(script: Script): string {
  const tags = script.hashtags.map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ");
  const parts = [script.caption.trim()];
  if (tags) parts.push("", tags);
  if (script.cta.trim()) parts.push("", script.cta.trim());
  return parts.join("\n").trim();
}

export function formatScriptMarkdown(script: Script, index: number): string {
  const n = String(index + 1).padStart(2, "0");
  const link = script.postUrl ? `\n- Source: ${script.postUrl}` : "";
  return [
    `## ${n} — ${script.title}`,
    `- Author: ${script.author}`,
    `- Est. duration: ${script.dur}s`,
    link,
    "",
    "### Hook",
    script.hookRaw || script.hook,
    "",
    "### Script",
    script.body,
    "",
    "### Caption",
    script.caption,
    "",
    "### CTA",
    script.cta,
    "",
    "### Hashtags",
    script.hashtags.map((t) => `#${t.replace(/^#/, "")}`).join(" "),
    "",
    "---",
    "",
  ].join("\n");
}

export function exportRunMarkdown(scripts: Script[]): string {
  const header = `# Reelify export — ${new Date().toLocaleString()}\n\n`;
  const body = scripts.map((s, i) => formatScriptMarkdown(s, i)).join("");
  return header + body;
}

export function exportRunJson(scripts: Script[]): string {
  return JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      count: scripts.length,
      scripts,
    },
    null,
    2,
  );
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function downloadText(filename: string, text: string, mime = "text/plain"): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
