import type { Script } from "../../../types";
import KineticReveal from "../KineticReveal";

export default function Title({ script }: { script: Script }) {
  return (
    <>
      <div className="phone-author">{script.author}</div>
      <div style={{
        marginTop: 4, fontSize: 10, fontFamily: "Geist Mono, monospace",
        color: "oklch(1 0 0 / 0.6)",
      }}>{script.role}</div>
      <div style={{ marginTop: "auto", marginBottom: 18 }}>
        <div style={{
          fontSize: 11, fontFamily: "Geist Mono, monospace",
          letterSpacing: "0.16em", textTransform: "uppercase",
          color: "oklch(1 0 0 / 0.6)",
        }}>
          reel · {script.id.replace(/^script-/, "").padStart(3, "0")}
        </div>
        <div style={{
          fontWeight: 800, fontSize: 28, lineHeight: 1.05,
          letterSpacing: "-0.02em", marginTop: 4,
        }}>
          <KineticReveal text="A short take." />
        </div>
      </div>
    </>
  );
}
