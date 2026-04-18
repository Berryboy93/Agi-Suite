import "./index.css";
import { useEffect, useState } from "react";
import { useAGI } from "./store/useAGI";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { RightPanel } from "./components/RightPanel";
import {
  AgentSuitePanel,
  AgentSuiteToggle,
} from "./components/AgentSuitePanel";
import { OverviewView } from "./components/views/OverviewView";
import { PrioritiesView } from "./components/views/PrioritiesView";
import { LLPTEView } from "./components/views/LLPTEView";
import { PatchView } from "./components/views/PatchView";
import { ChecklistView } from "./components/views/ChecklistView";
import { TreeView } from "./components/views/TreeView";
import { VerifyView } from "./components/views/VerifyView";
import { PRDView } from "./components/views/PRDView";
import { APIView } from "./components/views/APIView";
import { ASIView } from "./components/views/ASIView";
import { IntelligenceView } from "./components/views/IntelligenceView";
import { AGICmdView } from "./components/views/AGICmdView";

const BOOT_LINES = [
  "R3 AGI COMMAND CENTER v3.1.0 INITIALIZING...",
  "LOADING LLPTE PIPELINE · PRD v4.1 · ASI MEMORY.............. [OK]",
  "SYSTEM READY — ALL SUBSYSTEMS NOMINAL",
];

function BootScreen({ onDone }: { onDone: () => void }) {
  const [visibleLines, setVisibleLines] = useState<number[]>([]);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    BOOT_LINES.forEach((_, i) => {
      timers.push(
        setTimeout(
          () => setVisibleLines((prev) => [...prev, i]),
          i * 450 + 100,
        ),
      );
    });
    timers.push(setTimeout(() => setFading(true), 1500));
    timers.push(setTimeout(() => onDone(), 1850));
    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        opacity: fading ? 0 : 1,
        transition: "opacity 0.35s ease",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontFamily: "var(--sans)",
          fontSize: 13,
          fontWeight: 800,
          color: "var(--acid)",
          letterSpacing: 3,
          marginBottom: 16,
          textTransform: "uppercase",
        }}
      >
        R3<span style={{ color: "var(--accent)" }}>v4</span>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          minWidth: 420,
        }}
      >
        {BOOT_LINES.map((line, i) => (
          <div
            key={i}
            style={{
              fontFamily: "var(--mono)",
              fontSize: 11,
              color:
                i === BOOT_LINES.length - 1 ? "var(--done)" : "var(--text2)",
              letterSpacing: 0.5,
              opacity: visibleLines.includes(i) ? 1 : 0,
              transform: visibleLines.includes(i)
                ? "translateY(0)"
                : "translateY(6px)",
              transition: "opacity 0.25s ease, transform 0.25s ease",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ color: "var(--acid)", flexShrink: 0 }}>&gt;</span>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

function CenterContent() {
  const { activeView, focusBanner, clearFocus } = useAGI();

  return (
    <main
      style={{
        overflowY: "auto",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {focusBanner && (
        <div
          style={{
            padding: "6px 13px",
            background: "rgba(163,230,53,.06)",
            borderBottom: "1px solid rgba(163,230,53,.15)",
            fontSize: 10,
            color: "var(--acid)",
            letterSpacing: 1,
            display: "flex",
            alignItems: "center",
            gap: 8,
            borderRadius: 3,
          }}
        >
          <span style={{ fontSize: 12 }}>◈</span>
          <span>{focusBanner}</span>
          <span
            onClick={clearFocus}
            style={{
              marginLeft: "auto",
              cursor: "pointer",
              color: "var(--dim)",
              fontSize: 11,
            }}
          >
            ✕
          </span>
        </div>
      )}
      <div key={activeView} style={{ animation: "viewEnter 0.22s ease both" }}>
        {activeView === "overview" && <OverviewView />}
        {activeView === "priorities" && <PrioritiesView />}
        {activeView === "llpte" && <LLPTEView />}
        {activeView === "patch" && <PatchView />}
        {activeView === "checklist" && <ChecklistView />}
        {activeView === "tree" && <TreeView />}
        {activeView === "verify" && <VerifyView />}
        {activeView === "prd" && <PRDView />}
        {activeView === "api" && <APIView />}
        {activeView === "asi" && <ASIView />}
        {activeView === "intelligence" && <IntelligenceView />}
        {activeView === "agi-cmd" && <AGICmdView />}
      </div>
    </main>
  );
}

function App() {
  const [booting, setBooting] = useState(true);
  const agentSuiteOpen = useAGI((s) => s.agentSuiteOpen);
  const toggleAgentSuite = useAGI((s) => s.toggleAgentSuite);

  return (
    <>
      {booting && <BootScreen onDone={() => setBooting(false)} />}
      <div
        id="root"
        style={{
          position: "relative",
          zIndex: 1,
          display: "grid",
          gridTemplateRows: "50px 1fr",
          height: "100vh",
          overflow: "hidden",
          opacity: booting ? 0 : 1,
          transition: "opacity 0.3s ease",
        }}
      >
        <Header />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "224px 1fr 304px",
            height: "calc(100vh - 50px)",
            overflow: "hidden",
          }}
        >
          <Sidebar />
          <CenterContent />
          <RightPanel />
        </div>
      </div>
      <AgentSuiteToggle isOpen={agentSuiteOpen} onClick={toggleAgentSuite} />
      <AgentSuitePanel isOpen={agentSuiteOpen} onClose={toggleAgentSuite} />
    </>
  );
}

export default App;
