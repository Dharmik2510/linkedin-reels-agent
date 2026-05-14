import { useEffect, useState } from "react";
import type { Script } from "../../types";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import Title from "./scenes/Title";
import Hook from "./scenes/Hook";
import Proof from "./scenes/Proof";
import Cta from "./scenes/Cta";

const SCENE_COUNT = 4;
const SCENE_DUR = 1800;

export default function Phone({ script }: { script: Script }) {
  const [sceneIdx, setSceneIdx] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => { setSceneIdx(0); }, [script.id]);
  useEffect(() => {
    const id = window.setInterval(() => {
      setSceneIdx((i) => (i + 1) % SCENE_COUNT);
    }, SCENE_DUR);
    return () => window.clearInterval(id);
  }, [script.id]);

  const particles = Array.from({ length: 7 }, (_, i) => ({
    x: 10 + (i * 21) % 150,
    delay: (i * 0.31).toFixed(2),
    dx: ((i % 2) ? 1 : -1) * (5 + i * 3),
  }));

  return (
    <div className="phone">
      <div className="phone-screen" style={{ ["--ph" as never]: script.h }}>
        <div className="phone-notch" />
        {!reduced && (
          <div className="phone-particles">
            {particles.map((p, i) => (
              <span key={i} style={{
                left: p.x + "px",
                bottom: "30px",
                ["--x" as never]: p.dx + "px",
                animationDelay: p.delay + "s",
              }} />
            ))}
          </div>
        )}
        <div className="phone-ui" key={sceneIdx}>
          {sceneIdx === 0 && <Title script={script} />}
          {sceneIdx === 1 && <Hook script={script} />}
          {sceneIdx === 2 && <Proof script={script} />}
          {sceneIdx === 3 && <Cta />}
        </div>
        <div className="phone-scenes">
          {Array.from({ length: SCENE_COUNT }).map((_, i) => (
            <i
              key={i + "-" + sceneIdx}
              className={i < sceneIdx ? "done" : i === sceneIdx ? "now" : ""}
              style={{ ["--scene-dur" as never]: SCENE_DUR + "ms" }}
            >
              {i === sceneIdx && <b />}
            </i>
          ))}
        </div>
      </div>
    </div>
  );
}
