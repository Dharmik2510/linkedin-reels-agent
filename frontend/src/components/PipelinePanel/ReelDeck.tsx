import { useEffect, useRef, useState } from "react";
import type { Script } from "../../types";
import { Play } from "../../icons";
import { useReducedMotion } from "../../hooks/useReducedMotion";

interface Props {
  scripts: Script[];
}

export default function ReelDeck({ scripts }: Props) {
  const visible = scripts.slice(0, 5);
  const reduced = useReducedMotion();
  const [freshId, setFreshId] = useState<string | null>(null);
  const lastTopId = useRef<string | null>(null);

  useEffect(() => {
    const top = visible[0]?.id ?? null;
    if (top && top !== lastTopId.current && !reduced) {
      setFreshId(top);
      const id = window.setTimeout(() => setFreshId(null), 950);
      lastTopId.current = top;
      return () => window.clearTimeout(id);
    }
    lastTopId.current = top;
    return undefined;
  }, [visible[0]?.id, reduced]);

  return (
    <div className="stack-col right">
      <div className="stack-label">// reels · output</div>
      <div className="stack">
        {visible.map((r, i) => {
          const z = -i * 10;
          const y = i * 5;
          const x = i * 3;
          const tx = `translate3d(${x}px, ${y}px, ${z}px)`;
          const fresh = r.id === freshId;
          return (
            <div
              key={r.id}
              className={"reel-stack-card" + (fresh ? " fresh" : "")}
              style={{
                ["--h" as never]: r.h,
                ["--rb-tx" as never]: tx,
                transform: tx,
                opacity: 1 - i * 0.10,
                zIndex: 10 - i,
              }}
            >
              <div className="sprocket"><span /><span /><span /><span /><span /></div>
              <div className="reel-title">{r.title}</div>
              <div className="reel-meta">{r.dur}s · {r.sceneCount} scenes</div>
              <div className="play"><Play width={10} height={10} /></div>
            </div>
          );
        })}
      </div>
      <div className="stack-counter">
        <div className="v">{String(scripts.length).padStart(2, "0")}</div>
        <div className="k">ready</div>
      </div>
    </div>
  );
}
