import { useMemo } from "react";
import { useStore } from "../../state/store";
import Phone from "./Phone";
import styles from "./PhonePreview.module.css";

export default function PhonePreview() {
  const { state } = useStore();
  const view = useMemo(
    () => ({ scripts: state.scripts, activeScriptId: state.activeScriptId }),
    [state.scripts, state.activeScriptId],
  );
  const preview = view.activeScriptId
    ? view.scripts.find((s) => s.id === view.activeScriptId) ?? view.scripts[0]
    : view.scripts[0];

  if (!preview) {
    return (
      <section className={`${styles.panel} ${styles.phonePanel}`}>
        <div className={styles.head}>
          <span><span className={styles.num}>D</span>Reel preview</span>
          <span style={{ color: "var(--fg-3)" }}>idle</span>
        </div>
        <div className={styles.stage}>
          <div className={styles.empty}>
            <div className={styles.emptyBig}>No reel ready</div>
            Generated reels will auto-preview here, with kinetic scenes for hook, proof, and CTA.
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={`${styles.panel} ${styles.phonePanel}`}>
      <div className={styles.head}>
        <span><span className={styles.num}>D</span>Reel preview · auto-play</span>
      </div>
      <div className={styles.stage} style={{ ["--ph" as never]: preview.h }}>
        <Phone script={preview} />
        <div className={styles.meta}>
          <div>
            <div className={styles.k}>// next up</div>
            <div className={styles.v}>{preview.title}</div>
          </div>
          <div>
            <div className={styles.k}>// duration · scenes</div>
            <div className={`${styles.v} ${styles.mono}`}>
              {preview.dur}s · {preview.sceneCount} cuts
            </div>
          </div>
          <div>
            <div className={styles.k}>// tags</div>
            <div className={styles.tags}>
              {preview.tags.slice(0, 4).map((t) => <span key={t}>{t}</span>)}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
