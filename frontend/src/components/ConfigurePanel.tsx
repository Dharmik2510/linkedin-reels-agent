import { useMemo } from "react";
import { startRun, stopRun } from "../api";
import { useStore } from "../state/store";
import type { Language, Tone } from "../types";
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
const LANGUAGES: { code: Language; label: string }[] = [
  { code: "en", label: "English" },
  { code: "gu", label: "Gujarati" },
  { code: "hi", label: "Hindi" },
];

export default function ConfigurePanel() {
  const { state, dispatch } = useStore();
  const view = useMemo(
    () => ({
      count: state.count,
      tone: state.tone,
      language: state.language,
      stage: state.stage,
    }),
    [state.count, state.tone, state.language, state.stage],
  );
  const running = view.stage !== "idle" && view.stage !== "done";

  const onRun = async () => {
    if (running) {
      await stopRun();
      dispatch({ type: "RESET" });
    } else {
      dispatch({ type: "RESET" });
      const { runId } = await startRun(view.count, view.tone, view.language);
      if (runId) dispatch({ type: "SET_RUN_ID", runId });
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
        value={view.count}
        options={POST_COUNT_OPTIONS}
        disabled={running}
        onChange={(n) => dispatch({ type: "SET_COUNT", n })}
      />

      <div className={styles.sectionLabel}>// script language</div>
      <div className={styles.toneGrid}>
        {LANGUAGES.map(({ code, label }) => (
          <button
            key={code}
            type="button"
            disabled={running}
            className={`${styles.toneChip} ${view.language === code ? styles.selected : ""}`}
            onClick={() => dispatch({ type: "SET_LANGUAGE", language: code })}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={styles.sectionLabel}>// reel tone</div>
      <div className={styles.toneGrid}>
        {TONES.map((t) => (
          <button
            key={t}
            type="button"
            disabled={running}
            className={`${styles.toneChip} ${view.tone === t ? styles.selected : ""}`}
            onClick={() => dispatch({ type: "SET_TONE", tone: t })}
          >
            {t}
          </button>
        ))}
      </div>

      <button type="button" className={styles.runBtn} onClick={onRun}>
        {running
          ? <><span className={styles.spinner} /> Stop run</>
          : <><Spark /> {view.stage === "done" ? "Run again" : "Run pipeline"}</>}
      </button>
    </section>
  );
}
