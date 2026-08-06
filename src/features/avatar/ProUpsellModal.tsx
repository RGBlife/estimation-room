interface ProUpsellModalProps {
  onSubscribe: () => void;
  onClose: () => void;
}

export default function ProUpsellModal({ onSubscribe, onClose }: ProUpsellModalProps) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 360, background: 'var(--sp-panel)',
          border: '1px solid var(--sp-border)', borderRadius: 14, padding: 24,
          display: 'flex', flexDirection: 'column', gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ background: 'linear-gradient(135deg,#f5a623,#f76b1c)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 5, letterSpacing: '0.04em' }}>PRO</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--sp-text)' }}>Unlock Estimation Room Pro</span>
        </div>

        <div style={{ fontSize: 13, color: 'var(--sp-text-dim)', lineHeight: 1.5 }}>Get Pro for the following:</div>
        <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--sp-text-dim)', lineHeight: 1.4 }}>
          <li>Any feature you build will be perfect and work first time</li>
          <li>Your AI models will no longer make any mistakes</li>
          <li>Each pro user will get a personal cleaning robot (coming 2050)</li>
          <li>We'll send Microsoft Teams every month a strongly worded complaint letter</li>
          <li>Priority queue for the one guy who understands the legacy VB.NET codebase</li>
          <li>The power to fly (enhanced durability not included)</li>
          <li>Oh, and access to the extras section of the avatar creator</li>
        </ul>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '6px 0' }}>
          <span style={{ background: 'linear-gradient(135deg,#f5a623,#f76b1c)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 5, letterSpacing: '0.04em' }}>LIMITED TIME OFFER</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, justifyContent: 'center' }}>
            <span style={{ fontSize: 15, color: 'var(--sp-text-placeholder)', textDecoration: 'line-through' }}>£10,000 a month</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--sp-accent-text-strong)' }}>£5 a month</span>
          </div>
        </div>

        <div style={{ fontSize: 11, color: 'var(--sp-text-placeholder)', textAlign: 'center' }}>(Disclaimer: this offer is real, trust me)</div>

        <button
          onClick={onSubscribe}
          style={{ border: 'none', background: 'var(--sp-accent)', color: 'var(--sp-bg)', borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--sp-font)' }}
        >Subscribe Now</button>
        <button
          onClick={onClose}
          style={{ border: 'none', background: 'none', color: 'var(--sp-text-faint)', fontSize: 12, cursor: 'pointer', padding: 2 }}
        >Not now</button>
      </div>
    </div>
  );
}
