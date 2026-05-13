import { useEffect, useRef, useState } from "react";
import { Chev } from "../icons";
import styles from "./Dropdown.module.css";

export interface DropdownOption {
  n: number;
  label: string;
  est: string;
}

interface Props {
  value: number;
  options: DropdownOption[];
  disabled?: boolean;
  onChange: (n: number) => void;
}

export default function Dropdown({ value, options, disabled, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.n === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        type="button"
        className={styles.trigger}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.value}>
          <span className={styles.n}>{current.n}</span>
          <span className={styles.meta}>posts · {current.est}</span>
        </span>
        <Chev className={`${styles.chev} ${open ? styles.open : ""}`} />
      </button>
      {open && (
        <ul className={styles.menu} role="listbox">
          {options.map((o) => (
            <li
              key={o.n}
              role="option"
              aria-selected={o.n === value}
              className={`${styles.opt} ${o.n === value ? styles.selected : ""}`}
              onClick={() => { onChange(o.n); setOpen(false); }}
            >
              <span className={styles.optN}>{o.n}</span>
              <span className={styles.est}>{o.est}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
