import { useStore } from "../state/store";
import { useElapsed } from "../hooks/useElapsed";
import { fmtElapsed } from "../utils/text";
import { Bell, Gear, Play } from "../icons";
import styles from "./Header.module.css";

const STATUS_LABEL: Record<string, string> = {
  idle:       "Idle · agent ready",
  scraping:   "Live · scraping saved posts",
  parsing:    "Live · parsing content",
  generating: "Live · generating scripts",
};

export default function Header() {
  const { state } = useStore();
  const running = state.stage !== "idle" && state.stage !== "done";
  const elapsed = useElapsed(running, state.elapsedStart);
  const label =
    state.stage === "done"
      ? `Run complete · ${state.scripts.length} scripts ready`
      : STATUS_LABEL[state.stage] ?? "Idle · agent ready";
  const showTimer = state.elapsedStart !== null;

  return (
    <header className={styles.top}>
      <div className={styles.brand}>
        <div className={styles.brandMark}>
          <Play />
        </div>
        <div>
          <div className={styles.brandName}>Reelify</div>
          <div className={styles.brandSub}>saved · posts → reels</div>
        </div>
      </div>
      <div className={styles.spacer} />
      <div className={styles.statusPill} role="status" aria-live="polite">
        <span className={`${styles.dot} ${running ? styles.live : ""}`} />
        <span>{label}</span>
        {showTimer && (
          <>
            <span className={styles.sep} />
            <span className={styles.timer}>{fmtElapsed(elapsed)}</span>
          </>
        )}
      </div>
      <button className={styles.iconBtn} aria-label="Notifications">
        <Bell />
      </button>
      <button className={styles.iconBtn} aria-label="Settings">
        <Gear />
      </button>
    </header>
  );
}
