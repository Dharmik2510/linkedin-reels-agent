import type { Script } from "../../../types";
import KineticReveal from "../KineticReveal";

export default function Proof({ script }: { script: Script }) {
  return (
    <>
      <div className="phone-author">/ proof</div>
      <div style={{ marginTop: 16, fontWeight: 600, fontSize: 15, lineHeight: 1.3 }}>
        <KineticReveal text={script.body} stagger={28} />
      </div>
    </>
  );
}
