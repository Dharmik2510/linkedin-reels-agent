import { useEffect, useMemo } from "react";
import { useStore } from "../state/store";
import styles from "./ScriptModal.module.css";

export default function ScriptModal() {
  const { state, dispatch } = useStore();
  const view = useMemo(
    () => ({ scripts: state.scripts, activeScriptId: state.activeScriptId }),
    [state.scripts, state.activeScriptId],
  );

  const script = view.activeScriptId
    ? view.scripts.find((s) => s.id === view.activeScriptId) ?? null
    : null;
  const open = script !== null;

  const close = () => dispatch({ type: "SET_ACTIVE_SCRIPT", id: null });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open || !script) return null;

  const index = view.scripts.findIndex((s) => s.id === script.id);
  const idxLabel = String(index + 1).padStart(2, "0");

  return (
    <div className={styles.backdrop} onClick={close} role="presentation">
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={`Script ${idxLabel}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={styles.close}
          aria-label="Close"
          onClick={close}
        >
          ×
        </button>

        <div className={styles.head}>
          <span className={styles.idx}>{idxLabel}</span>
          <div className={styles.headText}>
            <div className={styles.title}>{script.title}</div>
            <div className={styles.meta}>
              <span className={styles.dur}>{script.dur}s</span>
              <span>· {script.sceneCount} scenes</span>
              <span>· {script.author}</span>
            </div>
          </div>
        </div>

        <div className={styles.body}>
          {script.hook && (
            <div className={styles.hook}>
              <div className={styles.sectionLabel}>// hook</div>
              <p className={styles.hookText}>{script.hook}</p>
            </div>
          )}

          <div className={styles.sectionLabel}>// full script</div>
          <pre className={styles.script}>{script.body}</pre>

          {script.tags.length > 0 && (
            <>
              <div className={styles.sectionLabel}>// tags</div>
              <div className={styles.tags}>
                {script.tags.map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
