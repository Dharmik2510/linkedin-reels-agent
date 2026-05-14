import type { Script } from "../../../types";
import { useReducedMotion } from "../../../hooks/useReducedMotion";

export default function Hook({ script }: { script: Script }) {
  const reduced = useReducedMotion();
  const text = script.hook.replace(/^"|"$/g, "").trim();
  const words = text.split(/\s+/);
  const seen = new Set<string>();
  return (
    <>
      <div className="phone-author">/ the hook</div>
      <div className="phone-hook" style={{ marginTop: 16 }}>
        <span>
          {words.map((w, i) => {
            const norm = w.replace(/[^a-zA-Z]/g, "").toLowerCase();
            const isKw =
              script.keywords.some((k) => k.toLowerCase() === norm) &&
              !seen.has(norm);
            if (isKw) seen.add(norm);
            const content = isKw ? <span className="kbox">{w}</span> : w;
            if (reduced) {
              return <span key={i} style={{ marginRight: "0.25em" }}>{content}</span>;
            }
            return (
              <span key={i} style={{
                display: "inline-block", marginRight: "0.25em",
                opacity: 0, transform: "translateY(8px)",
                animation: `kineticUp 0.5s cubic-bezier(.4,0,.2,1) ${i * 70}ms forwards`,
              }}>{content}</span>
            );
          })}
        </span>
      </div>
      <div style={{ marginTop: "auto" }} />
    </>
  );
}
