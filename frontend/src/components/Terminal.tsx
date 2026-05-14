import { useEffect, useMemo, useRef } from "react";
import { useStore } from "../state/store";
import styles from "./Terminal.module.css";

export default function Terminal() {
  const { state } = useStore();
  const view = useMemo(
    () => ({ logLines: state.logLines, stage: state.stage }),
    [state.logLines, state.stage],
  );

  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [view.logLines.length]);

  const running = view.stage !== "idle" && view.stage !== "done";

  return (
    <section className={styles.panel}>
      <div className={styles.head}>
        <div className={styles.dots}><i /><i /><i /></div>
        <span>playwright · agent.log</span>
        <span className={styles.subhead}>· stream</span>
        <div className={styles.spacer} />
        <span className={styles.count}>{view.logLines.length} lines</span>
      </div>
      <div className={styles.body} ref={bodyRef}>
        {view.logLines.length === 0 && (
          <div className={styles.idle}>
            $ reelify --watch <span className={styles.cursor} />
          </div>
        )}
        {view.logLines.map((l, i) => (
          <div key={i} className={`${styles.line} ${styles[l.level] ?? ""}`}>
            <span className={styles.t}>{l.t}</span>
            <span className={styles.tag}>[{l.tag}]</span>
            <span className={styles.msg}>{l.msg}</span>
          </div>
        ))}
        {running && (
          <div className={styles.idle}>$ <span className={styles.cursor} /></div>
        )}
      </div>
    </section>
  );
}
