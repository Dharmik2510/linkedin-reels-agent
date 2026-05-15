import styles from "./styles/app.module.css";
import Header from "./components/Header";
import ConfigurePanel from "./components/ConfigurePanel";
import PipelinePanel from "./components/PipelinePanel";
import ScriptsPanel from "./components/ScriptsPanel";
import ScriptModal from "./components/ScriptModal";
import Terminal from "./components/Terminal";
import Dust from "./components/Dust";

export default function App() {
  return (
    <div className={styles.app}>
      <Dust />
      <Header />
      <div className={styles.grid}>
        <ConfigurePanel />
        <PipelinePanel />
        <ScriptsPanel />
      </div>
      <div className={styles.termStrip}>
        <Terminal />
      </div>
      <ScriptModal />
    </div>
  );
}
