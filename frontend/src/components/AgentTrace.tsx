import { useMemo } from "react";
import { submitFeedback } from "../api";
import { useStore } from "../state/store";
import styles from "./AgentTrace.module.css";

export default function AgentTrace() {
  const { state } = useStore();
  const view = useMemo(
    () => ({
      steps: state.agentSteps.filter((s) => s.status !== "started"),
      runId: state.runId,
      cost: state.runCostUsd,
    }),
    [state.agentSteps, state.runId, state.runCostUsd],
  );

  const onFeedback = async (stepId: string, rating: "up" | "down", postIndex: number | null) => {
    if (!view.runId) return;
    await submitFeedback(view.runId, stepId, rating, postIndex);
  };

  return (
    <section className={styles.panel}>
      <div className={styles.head}>
        <span className={styles.title}>Agent trace</span>
        {view.cost > 0 && (
          <span className={styles.cost}>~${view.cost.toFixed(3)}</span>
        )}
      </div>
      <div className={styles.body}>
        {view.steps.length === 0 ? (
          <p className={styles.idle}>Agent steps appear here during a run.</p>
        ) : (
          view.steps.map((s) => (
            <article
              key={s.stepId}
              className={`${styles.row} ${styles[s.status] ?? ""}`}
            >
              <div className={styles.rowTop}>
                <span className={styles.agent}>{s.agent}</span>
                <span className={styles.step}>{s.step}</span>
                {s.postIndex !== null && (
                  <span className={styles.post}>#{s.postIndex + 1}</span>
                )}
                <span className={styles.status}>{s.status}</span>
                {s.durationMs != null && (
                  <span className={styles.dur}>{s.durationMs}ms</span>
                )}
              </div>
              <p className={styles.msg}>{s.message}</p>
              {s.outputSummary && (
                <p className={styles.out}>{s.outputSummary}</p>
              )}
              {s.reasoning && (
                <p className={styles.reason}>{s.reasoning}</p>
              )}
              {s.status === "completed" && view.runId && (
                <div className={styles.fb}>
                  <button
                    type="button"
                    className={styles.fbBtn}
                    aria-label="Good step"
                    onClick={() => onFeedback(s.stepId, "up", s.postIndex)}
                  >
                    👍
                  </button>
                  <button
                    type="button"
                    className={styles.fbBtn}
                    aria-label="Bad step"
                    onClick={() => onFeedback(s.stepId, "down", s.postIndex)}
                  >
                    👎
                  </button>
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
