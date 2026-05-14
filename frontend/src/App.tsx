import styles from "./styles/app.module.css";
import Header from "./components/Header";
import ConfigurePanel from "./components/ConfigurePanel";
import PipelinePanel from "./components/PipelinePanel";
import ScriptsPanel from "./components/ScriptsPanel";
import Terminal from "./components/Terminal";
import Dust from "./components/Dust";
import PhonePreview from "./components/PhonePreview";

export default function App() {
  return (
    <div className={styles.app}>
      <Dust />
      <Header />
      <div className={styles.grid}>
        <ConfigurePanel />
        <PipelinePanel />
        <div className={styles.rightCol}>
          <PhonePreview />
          <ScriptsPanel />
        </div>
      </div>
      <div className={styles.termStrip}>
        <Terminal />
      </div>
    </div>
  );
}
