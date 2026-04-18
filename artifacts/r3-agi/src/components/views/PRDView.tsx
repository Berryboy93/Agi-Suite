import { Card } from '../ui/Card';

export function PRDView() {
  const rows = [
    { section: '§1 Stack', claim: 'Zustand · Wouter · Stripe ONLY', status: '✓ Verified', color: 'var(--done)' },
    { section: '§1 Tiers', claim: 'explorer · creator · pro_artist', status: '✓ Correct', color: 'var(--done)' },
    { section: '§8 MVP 1–2', claim: 'Auto-Leveling (20t) · Smart Transitions (22t)', status: '✓ Complete', color: 'var(--done)' },
    { section: '§8 MVP 3', claim: 'Time Savings — SessionChip + Panel', status: '✓ DAW.tsx wired', color: 'var(--done)' },
    { section: '§8 MVP 4', claim: 'Mix Suggestion System', status: 'Frontend built · backend pending', color: 'var(--warn)' },
    { section: '§12 Schema', claim: 'aiDecisionLog — migration 0005', status: 'Schema done · Railway PENDING', color: 'var(--warn)' },
    { section: '§13 appRouter', claim: '11 routers in procedures.ts', status: '✓ All wired', color: 'var(--done)' },
    { section: '§8 LLPTE', claim: '10ms p50 · 847 edges · 0.8ms tick', status: '✓ Confirmed', color: 'var(--done)' },
    { section: '§11 Guards', claim: 'TSC 15 errors · 5 any · 5 console.log remaining', status: '15 TSC + 5+5 to fix', color: 'var(--bad)' },
  ];

  return (
    <Card title={<><span style={{ color: 'var(--violet)' }}>◉</span> PRD v4.0 State — 2026-04-09</>}>
      <table>
        <thead><tr><th>Section</th><th>Claim</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.section}>
              <td style={{ color: 'var(--text2)' }}>{r.section}</td>
              <td>{r.claim}</td>
              <td style={{ color: r.color }}>{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
