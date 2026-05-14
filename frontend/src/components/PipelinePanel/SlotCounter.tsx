interface Props {
  value: number;
  width?: number;
}

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

export default function SlotCounter({ value, width = 3 }: Props) {
  const str = String(Math.max(0, Math.round(value))).padStart(width, "0");
  return (
    <span style={{ display: "inline-flex", lineHeight: 1 }}>
      {str.split("").map((ch, i) => (
        <span className="digit" key={i}>
          <i style={{ transform: `translateY(-${parseInt(ch, 10) * 28}px)` }}>
            {DIGITS.map((d) => (
              <span key={d} style={{ display: "block", height: 28 }}>{d}</span>
            ))}
          </i>
        </span>
      ))}
    </span>
  );
}
