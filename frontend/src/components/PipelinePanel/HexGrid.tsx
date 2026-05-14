import { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import { buildHexes } from "../../utils/hex";

export interface HexGridHandle {
  setLit(map: Record<string, number>): void;
}

interface Props {
  width: number;
  height: number;
}

const HexGrid = forwardRef<HexGridHandle, Props>(function HexGrid({ width, height }, ref) {
  const cells = useMemo(() => buildHexes(width, height), [width, height]);
  const [lit, setLit] = useState<Record<string, number>>({});

  useImperativeHandle(ref, () => ({
    setLit(map: Record<string, number>) {
      setLit(map);
    },
  }), []);

  return (
    <svg
      className="hex-svg"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    >
      {cells.map((c) => (
        <polygon
          key={c.id}
          className={lit[c.id] ? "hex lit" : "hex"}
          points={c.points}
        />
      ))}
    </svg>
  );
});

export default HexGrid;
