import { useCallback, useMemo, useRef } from "react";
import { useStore } from "../../state/store";
import { usePipeSize } from "../../hooks/usePipeSize";
import { buildHexes, findHexAt, type HexCell } from "../../utils/hex";
import HexGrid, { type HexGridHandle } from "./HexGrid";
import CometCanvas from "./CometCanvas";
import ScopeCore from "./ScopeCore";
import PostStack from "./PostStack";
import ReelDeck from "./ReelDeck";
import GlitchSweep from "./GlitchSweep";
import StatsStrip from "./StatsStrip";
import StageTrack from "./StageTrack";
import styles from "./PipelinePanel.module.css";

interface CometPosition { id: number; x: number; y: number; }

export default function PipelinePanel() {
  const { state } = useStore();
  const bodyRef = useRef<HTMLDivElement>(null);
  const hexRef = useRef<HexGridHandle>(null);
  const litMapRef = useRef<Record<string, number>>({});
  const lastHexPushRef = useRef(0);
  const size = usePipeSize(bodyRef);

  const cells: HexCell[] = useMemo(() => buildHexes(size.w, size.h), [size.w, size.h]);

  const onCometPositions = useCallback((positions: CometPosition[]) => {
    const now = performance.now();
    if (now - lastHexPushRef.current < 50) return; // throttle to ~20 Hz
    lastHexPushRef.current = now;
    const map = { ...litMapRef.current };
    for (const k of Object.keys(map)) if (map[k]! < now) delete map[k];
    for (const p of positions) {
      const cell = findHexAt(cells, p.x, p.y);
      if (cell) map[cell.id] = now + 600;
    }
    litMapRef.current = map;
    hexRef.current?.setLit(map);
  }, [cells]);

  const running = state.stage !== "idle" && state.stage !== "done";
  const progress = state.stage === "done"
    ? 1
    : Math.min(1, state.totalPosts === 0 ? 0 : state.scrapedCount / state.totalPosts);

  const queued = Math.max(0, state.totalPosts - state.scrapedCount);
  const avgDur = state.scripts.length
    ? Math.round(state.scripts.reduce((s, x) => s + x.dur, 0) / state.scripts.length)
    : 0;

  return (
    <section className={styles.panel}>
      <div className={styles.head}>
        <div className={styles.headTitle}>
          <span className="badge">B</span>
          <span>Transform pipeline</span>
        </div>
        <StageTrack stage={state.stage} />
      </div>

      <div className={styles.body} ref={bodyRef}>
        <HexGrid ref={hexRef} width={size.w} height={size.h} />
        <CometCanvas comets={state.comets} width={size.w} height={size.h} onPositions={onCometPositions} />
        <PostStack posts={state.posts} totalCount={state.totalPosts || state.count} scrapedCount={state.scrapedCount} />
        <ReelDeck scripts={state.scripts} />
        <ScopeCore
          stage={state.stage}
          progress={progress}
          intensity={state.intensity}
          scraped={state.scrapedCount}
          elapsedStart={state.elapsedStart}
          running={running}
        />
        <GlitchSweep key={state.glitch} tick={state.glitch} />
      </div>

      <StatsStrip
        scraped={state.scrapedCount}
        count={state.totalPosts || state.count}
        queued={queued}
        scripts={state.scripts.length}
        avgDur={avgDur}
      />
    </section>
  );
}
