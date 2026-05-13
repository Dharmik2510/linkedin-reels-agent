import styles from "./styles/app.module.css";

export default function App() {
  return (
    <div className={styles.app}>
      <header style={{ height: 60, borderBottom: "1px solid var(--line)" }}>
        header placeholder
      </header>
      <div className={styles.grid}>
        <section className={styles.panel}>configure</section>
        <section className={styles.panelFlush}>pipeline</section>
        <div className={styles.rightColumn}>
          <section className={styles.panel}>scripts</section>
          <section className={styles.panelFlush}>terminal</section>
        </div>
      </div>
    </div>
  );
}
