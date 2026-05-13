import { useEffect, useRef } from "react";
import { useStore } from "../state/store";
import styles from "./Terminal.module.css";

export default function Terminal() {
  const { state } = useStore();
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [state.logLines.length]);

  return (
    <section className={styles.panel}>
      <div className={styles.head}>
        <div className={styles.dots}>
          <i /><i /><i />
        </div>
        <span>playwright · agent.log</span>
        <div className={styles.spacer} />
        <span>{state.logLines.length} lines</span>
      </div>
      <div className={styles.body} ref={bodyRef}>
        {state.logLines.length === 0 ? (
          <div className={styles.idle}>
            $ reelify --watch <span className={styles.cursor} />
          </div>
        ) : (
          state.logLines.map((l, i) => (
            <div key={i} className={`${styles.line} ${styles[l.level] ?? ""}`}>
              <span className={styles.t}>{l.t}</span>
              <span className={styles.tag}>[{l.tag}]</span>
              <span className={styles.msg}>{l.msg}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
