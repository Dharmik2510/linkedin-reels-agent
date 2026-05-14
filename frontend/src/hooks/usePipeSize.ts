import { useLayoutEffect, useState, type RefObject } from "react";

export interface PipeSize { w: number; h: number; }

const FALLBACK: PipeSize = { w: 820, h: 540 };

/**
 * Tracks the bounding-box size of the given element. Uses ResizeObserver when
 * available, falls back to a one-shot measurement on mount.
 */
export function usePipeSize(ref: RefObject<HTMLElement>): PipeSize {
  const [size, setSize] = useState<PipeSize>(FALLBACK);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    };
    measure();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [ref]);

  return size;
}
