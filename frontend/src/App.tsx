import styles from "./styles/app.module.css";
import Header from "./components/Header";
import ConfigurePanel from "./components/ConfigurePanel";
import PipelinePanel from "./components/PipelinePanel";
import ScriptsPanel from "./components/ScriptsPanel";
import Terminal from "./components/Terminal";

export default function App() {
  return (
    <div className={styles.app}>
      <Header />
      <div className={styles.grid}>
        <ConfigurePanel />
        <PipelinePanel />
        <div className={styles.rightColumn}>
          <ScriptsPanel />
          <Terminal />
        </div>
      </div>
    </div>
  );
}
