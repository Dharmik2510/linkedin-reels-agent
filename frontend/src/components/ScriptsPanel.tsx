import { useStore } from "../state/store";
import { Chev } from "../icons";
import styles from "./ScriptsPanel.module.css";

export default function ScriptsPanel() {
  const { state, dispatch } = useStore();
  const activeId = state.activeScriptId ?? state.scripts[0]?.id ?? null;

  return (
    <section className={styles.panel}>
      <div className={styles.head}>
        <div className={styles.headTitle}>
          <span className={styles.badge}>E</span>
          <span>Reel scripts</span>
        </div>
        <span className={styles.count}>{state.scripts.length} ready</span>
      </div>

      {state.scripts.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyBig}>No scripts yet</div>
          Press <span style={{ color: "var(--accent)" }}>Run pipeline</span> to generate from saved posts.
        </div>
      ) : (
        <div className={styles.list}>
          {state.scripts.map((s, i) => {
            const active = activeId === s.id;
            return (
              <button
                key={s.id}
                type="button"
                className={`${styles.card} ${active ? styles.active : ""}`}
                style={{ animationDelay: `${Math.min(i, 6) * 30}ms` }}
                onClick={() => dispatch({ type: "SET_ACTIVE_SCRIPT", id: s.id })}
              >
                <span className={styles.idx}>{String(i + 1).padStart(2, "0")}</span>
                <span className={styles.body}>
                  <span className={styles.title}>{s.title}</span>
                  <span className={styles.row}>
                    <span className={styles.dur}>{s.dur}s</span>
                    <span>· {s.sceneCount} scenes</span>
                    <span className={styles.scenesMini}>
                      {Array.from({ length: Math.min(5, s.sceneCount) }).map((_, k) => (
                        <i key={k} className={k === 0 ? styles.miniHl : ""} />
                      ))}
                    </span>
                  </span>
                </span>
                <span className={styles.open}><Chev width={12} height={12} /></span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
