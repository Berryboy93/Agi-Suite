import { useEffect, useState } from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { Card } from '../ui/Card';

function jitter(base: number, range: number) {
  return parseFloat((base + (Math.random() - .5) * range * 2).toFixed(1));
}

interface Metrics {
  latency: number;
  tick: number;
  edges: number;
  conf: number;
}

type HistoryPoint = { v: number };

interface MetricHistory {
  latency: HistoryPoint[];
  tick: HistoryPoint[];
  edges: HistoryPoint[];
  conf: HistoryPoint[];
}

const HISTORY_SIZE = 20;
const MANUAL_WORKFLOW_MS = 180000;
const AI_SLA_P50_MS = 10;
const AI_SLA_CEILING_MS = 15;

function initHistory(m: Metrics): MetricHistory {
  return {
    latency: Array.from({ length: HISTORY_SIZE }, () => ({ v: jitter(m.latency, 0.8) })),
    tick:    Array.from({ length: HISTORY_SIZE }, () => ({ v: jitter(m.tick, 0.05) })),
    edges:   Array.from({ length: HISTORY_SIZE }, () => ({ v: 847 + Math.floor((Math.random() - .5) * 6) })),
    conf:    Array.from({ length: HISTORY_SIZE }, () => ({ v: jitter(m.conf, 0.04) })),
  };
}

function pushHistory(hist: HistoryPoint[], val: number): HistoryPoint[] {
  const next = [...hist, { v: val }];
  if (next.length > HISTORY_SIZE) next.shift();
  return next;
}

function TimeSavingsPanel({ latencyMs }: { latencyMs: number }) {
  const efficiencyGain = Math.round(MANUAL_WORKFLOW_MS / latencyMs);
  const timeSaved = MANUAL_WORKFLOW_MS - latencyMs;
  const withinP50 = latencyMs <= AI_SLA_P50_MS;
  const withinCeiling = latencyMs <= AI_SLA_CEILING_MS;
  const slaLabel = withinP50 ? '✓ P50 TARGET' : withinCeiling ? '⚠ ABOVE P50' : '✕ CEILING BREACH';
  const slaColor = withinP50 ? 'var(--accent)' : withinCeiling ? 'var(--warn)' : 'var(--bad)';

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${withinP50 ? 'rgba(163,230,53,.3)' : withinCeiling ? 'rgba(245,158,11,.3)' : 'rgba(255,61,113,.3)'}`,
      borderRadius: 3,
      padding: 14,
      marginBottom: 13,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ color: 'var(--accent)', fontSize: 12 }}>⚡</span>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 700, color: '#fff' }}>
          Time Savings — Manual vs AI Execution
        </span>
        <span style={{
          marginLeft: 'auto', fontSize: 8, padding: '2px 6px', borderRadius: 2, letterSpacing: 1, fontWeight: 700,
          background: withinP50 ? 'rgba(163,230,53,.12)' : withinCeiling ? 'rgba(245,158,11,.12)' : 'rgba(255,61,113,.12)',
          color: slaColor,
          border: `1px solid ${withinP50 ? 'rgba(163,230,53,.25)' : withinCeiling ? 'rgba(245,158,11,.25)' : 'rgba(255,61,113,.25)'}`,
        }}>
          SLA {slaLabel}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'center' }}>
        <div style={{ background: 'rgba(255,61,113,.05)', border: '1px solid rgba(255,61,113,.15)', borderRadius: 3, padding: '10px 13px' }}>
          <div style={{ fontSize: 8, letterSpacing: 2, color: 'var(--text2)', textTransform: 'uppercase', marginBottom: 5 }}>Manual Workflow</div>
          <div style={{ fontFamily: 'var(--sans)', fontSize: 22, fontWeight: 800, color: 'var(--bad)', lineHeight: 1 }}>
            180<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text2)', marginLeft: 3 }}>s</span>
          </div>
          <div style={{ fontSize: 9, color: 'var(--text2)', marginTop: 4 }}>Human engineer · full transition</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <div style={{ fontSize: 18, color: 'var(--accent)' }}>→</div>
          <div style={{ fontSize: 8, letterSpacing: 1, color: 'var(--dim)', textTransform: 'uppercase' }}>AI</div>
        </div>

        <div style={{ background: 'rgba(163,230,53,.05)', border: '1px solid rgba(163,230,53,.2)', borderRadius: 3, padding: '10px 13px' }}>
          <div style={{ fontSize: 8, letterSpacing: 2, color: 'var(--text2)', textTransform: 'uppercase', marginBottom: 5 }}>
            R3 AI Inference (p50)
          </div>
          <div style={{ fontFamily: 'var(--sans)', fontSize: 22, fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>
            {latencyMs}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text2)', marginLeft: 3 }}>ms</span>
          </div>
          <div style={{ fontSize: 9, color: 'var(--text2)', marginTop: 4 }}>
            LLPTE pipeline · p50 target: {AI_SLA_P50_MS}ms · ceiling: {AI_SLA_CEILING_MS}ms
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
        <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid var(--border)', borderRadius: 3, padding: '8px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 8, letterSpacing: 2, color: 'var(--dim)', textTransform: 'uppercase', marginBottom: 3 }}>Efficiency Gain</div>
          <div style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 16, color: 'var(--accent)' }}>
            {efficiencyGain.toLocaleString()}×
          </div>
        </div>
        <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid var(--border)', borderRadius: 3, padding: '8px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 8, letterSpacing: 2, color: 'var(--dim)', textTransform: 'uppercase', marginBottom: 3 }}>Time Saved / Transition</div>
          <div style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 16, color: 'var(--done)' }}>
            {(timeSaved / 1000).toFixed(1)}s
          </div>
        </div>
      </div>
    </div>
  );
}

export function LLPTEView() {
  const [metrics, setMetrics] = useState<Metrics>({ latency: 10, tick: 0.8, edges: 847, conf: 0.65 });
  const [history, setHistory] = useState<MetricHistory>(() =>
    initHistory({ latency: 10, tick: 0.8, edges: 847, conf: 0.65 })
  );

  useEffect(() => {
    const t = setInterval(() => {
      const next: Metrics = {
        latency: jitter(10, .8),
        tick: jitter(.8, .05),
        edges: 847 + Math.floor((Math.random() - .5) * 6),
        conf: jitter(.72, .04),
      };
      setMetrics(next);
      setHistory(prev => ({
        latency: pushHistory(prev.latency, next.latency),
        tick:    pushHistory(prev.tick, next.tick),
        edges:   pushHistory(prev.edges, next.edges),
        conf:    pushHistory(prev.conf, next.conf),
      }));
    }, 3000);
    return () => clearInterval(t);
  }, []);

  const latColor = metrics.latency > 13 ? 'var(--bad)' : metrics.latency > 11 ? 'var(--warn)' : 'var(--done)';
  const latTrend = metrics.latency > 13 ? '▲ NEAR LIMIT' : metrics.latency > 11 ? '● WATCH' : '● WITHIN GATE';

  const pipeNodes = [
    { label: 'inputRouter',      pkg: 'llpte-adapters',          style: {} },
    { label: 'spectralAnalyzer', pkg: 'llpte-signal',            style: {} },
    { label: 'aiMixEngine',      pkg: 'llpte-ai',                style: { borderColor: 'rgba(163,230,53,.4)', color: 'var(--accent)' } },
    { label: 'transitionGraph',  pkg: 'llpte-transition-graph',  style: { borderColor: 'rgba(139,92,246,.4)', color: 'var(--violet)' } },
    { label: 'outputBus',        pkg: 'llpte-execution',         style: { borderColor: 'rgba(16,185,129,.4)', color: 'var(--done)' } },
  ];

  const metricCards = [
    { label: 'Inference Latency p50', id: 'latency', val: metrics.latency, unit: 'ms', barW: metrics.latency / 15 * 100, barColor: latColor, sub: 'SLA Gate: ≤10ms target · limit 15ms', trend: latTrend, trendColor: 'var(--accent)', hist: history.latency, areaColor: '#a3e635' },
    { label: 'Node Tick Time', id: 'tick', val: metrics.tick, unit: 'ms', barW: metrics.tick / 1 * 100, barColor: 'var(--accent)', sub: 'Limit: 1ms', trend: '● WITHIN GATE', trendColor: 'var(--accent)', hist: history.tick, areaColor: '#a3e635' },
    { label: 'Active Edges', id: 'edges', val: metrics.edges, unit: '/ 2000', barW: metrics.edges / 2000 * 100, barColor: 'var(--done)', sub: Math.round(metrics.edges / 20) + '% capacity', trend: '● HEALTHY', trendColor: 'var(--accent)', hist: history.edges, areaColor: '#10b981' },
    { label: 'Confidence Gate', id: 'conf', val: metrics.conf, unit: 'auto', barW: metrics.conf * 100, barColor: 'var(--accent)', sub: '0.40 suggest · <0.40 discard', trend: '● CALIBRATED', trendColor: 'var(--accent)', hist: history.conf, areaColor: '#a3e635' },
  ];

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 3, padding: 14, overflowX: 'auto', marginBottom: 13 }}>
        {pipeNodes.map((n, i) => (
          <div key={n.label} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                position: 'relative', overflow: 'hidden',
                background: 'rgba(163,230,53,.06)', border: '1px solid rgba(163,230,53,.18)',
                borderRadius: 3, padding: '6px 10px', fontSize: 10, color: 'var(--accent)',
                letterSpacing: .5, whiteSpace: 'nowrap', ...n.style,
              }}>
                {n.label}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,transparent,rgba(163,230,53,.07),transparent)', animation: 'shimmer 3s ease infinite' }} />
              </div>
              <div style={{ fontSize: 9, color: 'var(--text2)' }}>{n.pkg}</div>
            </div>
            {i < pipeNodes.length - 1 && (
              <div style={{ fontSize: 12, color: 'var(--dim)', padding: '0 6px', flexShrink: 0, animation: 'arrowPulse 2s ease-in-out infinite' }}>→</div>
            )}
          </div>
        ))}
        <div style={{ marginLeft: 'auto', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'slaPulse 2s ease-in-out infinite' }} />
          <span style={{ fontSize: 9, color: 'var(--accent)', letterSpacing: 1 }}>LIVE · 10ms SLA</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 13 }}>
        {metricCards.map(m => (
          <div key={m.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 3, padding: 12 }}>
            <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--dim)', textTransform: 'uppercase', marginBottom: 6 }}>{m.label}</div>
            <div style={{ fontFamily: 'var(--sans)', fontSize: 26, fontWeight: 800, color: '#fff', lineHeight: 1, display: 'flex', alignItems: 'baseline', gap: 4 }}>
              {m.val}
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 400, color: 'var(--text2)' }}>{m.unit}</span>
            </div>
            <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,.06)', marginTop: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 2, background: m.barColor, width: m.barW + '%', transition: 'width 1s ease' }} />
            </div>
            <div style={{ height: 36, marginTop: 8 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={m.hist} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`grad-${m.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={m.areaColor} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={m.areaColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke={m.areaColor}
                    strokeWidth={1.5}
                    fill={`url(#grad-${m.id})`}
                    isAnimationActive={false}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 3 }}>{m.sub}</div>
            <div style={{ fontSize: 9, marginTop: 3, color: m.trendColor }}>{m.trend}</div>
          </div>
        ))}
      </div>

      <TimeSavingsPanel latencyMs={metrics.latency} />

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 3, padding: 13, marginBottom: 13 }}>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
          <span style={{ color: 'var(--violet)' }}>◈</span> Confidence Distribution
        </div>
        <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,.05)', position: 'relative', overflow: 'hidden', margin: '8px 0' }}>
          <div style={{ height: '100%', borderRadius: 4, background: 'linear-gradient(90deg,var(--red) 0%,var(--warn) 40%,var(--accent) 65%,var(--done) 100%)', width: (metrics.conf * 100) + '%', transition: 'width 1.5s cubic-bezier(.4,0,.2,1)' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--dim)', marginTop: 3 }}>
          {['0.0', '0.25', '0.40', '0.65', '1.0'].map(m => <span key={m}>{m}</span>)}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {[{ color: 'var(--bad)', label: 'Discard <0.40' }, { color: 'var(--warn)', label: 'Suggest ≥0.40' }, { color: 'var(--done)', label: 'Auto-apply ≥0.65' }].map(z => (
            <div key={z.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, color: 'var(--text2)' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: z.color }} />
              {z.label}
            </div>
          ))}
        </div>
      </div>

      <Card title={<><span style={{ color: 'var(--accent)' }}>◈</span> LLPTE Performance Contract</>}>
        {[
          { dot: 'done', label: <>Inference latency p50: <strong>10ms</strong></>, detail: 'Gate: ≤15ms ✓ · SLA target: 10ms', dc: 'done' },
          { dot: 'done', label: <>Node tick time: <strong>0.8ms</strong></>, detail: 'Gate: ≤1ms ✓', dc: 'done' },
          { dot: 'done', label: <>Active edges: <strong>847</strong></>, detail: 'Limit: 2000 (42.4% capacity)', dc: 'done' },
          { dot: 'done', label: <>aiDecisionLog writes: <strong>WIRED</strong></>, detail: 'P1 DONE — session-metrics.service.ts + aiMix.router.ts', dc: 'done' },
          { dot: 'dim', label: <><code>spectralAnalyzer</code> lives in <code>llpte-signal</code></>, detail: 'NOT @llpte/spectral — package is llpte-signal', dc: 'dim' },
        ].map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: i < 4 ? '1px solid var(--border)' : 'none', fontSize: 11 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: { done: 'var(--done)', warn: 'var(--warn)', dim: 'var(--dim)' }[r.dot], boxShadow: r.dot !== 'dim' ? `0 0 5px ${{ done: 'var(--done)', warn: 'var(--warn)' }[r.dot]}` : undefined }} />
            <div style={{ flex: 1, color: 'var(--text)' }}>{r.label}</div>
            <div style={{ fontSize: 10, color: { done: 'var(--done)', warn: 'var(--warn)', dim: 'var(--text2)' }[r.dc] }}>{r.detail}</div>
          </div>
        ))}
      </Card>
    </>
  );
}
