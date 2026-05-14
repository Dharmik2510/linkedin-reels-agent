import { useReducedMotion } from "../../hooks/useReducedMotion";

export default function GlitchSweep({ tick }: { tick: number }) {
  const reduced = useReducedMotion();
  if (reduced || tick === 0) return null;
  // The `key` prop is supplied by the parent — re-keying on `tick` remounts and replays the animation.
  return <div className="glitch-sweep go" />;
}
