import { useEffect, useRef, type Dispatch } from "react";
import type { Action } from "../state/store";
import type { Comet } from "../types";

const SPEED = 0.42; // 1 / seconds-to-traverse; ~2.4s end-to-end

/**
 * Owns the single rAF loop that advances all comets. Dispatches one batched
 * COMET_FRAME action per frame. Active whenever `comets.length > 0`; once
 * empty AND the run is not running, the loop suspends.
 */
export function usePipelineEngine(
  comets: Comet[],
  running: boolean,
  dispatch: Dispatch<Action>,
): void {
  // Mirror comets into a ref so the loop reads the latest list without re-binding.
  const cometsRef = useRef<Comet[]>(comets);
  cometsRef.current = comets;

  const runningRef = useRef(running);
  runningRef.current = running;

  const shouldRun = comets.length > 0 || running;

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let active = false;

    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;

      const list = cometsRef.current;
      if (list.length === 0 && !runningRef.current) {
        active = false;
        return;
      }

      const ticks: { id: number; t: number }[] = [];
      const landed: number[] = [];
      let intensityBump = false;

      for (const c of list) {
        const nt = c.t + dt * SPEED;
        if (nt >= 1) {
          landed.push(c.id);
        } else {
          ticks.push({ id: c.id, t: nt });
        }
        if (c.t < 0.5 && nt >= 0.5) intensityBump = true;
      }

      if (ticks.length > 0 || landed.length > 0 || intensityBump) {
        dispatch({ type: "COMET_FRAME", ticks, landed, intensityBump });
      }

      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      if (active) return;
      active = true;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };

    if (cometsRef.current.length > 0 || runningRef.current) start();

    return () => {
      cancelAnimationFrame(raf);
      active = false;
    };
  }, [dispatch, shouldRun]);
}
