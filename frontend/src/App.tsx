import styles from "./styles/app.module.css";
import Header from "./components/Header";
import ConfigurePanel from "./components/ConfigurePanel";

export default function App() {
  return (
    <div className={styles.app}>
      <Header />
      <div className={styles.grid}>
        <ConfigurePanel />
        <section className={styles.panelFlush}>pipeline</section>
        <div className={styles.rightColumn}>
          <section className={styles.panel}>scripts</section>
          <section className={styles.panelFlush}>terminal</section>
        </div>
      </div>
    </div>
  );
}
