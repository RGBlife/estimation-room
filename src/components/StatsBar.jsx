export default function StatsBar({ hasAverage, average, isWideSpread }) {
  if (!hasAverage && !isWideSpread) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 16, flexWrap: 'wrap' }}>
      {hasAverage && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--sp-mono)', fontSize: 24, fontWeight: 700, color: 'var(--sp-text)' }}>{average}</div>
          <div style={{ fontSize: 11, color: 'var(--sp-text-faint)', marginTop: 2 }}>average</div>
        </div>
      )}
      {isWideSpread && (
        <div style={{ background: 'var(--sp-warn-bg)', border: '1px solid var(--sp-warn-border)', color: 'var(--sp-warn-text)', padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>⚠ Wide spread — discuss?</div>
      )}
    </div>
  );
}
