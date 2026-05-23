import { useMemo } from "react";
import { useStore } from "../state/store";
import { Chev } from "../icons";
import {
  downloadText,
  exportRunJson,
  exportRunMarkdown,
} from "../utils/scriptExport";
import styles from "./ScriptsPanel.module.css";

export default function ScriptsPanel() {
  const { state, dispatch } = useStore();
  const view = useMemo(
    () => ({ scripts: state.scripts, activeScriptId: state.activeScriptId, stage: state.stage }),
    [state.scripts, state.activeScriptId, state.stage],
  );
  const activeId = view.activeScriptId;
  const canExport = view.scripts.length > 0;

  const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");

  return (
    <section className={styles.panel}>
      <div className={styles.head}>
        <div className={styles.headTitle}>
          <span className={styles.badge}>E</span>
          <span>Reel scripts</span>
        </div>
        <div className={styles.headRight}>
          {canExport && (
            <div className={styles.exportGroup}>
              <button
                type="button"
                className={styles.exportBtn}
                onClick={() =>
                  downloadText(
                    `reelify-${stamp()}.md`,
                    exportRunMarkdown(view.scripts),
                    "text/markdown",
                  )
                }
              >
                .md
              </button>
              <button
                type="button"
                className={styles.exportBtn}
                onClick={() =>
                  downloadText(
                    `reelify-${stamp()}.json`,
                    exportRunJson(view.scripts),
                    "application/json",
                  )
                }
              >
                .json
              </button>
            </div>
          )}
          <span className={styles.count}>
            {view.scripts.length} ready
            {view.stage === "done" && view.scripts.length > 0 ? " · run complete" : ""}
          </span>
        </div>
      </div>

      {view.scripts.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyBig}>No scripts yet</div>
          Press <span style={{ color: "var(--accent)" }}>Run pipeline</span> to generate from saved posts.
        </div>
      ) : (
        <div className={styles.list}>
          {view.scripts.map((s, i) => {
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
                  <span className={styles.title}>
                    <span className={styles.titleText}>{s.title}</span>
                    {s.edited ? <span className={styles.editedDot} title="Edited locally" /> : null}
                  </span>
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
