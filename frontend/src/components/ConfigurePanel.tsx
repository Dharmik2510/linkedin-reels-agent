import { startRun, stopRun } from "../api";
import { useStore } from "../state/store";
import type { Tone } from "../types";
import { Bookmark, Spark } from "../icons";
import Dropdown, { type DropdownOption } from "./Dropdown";
import styles from "./ConfigurePanel.module.css";

const POST_COUNT_OPTIONS: DropdownOption[] = [
  { n: 5,   label: "5",   est: "~45s · 1 min" },
  { n: 10,  label: "10",  est: "~1m 30s · 2 min" },
  { n: 15,  label: "15",  est: "~2m 30s · 3 min" },
  { n: 25,  label: "25",  est: "~4m · 5 min" },
  { n: 50,  label: "50",  est: "~8m · 10 min" },
  { n: 100, label: "100", est: "~16m · 20 min" },
];

const TONES: Tone[] = ["Punchy", "Story-led", "Analytical", "Educational"];

export default function ConfigurePanel() {
  const { state, dispatch } = useStore();
  const running = state.stage !== "idle" && state.stage !== "done";

  const onRun = async () => {
    if (running) {
      await stopRun();
      dispatch({ type: "RESET" });
    } else {
      dispatch({ type: "RESET" });
      await startRun(state.count, state.tone);
    }
  };

  return (
    <section className={styles.wrapper}>
      <div className={styles.title}>
        <span className={styles.titleBadge}>A</span>
        <span>Configure run</span>
      </div>

      <div className={styles.sectionLabel}>// source</div>
      <div className={styles.source}>
        <div className={styles.sourceIcon}><Bookmark /></div>
        <div className={styles.sourceText}>
          <div className={styles.sourceTitle}>Saved posts</div>
          <div className={styles.sourceMeta}>@you · session ok</div>
        </div>
        <div className={styles.sourceDot} />
      </div>

      <div className={styles.sectionLabel}>// number of posts</div>
      <Dropdown
        value={state.count}
        options={POST_COUNT_OPTIONS}
        disabled={running}
        onChange={(n) => dispatch({ type: "SET_COUNT", n })}
      />

      <div className={styles.sectionLabel}>// reel tone</div>
      <div className={styles.toneGrid}>
        {TONES.map((t) => (
          <button
            key={t}
            type="button"
            disabled={running}
            className={`${styles.toneChip} ${state.tone === t ? styles.selected : ""}`}
            onClick={() => dispatch({ type: "SET_TONE", tone: t })}
          >
            {t}
          </button>
        ))}
      </div>

      <button type="button" className={styles.runBtn} onClick={onRun}>
        {running
          ? <><span className={styles.spinner} /> Stop run</>
          : <><Spark /> {state.stage === "done" ? "Run again" : "Run pipeline"}</>}
      </button>

      <div className={styles.quotas} aria-hidden="true">
        <div>
          <div className={styles.quotaLabel}>Credits</div>
          <div className={styles.quotaValue}>214</div>
          <div className={styles.bar}><div className={styles.barFill} style={{ width: "62%" }} /></div>
        </div>
        <div>
          <div className={styles.quotaLabel}>Storage</div>
          <div className={styles.quotaValue}>1.4gb</div>
          <div className={styles.bar}><div className={styles.barFill} style={{ width: "28%" }} /></div>
        </div>
      </div>
    </section>
  );
}
