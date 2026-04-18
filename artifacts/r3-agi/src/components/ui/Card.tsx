import { ReactNode } from 'react';

export function Card({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 3, padding: 13, marginBottom: 13 }}>
      <div style={{
        fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 700, color: '#fff',
        marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7,
        paddingBottom: 9, borderBottom: '1px solid var(--border)',
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}
