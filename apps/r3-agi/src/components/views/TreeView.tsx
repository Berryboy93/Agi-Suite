import { Panel } from "../../ui/components/Panel";
import { colors } from "../../ui/tokens/colors";
import { typography } from "../../ui/tokens/typography";

type Seg = { text: string; color?: string };
type Line = Seg[];

const tree: Line[] = [
  [{ text: "~/Stable/", color: colors.semantic.status.active }],
  [
    { text: "├── " },
    { text: "client/src/", color: colors.semantic.status.active },
  ],
  [
    { text: "│   ├── " },
    { text: "components/", color: colors.semantic.status.active },
  ],
  [
    { text: "│   │   ├── " },
    { text: "admin/", color: colors.semantic.status.healthy },
    { text: "  ← AgentSuite.tsx, AgentMeshPanel.tsx ✓" },
  ],
  [
    { text: "│   │   ├── " },
    { text: "TimeSavingsPanel.tsx", color: colors.semantic.status.active },
    { text: "  ← MVP item 3 ✓" },
  ],
  [
    { text: "│   │   └── " },
    { text: "MixSuggestionsPanel.tsx", color: colors.semantic.status.active },
    { text: "  ← MVP item 4 frontend" },
  ],
  [
    { text: "│   ├── " },
    { text: "pages/", color: colors.semantic.status.active },
  ],
  [
    { text: "│   │   ├── " },
    { text: "admin/AgentSuitePage.tsx", color: colors.semantic.status.healthy },
    { text: "  ← App.tsx:56 imported ✓" },
  ],
  [
    { text: "│   │   └── " },
    { text: "DAW.tsx", color: colors.semantic.status.active },
    { text: "  ← SessionChip L1782 + SessionSummaryPanel L1750 ✓" },
  ],
  [
    { text: "│   └── " },
    { text: "hooks/", color: colors.semantic.status.active },
  ],
  [
    { text: "│       └── " },
    { text: "authStore.ts", color: colors.semantic.status.active },
    { text: "  ← stored token restored ✓" },
  ],
  [{ text: "├── " }, { text: "server/", color: colors.semantic.status.active }],
  [
    { text: "│   ├── " },
    { text: "routers/", color: colors.semantic.status.active },
  ],
  [
    { text: "│   │   ├── " },
    { text: "adminRouter.ts", color: colors.semantic.status.healthy },
    { text: "  ← wired ✓" },
  ],
  [
    { text: "│   │   ├── " },
    { text: "sessionMetrics.router.ts", color: colors.semantic.status.healthy },
    { text: "  ← wired ✓" },
  ],
  [
    { text: "│   │   ├── " },
    { text: "mixer.router.ts", color: colors.semantic.status.healthy },
    { text: "  ← wired ✓" },
  ],
  [
    { text: "│   │   └── " },
    {
      text: "dj.router.ts, aiMix.router.ts",
      color: colors.semantic.status.healthy,
    },
    { text: "  ← wired ✓" },
  ],
  [
    { text: "│   ├── " },
    { text: "procedures.ts", color: colors.semantic.status.healthy },
    { text: "  ← 11 routers wired ✓" },
  ],
  [
    { text: "│   ├── " },
    { text: "index.ts", color: colors.semantic.status.warning },
    { text: "  ← console.log ×5 (lines 300-308) — P2" },
  ],
  [
    { text: "│   ├── " },
    { text: "services/", color: colors.semantic.status.active },
  ],
  [
    { text: "│   │   ├── " },
    {
      text: "session-metrics.service.ts",
      color: colors.semantic.status.warning,
    },
    { text: "  ← P1: wire aiDecisionLog writes" },
  ],
  [
    { text: "│   │   └── " },
    { text: "time-savings.service.ts", color: colors.semantic.status.active },
  ],
  [
    { text: "│   └── " },
    { text: "routes/presets.ts", color: colors.semantic.status.warning },
    { text: "  ← as any ×4 (lines 10,11,16,17) — P2" },
  ],
  [
    { text: "├── " },
    { text: "drizzle/migrations/", color: colors.semantic.status.active },
  ],
  [
    { text: "│   └── " },
    {
      text: "0005_overjoyed_gambit.sql",
      color: colors.semantic.status.warning,
    },
    { text: "  ← PENDING Railway apply (P0)" },
  ],
  [
    { text: "├── " },
    { text: "r3_hygiene.py", color: colors.semantic.status.active },
    { text: "  ← v2.0 with ASI learning" },
  ],
  [
    { text: "└── " },
    { text: "CLAUDE.md", color: colors.semantic.status.active },
    { text: "  ← v4 constitution" },
  ],
];

export function TreeView() {
  return (
    <Panel elevation="raised" padding="md" variant="default">
      <Panel.Header
        title={
          <>
            <span style={{ color: colors.semantic.status.active }}>📁</span> R3
            v4 — ~/Stable (Key Paths)
          </>
        }
      />
      <Panel.Body>
        <div
          style={{
            fontSize: typography.semantic.caption.size,
            lineHeight: 2,
            color: colors.semantic.content.tertiary,
            overflowX: "auto",
          }}
        >
          {tree.map((line, i) => (
            <div key={i}>
              {line.map((seg, j) => (
                <span key={j} style={seg.color ? { color: seg.color } : {}}>
                  {seg.text}
                </span>
              ))}
            </div>
          ))}
        </div>
      </Panel.Body>
    </Panel>
  );
}
