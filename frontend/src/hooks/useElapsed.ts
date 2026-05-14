import { useEffect, useState } from "react";

/**
 * Returns elapsed ms since `start` (a performance.now() timestamp).
 * Ticks on rAF while `running`. Freezes at the last value when `running` flips false.
 * When `start === null`, returns 0.
 */
export function useElapsed(running: boolean, start: number | null): number {
  const [ms, setMs] = useState(0);

  useEffect(() => {
    if (start === null) {
      setMs(0);
      return;
    }
    if (!running) {
      setMs(performance.now() - start);
      return;
    }
    let raf = 0;
    const tick = () => {
      setMs(performance.now() - start);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, start]);

  return ms;
}
