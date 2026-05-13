import styles from "./styles/app.module.css";
import Header from "./components/Header";

export default function App() {
  return (
    <div className={styles.app}>
      <Header />
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
