import type { Stage } from "../../types";

const ITEMS: { k: string; label: string }[] = [
  { k: "scrape", label: "01 · Scrape" },
  { k: "parse",  label: "02 · Parse" },
  { k: "gen",    label: "03 · Generate" },
  { k: "ready",  label: "04 · Ready" },
];

const STAGE_IDX: Record<Stage, number> = {
  idle: -1,
  scraping: 0,
  parsing: 1,
  generating: 2,
  done: 3,
};

export default function StageTrack({ stage }: { stage: Stage }) {
  const idx = STAGE_IDX[stage];
  return (
    <div className="stage-track">
      {ITEMS.map((it, i) => {
        const klass = i === idx ? "active" : i < idx ? "done" : "";
        return (
          <span key={it.k} style={{ display: "inline-flex", alignItems: "center" }}>
            <span className={`stage-dot ${klass}`}>
              <i /> {it.label}
            </span>
            {i < ITEMS.length - 1 && <span className="stage-sep" />}
          </span>
        );
      })}
    </div>
  );
}
