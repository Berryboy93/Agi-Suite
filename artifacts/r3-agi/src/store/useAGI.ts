import { create } from 'zustand';

export interface LogEntry {
  ts: string;
  tag: string;
  cls: string;
  text: string;
}

export interface PrioItem {
  tag: string;
  cls: string;
  title: string;
  detail: string;
  cmd?: string;
  done: boolean;
}

interface AGIState {
  activeView: string;
  activePatchTab: string;
  activePanelMode: string;
  focusBanner: string | null;
  logs: LogEntry[];
  prios: PrioItem[];
  chatMessages: { role: 'user' | 'assistant'; content: string }[];
  apiKey: string;
  agentSuiteOpen: boolean;

  setView: (view: string) => void;
  setPatchTab: (tab: string) => void;
  setPanelMode: (mode: string) => void;
  setFocus: (msg: string) => void;
  clearFocus: () => void;
  addLog: (tag: string, text: string, cls?: string) => void;
  clearLog: () => void;
  togglePrio: (i: number) => void;
  addChatMessage: (role: 'user' | 'assistant', content: string) => void;
  clearChat: () => void;
  setApiKey: (key: string) => void;
  toggleAgentSuite: () => void;
}

const INITIAL_PRIOS: PrioItem[] = [
  {
    tag: 'P0', cls: 'pt-p0',
    title: 'Apply migration 0005 to Railway production DB',
    detail: 'aiDecisionLog table missing in prod. Demo acceptance rate = 0. GET URL: railway.app → PostgreSQL → Connect tab.',
    cmd: 'DATABASE_URL="postgresql://postgres:PASS@ballast.proxy.rlwy.net:25291/railway" pnpm drizzle-kit migrate',
    done: false,
  },
  {
    tag: 'P2', cls: 'pt-p2',
    title: 'Fix server/routes/presets.ts — 4 Drizzle as any casts',
    detail: 'Lines 10, 11, 16, 17. Type with InsertEffectPreset / InsertEffectChain. Hard guard violation.',
    done: false,
  },
  {
    tag: 'P2', cls: 'pt-p2',
    title: 'Replace console.log in server/index.ts:300-308',
    detail: 'Hard guard: no console.log in committed code. Replace with morgan structured logger (already installed).',
    done: false,
  },
  {
    tag: 'P3', cls: 'pt-p3',
    title: 'Mix Suggestion System — backend wiring (MVP item 4)',
    detail: 'MixSuggestionsPanel.tsx built. tRPC procedure missing. Read server/services/ first. Use pro_artist tier for demo.',
    done: false,
  },
  {
    tag: 'P4', cls: 'pt-p4',
    title: 'Migration 0006 — materialized views',
    detail: 'mv_user_session_averages + mv_ai_acceptance_rates required for Time Savings baseline + confidence calibration.',
    done: false,
  },
  {
    tag: 'P4', cls: 'pt-p4',
    title: 'Fix vitest.config.ts — add package test include pattern',
    detail: "pnpm test returns no output. Add: include: ['packages/*/tests/*.test.ts', 'packages/*/src/**/*.test.ts']",
    done: false,
  },
  {
    tag: 'P5', cls: 'pt-p5',
    title: 'Consolidate 9 phantom directories',
    detail: 'client/src/store is LIVE — has active imports. Do NOT delete without migrating first. 9 dirs total.',
    done: false,
  },
];

function loadPrios(): PrioItem[] {
  try {
    const s = sessionStorage.getItem('r3-prios-v2');
    if (s) {
      const d: boolean[] = JSON.parse(s);
      return INITIAL_PRIOS.map((p, i) => ({ ...p, done: d[i] ?? p.done }));
    }
  } catch { /* ignore */ }
  return INITIAL_PRIOS;
}

function savePrios(prios: PrioItem[]) {
  sessionStorage.setItem('r3-prios-v2', JSON.stringify(prios.map(p => p.done)));
}

function makeLog(tag: string, text: string, cls = 'lt-cmd'): LogEntry {
  return {
    ts: new Date().toLocaleTimeString('en-US', { hour12: false }),
    tag,
    cls,
    text: text.substring(0, 80),
  };
}

export const useAGI = create<AGIState>((set, get) => ({
  activeView: 'overview',
  activePatchTab: 'all',
  activePanelMode: 'chat',
  focusBanner: null,
  logs: [{ ts: 'SESSION', tag: 'INIT', cls: 'lt-cmd', text: 'AGI Command Center v3.1.0 loaded — PRD v4.1 · 2026-04-16' }],
  prios: loadPrios(),
  chatMessages: [],
  apiKey: '',
  agentSuiteOpen: false,

  setView: (view) => {
    set({ activeView: view });
    get().addLog('NAV', 'Viewing: ' + view, 'lt-cmd');
  },

  setPatchTab: (tab) => set({ activePatchTab: tab }),

  setPanelMode: (mode) => set({ activePanelMode: mode }),

  setFocus: (msg) => {
    set({ focusBanner: msg });
    get().addLog('FOCUS', msg, 'lt-fix');
  },

  clearFocus: () => set({ focusBanner: null }),

  addLog: (tag, text, cls = 'lt-cmd') => {
    set(s => ({ logs: [...s.logs, makeLog(tag, text, cls)] }));
  },

  clearLog: () => {
    set({ logs: [makeLog('CLEAR', 'Log cleared', 'lt-cmd')] });
  },

  togglePrio: (i) => {
    const prios = get().prios.map((p, idx) => idx === i ? { ...p, done: !p.done } : p);
    savePrios(prios);
    const p = prios[i];
    get().addLog(p.tag, p.done ? 'DONE: ' + p.title.substring(0, 50) : 'REOPENED: ' + p.title.substring(0, 50), p.done ? 'lt-fix' : 'lt-p0');
    set({ prios });
  },

  addChatMessage: (role, content) => {
    set(s => ({ chatMessages: [...s.chatMessages, { role, content }] }));
    if (role === 'user') get().addLog('QUERY', content.substring(0, 60), 'lt-cmd');
    else get().addLog('AGENT', content.substring(0, 60), 'lt-fix');
  },

  clearChat: () => {
    set({ chatMessages: [] });
    get().addLog('CLEAR', 'Chat cleared', 'lt-cmd');
  },

  setApiKey: (key) => set({ apiKey: key }),

  toggleAgentSuite: () => set(s => ({ agentSuiteOpen: !s.agentSuiteOpen })),
}));
