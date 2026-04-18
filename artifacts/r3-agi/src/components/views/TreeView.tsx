import { Card } from '../ui/Card';

const ac = 'var(--accent)';
const acid = 'var(--acid)';
const vi = 'var(--violet)';
const done = 'var(--done)';
const warn = 'var(--warn)';
const d2 = 'var(--text2)';

type Seg = { text: string; color?: string };
type Line = Seg[];

const tree: Line[] = [
  [{ text: '~/Stable/', color: ac }],
  [{ text: '├── ' }, { text: 'client/src/', color: ac }],
  [{ text: '│   ├── ' }, { text: 'components/', color: ac }],
  [{ text: '│   │   ├── ' }, { text: 'admin/', color: done }, { text: '  ← AgentSuite.tsx, AgentMeshPanel.tsx ✓' }],
  [{ text: '│   │   ├── ' }, { text: 'TimeSavingsPanel.tsx', color: acid }, { text: '  ← MVP item 3 ✓' }],
  [{ text: '│   │   └── ' }, { text: 'MixSuggestionsPanel.tsx', color: acid }, { text: '  ← MVP item 4 frontend' }],
  [{ text: '│   ├── ' }, { text: 'pages/', color: ac }],
  [{ text: '│   │   ├── ' }, { text: 'admin/AgentSuitePage.tsx', color: done }, { text: '  ← App.tsx:56 imported ✓' }],
  [{ text: '│   │   └── ' }, { text: 'DAW.tsx', color: acid }, { text: '  ← SessionChip L1782 + SessionSummaryPanel L1750 ✓' }],
  [{ text: '│   └── ' }, { text: 'hooks/', color: ac }],
  [{ text: '│       └── ' }, { text: 'authStore.ts', color: acid }, { text: '  ← stored token restored ✓' }],
  [{ text: '├── ' }, { text: 'server/', color: ac }],
  [{ text: '│   ├── ' }, { text: 'routers/', color: ac }],
  [{ text: '│   │   ├── ' }, { text: 'adminRouter.ts', color: done }, { text: '  ← wired ✓' }],
  [{ text: '│   │   ├── ' }, { text: 'sessionMetrics.router.ts', color: done }, { text: '  ← wired ✓' }],
  [{ text: '│   │   ├── ' }, { text: 'mixer.router.ts', color: done }, { text: '  ← wired ✓' }],
  [{ text: '│   │   └── ' }, { text: 'dj.router.ts, aiMix.router.ts', color: done }, { text: '  ← wired ✓' }],
  [{ text: '│   ├── ' }, { text: 'procedures.ts', color: done }, { text: '  ← 11 routers wired ✓' }],
  [{ text: '│   ├── ' }, { text: 'index.ts', color: warn }, { text: '  ← console.log ×5 (lines 300-308) — P2' }],
  [{ text: '│   ├── ' }, { text: 'services/', color: ac }],
  [{ text: '│   │   ├── ' }, { text: 'session-metrics.service.ts', color: warn }, { text: '  ← P1: wire aiDecisionLog writes' }],
  [{ text: '│   │   └── ' }, { text: 'time-savings.service.ts', color: acid }],
  [{ text: '│   └── ' }, { text: 'routes/presets.ts', color: warn }, { text: '  ← as any ×4 (lines 10,11,16,17) — P2' }],
  [{ text: '├── ' }, { text: 'drizzle/migrations/', color: ac }],
  [{ text: '│   └── ' }, { text: '0005_overjoyed_gambit.sql', color: warn }, { text: '  ← PENDING Railway apply (P0)' }],
  [{ text: '├── ' }, { text: 'r3_hygiene.py', color: acid }, { text: '  ← v2.0 with ASI learning' }],
  [{ text: '└── ' }, { text: 'CLAUDE.md', color: acid }, { text: '  ← v4 constitution' }],
];

export function TreeView() {
  return (
    <Card title={<><span style={{ color: ac }}>📁</span> R3 v4 — ~/Stable (Key Paths)</>}>
      <div style={{ fontSize: 11, lineHeight: 2, color: d2, overflowX: 'auto' }}>
        {tree.map((line, i) => (
          <div key={i}>
            {line.map((seg, j) => (
              <span key={j} style={seg.color ? { color: seg.color } : {}}>{seg.text}</span>
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}
