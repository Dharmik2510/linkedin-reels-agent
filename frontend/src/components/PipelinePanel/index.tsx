import { useEffect, useState } from "react";
import { useStore } from "../../state/store";
import { useCounter } from "../../hooks/useCounter";
import type { Stage } from "../../types";
import Core from "../Core";
import styles from "./PipelinePanel.module.css";

const STAGE_LIST: { id: Stage; label: string }[] = [
  { id: "scraping",   label: "01 · Scrape" },
  { id: "parsing",    label: "02 · Parse" },
  { id: "generating", label: "03 · Generate" },
  { id: "done",       label: "04 · Ready" },
];

function stageStatus(current: Stage, candidate: Stage): "idle" | "active" | "done" {
  const order: Stage[] = ["idle", "scraping", "parsing", "generating", "done"];
  const ci = order.indexOf(current);
  const xi = order.indexOf(candidate);
  if (ci === xi) return "active";
  if (ci > xi)  return "done";
  return "idle";
}

export default function PipelinePanel() {
  const { state } = useStore();

  const scraped = useCounter(state.scrapedCount);
  const queued = useCounter(Math.max(0, state.totalPosts - state.scrapedCount));
  const scriptsN = useCounter(state.scripts.length);
  const avgDur = useCounter(
    state.scripts.length
      ? Math.round(state.scripts.reduce((s, x) => s + x.dur, 0) / state.scripts.length)
      : 0
  );

  // Animate reel cards in
  const [visibleReels, setVisibleReels] = useState<Set<string>>(new Set());
  useEffect(() => {
    const top4 = state.scripts.slice(0, 4).map((s) => s.id);
    top4.forEach((id, i) => {
      window.setTimeout(() => {
        setVisibleReels((prev) => new Set(prev).add(id));
      }, i * 50);
    });
  }, [state.scripts]);

  const last4 = state.posts.slice(-4);
  const top4Reels = state.scripts.slice(0, 4);

  const STATUS_CLASS: Record<"idle" | "active" | "done", string> = {
    idle: "",
    active: styles.active,
    done: styles.done,
  };

  return (
    <section className={styles.panel}>
      <div className={styles.head}>
        <div className={styles.headTitle}>
          <span className={styles.headBadge}>B</span>
          <span>Transform pipeline</span>
        </div>
        <div className={styles.stageTrack}>
          {STAGE_LIST.map((s, i) => {
            const status = stageStatus(state.stage, s.id);
            return (
              <span key={s.id} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                <span className={`${styles.stageItem} ${STATUS_CLASS[status]}`}>
                  <span className={styles.stageDot} />
                  {s.label}
                </span>
                {i < STAGE_LIST.length - 1 && <span className={styles.stageGap} />}
              </span>
            );
          })}
        </div>
      </div>

      <div className={styles.body}>
        <div className={`${styles.col} ${styles.left}`}>
          <div className={styles.colLabel}>// scraped posts</div>
          {last4.map((p, i) => {
            const isFlying = p.id === state.flying;
            const isStaged = i < last4.length - 1 && !isFlying;
            return (
              <div
                key={p.id}
                className={`${styles.postCard} ${isFlying ? styles.flying : ""} ${isStaged ? styles.staged : ""}`}
                style={{ ["--h" as never]: p.h } as React.CSSProperties}
              >
                <div className={styles.postAvatar} />
                <div style={{ minWidth: 0 }}>
                  <div className={styles.postMeta}>{p.author}</div>
                  <div className={styles.postBody}>{p.body}</div>
                </div>
              </div>
            );
          })}
        </div>

        <Core stage={state.stage} />

        <div className={`${styles.col} ${styles.right}`}>
          <div className={styles.colLabel}>// generated reels</div>
          {top4Reels.map((r) => (
            <div
              key={r.id}
              className={`${styles.reelCard} ${visibleReels.has(r.id) ? styles.in : ""}`}
              style={{ ["--h" as never]: 200 } as React.CSSProperties}
            >
              <div className={styles.reelThumb}>▶</div>
              <div className={styles.reelInfo}>
                <div className={styles.reelTitle}>{r.title}</div>
                <div className={styles.reelMeta}>
                  <span style={{ color: "var(--accent)" }}>{r.dur}s</span>
                  {" · "}{r.sceneCount} scenes
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Scraped</div>
          <div className={styles.statValue}>
            {Math.round(scraped)}<span style={{ color: "var(--fg-3)" }}> / {state.totalPosts || "–"}</span>
          </div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>In queue</div>
          <div className={styles.statValue}>{Math.round(queued)}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Scripts</div>
          <div className={styles.statValue}>
            {Math.round(scriptsN)}
            {state.stage === "generating" && (
              <span className={styles.statDelta}>+{state.scripts.length - Math.round(scriptsN)}</span>
            )}
          </div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Avg duration</div>
          <div className={styles.statValue}>{Math.round(avgDur)}s</div>
        </div>
      </div>
    </section>
  );
}
