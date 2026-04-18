import { useEffect, useState } from 'react';
import { useAGI } from '../store/useAGI';
import { useMetrics } from '../hooks/useMetrics';

const ACID = '#a3e635';
const VIOLET = '#8B5CF6';

function formatHMS(date: Date) {
  return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatUptime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function Header() {
  const [time, setTime] = useState(() => formatHMS(new Date()));
  const [uptime, setUptime] = useState(0);
  const [btnHov, setBtnHov] = useState(false);
  const prios = useAGI(s => s.prios);
  const agentSuiteOpen = useAGI(s => s.agentSuiteOpen);
  const toggleAgentSuite = useAGI(s => s.toggleAgentSuite);
  const p0Done = prios[0]?.done ?? false;
  const openCount = prios.filter(p => !p.done).length;
  const mvpDone = 3 + (p0Done ? 1 : 0);
  const { metrics, connected } = useMetrics();

  useEffect(() => {
    const t = setInterval(() => {
      setTime(formatHMS(new Date()));
      setUptime(u => u + 1);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header style={{
      borderBottom: '1px solid var(--border)',
      padding: '0 18px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      background: 'rgba(9,9,11,.97)',
      backdropFilter: 'blur(20px)',
    }}>
      <div style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 17, letterSpacing: '-.5px', color: '#fff', display: 'flex', alignItems: 'center', gap: 7 }}>
        R3<span style={{ color: 'var(--accent)' }}>v4</span>{' '}
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, background: 'rgba(163,230,53,.12)', border: '1px solid rgba(163,230,53,.3)', color: 'var(--accent)', padding: '2px 7px', letterSpacing: 2, borderRadius: 2 }}>AGI CMD v3</span>
      </div>
      <span style={{ color: 'var(--border)', fontSize: 16 }}>|</span>
      <span style={{ fontSize: 10, color: 'var(--text2)' }}>PRD v4.1 · Live Controls · ASI Memory</span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 9, padding: '2px 7px', borderRadius: 2, letterSpacing: 1, fontWeight: 800,
          background: 'rgba(163,230,53,.15)', color: 'var(--accent)', border: '1px solid rgba(163,230,53,.3)',
          textTransform: 'uppercase',
        }}>
          pro_artist
        </span>
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={toggleAgentSuite}
          onMouseEnter={() => setBtnHov(true)}
          onMouseLeave={() => setBtnHov(false)}
          title="Toggle Expert Agent Suite"
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '4px 12px',
            background: agentSuiteOpen
              ? `${VIOLET}20`
              : btnHov ? `${ACID}12` : 'transparent',
            border: `1px solid ${agentSuiteOpen
              ? VIOLET + '60'
              : btnHov ? ACID + '60' : 'var(--border)'}`,
            borderRadius: 4,
            cursor: 'pointer',
            color: agentSuiteOpen ? VIOLET : btnHov ? ACID : 'var(--text2)',
            fontFamily: 'var(--mono)',
            fontSize: 10,
            letterSpacing: '0.08em',
            fontWeight: 600,
            transition: 'all 0.15s',
            boxShadow: agentSuiteOpen ? `0 0 10px ${VIOLET}30` : 'none',
          }}
        >
          <span style={{ fontSize: 13 }}>⬡</span>
          <span>{agentSuiteOpen ? 'CLOSE AGENTS' : 'AGENT SUITE'}</span>
          <span style={{
            fontSize: 8, padding: '1px 5px', borderRadius: 2,
            background: agentSuiteOpen ? `${VIOLET}25` : `${ACID}15`,
            border: `1px solid ${agentSuiteOpen ? VIOLET + '40' : ACID + '30'}`,
            color: agentSuiteOpen ? VIOLET : ACID,
          }}>14</span>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--text2)' }}>
          <span>TSC</span><span style={{ color: 'var(--bad)', fontWeight: 700 }}>15 ERR</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--text2)' }}>
          <span>ROUTERS</span><span style={{ color: 'var(--done)', fontWeight: 700 }}>11/11</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--text2)' }}>
          <span>MVP</span><span style={{ color: 'var(--text)', fontWeight: 700 }}>{mvpDone}/4</span>
        </div>

        {/* Live user indicator */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '3px 10px', borderRadius: 3,
          background: connected ? 'rgba(163,230,53,.06)' : 'rgba(255,255,255,.03)',
          border: `1px solid ${connected ? 'rgba(163,230,53,.18)' : 'rgba(255,255,255,.08)'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
              background: connected ? '#a3e635' : '#444',
              boxShadow: connected ? '0 0 6px #a3e63580' : 'none',
              animation: connected ? 'pulse 2s ease-in-out infinite' : 'none',
              flexShrink: 0,
            }} />
            <span style={{ fontSize: 9, letterSpacing: '0.1em', color: 'var(--dim)', fontFamily: 'var(--mono)' }}>LIVE</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: connected ? '#a3e635' : 'var(--text2)' }}>
              {metrics.activeUsers}
            </span>
          </div>
          <div style={{ width: 1, height: 10, background: 'var(--border)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 9, letterSpacing: '0.1em', color: 'var(--dim)', fontFamily: 'var(--mono)' }}>SUBS</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: 'var(--text2)' }}>
              {metrics.totalSubscribers}
            </span>
          </div>
        </div>

        <span style={{
          fontSize: 9, padding: '2px 7px', borderRadius: 2, letterSpacing: 1, fontWeight: 700,
          transition: 'all .3s',
          background: p0Done ? 'rgba(16,185,129,.1)' : 'rgba(255,61,113,.15)',
          color: p0Done ? 'var(--done)' : 'var(--bad)',
          border: `1px solid ${p0Done ? 'rgba(16,185,129,.2)' : 'rgba(255,61,113,.25)'}`,
        }}>
          {p0Done ? 'P0 DONE' : openCount > 0 ? 'P0 OPEN' : 'ALL CLEAR'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: 1 }}>UP</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text2)', letterSpacing: .5 }}>{formatUptime(uptime)}</span>
        </div>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--good)', boxShadow: '0 0 8px var(--good)', animation: 'pulse 2.5s ease-in-out infinite' }} />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text2)', letterSpacing: .5, minWidth: 60 }}>{time}</span>
      </div>
    </header>
  );
}
