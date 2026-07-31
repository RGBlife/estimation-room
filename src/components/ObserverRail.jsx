import { participantAvatarSrc } from '../lib/avatar.js';

// Each observer sits on a small CSS-drawn chair: back, two legs, seat, avatar
// on top, and a "gaze" triangle pointing toward the table.
export default function ObserverRail({ observers, uid, canTarget = false, onThrowAt, registerSeatNode = () => {} }) {
  if (observers.length === 0) return null;

  return (
    <div
      style={{
        width: 150, flexShrink: 0, background: 'var(--sp-panel)', borderLeft: '1px solid var(--sp-border)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '18px 10px', gap: 10, overflowY: 'auto',
      }}
    >
      <div style={{ fontWeight: 800, color: 'var(--sp-text-faint)', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        Observers
      </div>
      <div style={{ fontSize: 10, color: 'var(--sp-text-faintest)', textAlign: 'center', lineHeight: 1.4, marginBottom: 4 }}>
        Seated at the rail, watching the table
      </div>

      {observers.map(([id, p]) => {
        const canClick = canTarget && id !== uid;
        return (
          <div
            key={id}
            ref={node => registerSeatNode(id, node)}
            onClick={canClick ? () => onThrowAt(id) : undefined}
            style={{ position: 'relative', width: 76, height: 104, flexShrink: 0, cursor: canClick ? 'crosshair' : 'default' }}
          >
            <div style={{ position: 'absolute', top: 6, left: 20, width: 38, height: 50, borderRadius: '8px 8px 3px 3px', background: 'var(--sp-panel-3)', border: '1px solid var(--sp-border)', zIndex: 1 }} />
            <div style={{ position: 'absolute', top: 64, left: 16, width: 5, height: 24, borderRadius: '0 0 2px 2px', background: 'var(--sp-panel-3)', zIndex: 1 }} />
            <div style={{ position: 'absolute', top: 64, left: 55, width: 5, height: 24, borderRadius: '0 0 2px 2px', background: 'var(--sp-panel-3)', zIndex: 1 }} />
            <div style={{ position: 'absolute', top: 52, left: 12, width: 52, height: 15, borderRadius: 5, background: 'var(--sp-panel-2)', border: '1px solid var(--sp-border)', zIndex: 2 }} />
            <img
              src={participantAvatarSrc(p)}
              alt=""
              style={{ position: 'absolute', top: 10, left: 2, zIndex: 3, width: 44, height: 44, borderRadius: '50%', display: 'block', border: '2px solid var(--sp-panel)', boxShadow: '0 2px 6px rgba(0,0,0,0.35)', background: 'var(--sp-card-bg)' }}
            />
            <div style={{ position: 'absolute', top: 30, left: -8, zIndex: 3, width: 0, height: 0, borderTop: '4px solid transparent', borderBottom: '4px solid transparent', borderRight: '7px solid var(--sp-text-faint)' }} />
            <div style={{ position: 'absolute', top: 92, left: 0, width: 76, fontSize: 11, fontWeight: 700, color: 'var(--sp-text-dim)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {id === uid ? p.name + ' (you)' : p.name}
            </div>
          </div>
        );
      })}
    </div>
  );
}
