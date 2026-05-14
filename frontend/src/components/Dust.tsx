import { useEffect, useRef } from "react";
import { useReducedMotion } from "../hooks/useReducedMotion";
import styles from "./Dust.module.css";

const PARTICLE_COUNT = 40;

export default function Dust() {
  const reduced = useReducedMotion();
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduced) return;
    const host = hostRef.current;
    if (!host) return;
    host.innerHTML = "";
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const d = document.createElement("span");
      d.style.left = (Math.random() * 100) + "vw";
      d.style.top = (Math.random() * 100) + "vh";
      d.style.opacity = (0.15 + Math.random() * 0.5).toFixed(2);
      d.style.animationDuration = (8 + Math.random() * 18).toFixed(1) + "s";
      d.style.animationDelay = (-Math.random() * 12).toFixed(1) + "s";
      d.style.background = Math.random() < 0.6
        ? "oklch(0.88 0.19 128)"
        : "oklch(0.78 0.10 80)";
      host.appendChild(d);
    }
    return () => { host.innerHTML = ""; };
  }, [reduced]);

  if (reduced) return null;
  return <div className={styles.dust} ref={hostRef} aria-hidden="true" />;
}
