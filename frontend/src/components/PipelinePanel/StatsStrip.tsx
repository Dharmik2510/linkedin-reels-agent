import { useCounter } from "../../hooks/useCounter";
import SlotCounter from "./SlotCounter";
import styles from "./PipelinePanel.module.css";

interface Props {
  scraped: number;
  count: number;
  queued: number;
  scripts: number;
  avgDur: number;
}

export default function StatsStrip({ scraped, count, queued, scripts, avgDur }: Props) {
  const scrapedDisp = useCounter(scraped, 500);
  const queuedDisp = useCounter(queued, 500);
  const scriptsDisp = useCounter(scripts, 500);
  const avgDisp = useCounter(avgDur, 500);

  return (
    <div className={styles.pipeStats}>
      <div className="stat">
        <div className="k">Scraped</div>
        <div className="v">
          <SlotCounter value={scrapedDisp} width={3} />
          <small>/ {String(count).padStart(3, "0")}</small>
        </div>
      </div>
      <div className="stat">
        <div className="k">In queue</div>
        <div className="v"><SlotCounter value={queuedDisp} width={3} /></div>
      </div>
      <div className="stat">
        <div className="k">Scripts</div>
        <div className="v"><SlotCounter value={scriptsDisp} width={3} /></div>
      </div>
      <div className="stat">
        <div className="k">Avg duration</div>
        <div className="v">
          <SlotCounter value={avgDisp} width={2} />
          <small>s</small>
        </div>
      </div>
    </div>
  );
}
