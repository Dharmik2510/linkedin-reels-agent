import { useReducedMotion } from "../../hooks/useReducedMotion";

interface Props {
  text: string;
  stagger?: number;
}

export default function KineticReveal({ text, stagger = 60 }: Props) {
  const reduced = useReducedMotion();
  const words = text.split(/\s+/);
  if (reduced) return <span>{text}</span>;
  return (
    <span style={{ display: "inline-block" }}>
      {words.map((w, i) => (
        <span
          key={i}
          style={{
            display: "inline-block",
            marginRight: "0.25em",
            opacity: 0,
            transform: "translateY(6px)",
            animation: `kineticUp 0.45s cubic-bezier(.4,0,.2,1) ${i * stagger}ms forwards`,
          }}
        >
          {w}
        </span>
      ))}
    </span>
  );
}
