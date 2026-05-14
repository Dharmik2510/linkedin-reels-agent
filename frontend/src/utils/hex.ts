export const HEX_R = 22;
export const HEX_W = HEX_R * 2;
export const HEX_H = Math.sqrt(3) * HEX_R;
export const HEX_DX = HEX_W * 0.75;

export interface HexCell {
  id: string;
  cx: number;
  cy: number;
  points: string;
}

function hexPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(2)},${(cy + Math.sin(a) * r).toFixed(2)}`);
  }
  return pts.join(" ");
}

export function buildHexes(width: number, height: number): HexCell[] {
  const cells: HexCell[] = [];
  const cols = Math.ceil(width / HEX_DX) + 2;
  const rows = Math.ceil(height / HEX_H) + 2;
  for (let q = -1; q < cols; q++) {
    for (let r = -1; r < rows; r++) {
      const cx = q * HEX_DX;
      const cy = r * HEX_H + ((q & 1) ? HEX_H / 2 : 0);
      cells.push({ id: `${q},${r}`, cx, cy, points: hexPoints(cx, cy, HEX_R - 1.5) });
    }
  }
  return cells;
}

export function findHexAt(cells: HexCell[], x: number, y: number): HexCell | null {
  let best: HexCell | null = null;
  let bestD = Infinity;
  for (const c of cells) {
    const dx = c.cx - x;
    const dy = c.cy - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}
