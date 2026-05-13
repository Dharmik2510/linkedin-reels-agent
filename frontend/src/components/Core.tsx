import type { Stage } from "../types";

const LABELS: Record<Stage, { glyph: string; label: string }> = {
  idle:       { glyph: "—", label: "STANDBY" },
  scraping:   { glyph: "↯", label: "SCRAPING" },
  parsing:    { glyph: "↯", label: "PARSING" },
  generating: { glyph: "↯", label: "REELIFY" },
  done:       { glyph: "✓", label: "READY" },
};

export default function Core({ stage }: { stage: Stage }) {
  const { glyph, label } = LABELS[stage];
  return (
    <div style={{
      position: "relative", display: "grid", placeItems: "center",
    }}>
      <div style={{
        width: 110, height: 110, borderRadius: "50%",
        background: "radial-gradient(circle at 30% 30%, oklch(0.55 0.16 130 / 0.7), oklch(0.22 0.02 130) 60%)",
        boxShadow: "0 0 60px oklch(0.88 0.19 128 / 0.25), inset 0 0 30px oklch(0 0 0 / 0.4)",
        display: "grid", placeItems: "center",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--fg)" }}>{glyph}</div>
          <div style={{
            fontFamily: "Geist Mono, monospace", fontSize: 11,
            letterSpacing: "0.08em", color: "var(--accent)",
            textShadow: "0 0 6px var(--accent)",
          }}>{label}</div>
        </div>
      </div>
    </div>
  );
}
