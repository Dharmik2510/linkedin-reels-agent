import type { Post } from "../../types";

interface Props {
  posts: Post[];
  totalCount: number;
  scrapedCount: number;
}

export default function PostStack({ posts, totalCount, scrapedCount }: Props) {
  const visible = posts.slice(-6).reverse(); // newest first → renders at index 0 (front of stack)
  const remaining = Math.max(0, totalCount - scrapedCount);

  return (
    <div className="stack-col left">
      <div className="stack-label">// saved · queue</div>
      <div className="stack">
        {visible.map((p, i) => {
          const z = -i * 10;
          const y = i * 4;
          const x = i * -3;
          return (
            <div
              key={p.id}
              className="stack-card"
              style={{
                ["--h" as never]: p.h,
                transform: `translate3d(${x}px, ${y}px, ${z}px)`,
                opacity: 1 - i * 0.10,
                zIndex: 10 - i,
              }}
            >
              <div className="row">
                <div className="av" style={{ ["--h" as never]: p.h }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="card-author">{p.author}</div>
                  <div className="card-role">{p.role}</div>
                </div>
              </div>
              <div className="lines">
                <i /><i /><i /><i />
              </div>
              <div className="badge">post · {String(p.postIndex).padStart(3, "0")}</div>
            </div>
          );
        })}
      </div>
      <div className="stack-counter">
        <div className="v">{String(remaining).padStart(2, "0")}</div>
        <div className="k">remaining</div>
      </div>
    </div>
  );
}
