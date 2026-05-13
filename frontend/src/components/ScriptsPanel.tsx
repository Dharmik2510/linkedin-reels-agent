import { useStore } from "../state/store";
import styles from "./ScriptsPanel.module.css";

export default function ScriptsPanel() {
  const { state } = useStore();

  return (
    <section className={styles.panel}>
      <div className={styles.head}>
        <div className={styles.headTitle}>
          <span className={styles.headBadge}>C</span>
          <span>Reel scripts</span>
        </div>
        <span>{state.scripts.length} ready</span>
      </div>

      {state.scripts.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyLabel}>No scripts yet</div>
          Press <span style={{ color: "var(--accent)" }}>Run pipeline</span> to generate from saved posts.
        </div>
      ) : (
        <div className={styles.list}>
          {state.scripts.map((s, i) => {
            const widths = Array.from(
              { length: s.sceneCount },
              (_, k) => 50 + ((k * 17 + s.id.length * 3) % 50)
            );
            return (
              <article
                key={s.id}
                className={styles.card}
                style={{ animationDelay: `${Math.min(i, 5) * 40}ms` }}
              >
                <div className={styles.row1}>
                  <span className={styles.idx}>{String(i + 1).padStart(2, "0")}</span>
                  <span className={styles.title}>{s.title}</span>
                  <span className={styles.dur}>{s.dur}s</span>
                </div>
                <div className={styles.hook}>{s.hook}</div>
                <div className={styles.scenes}>
                  {widths.map((w, k) => (
                    <span
                      key={k}
                      className={`${styles.sceneBar} ${k === 0 ? styles.hl : ""}`}
                    >
                      <i style={{ width: `${w}%` }} />
                    </span>
                  ))}
                </div>
                <div className={styles.tags}>
                  {s.tags.map((t) => (
                    <span key={t} className={styles.tag}>{t}</span>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
