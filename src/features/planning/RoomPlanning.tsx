import { useEffect, useRef, useState } from 'react';
import type { RoomDoc } from '../../types/room.ts';
import type { PlanningTicket, ReadinessChange } from '../../types/planning.ts';
import ReadinessWindow from './ReadinessWindow.tsx';
import TicketsWindow from './TicketsWindow.tsx';
import './planning.css';

export default function RoomPlanning({ room, isCreator, onChange, onSelect, onHeightChange }: {
  room: Pick<RoomDoc, 'readiness' | 'activeTicket'>; isCreator: boolean;
  onChange: (change: ReadinessChange) => Promise<void>; onSelect: (ticket: PlanningTicket | null) => Promise<void>;
  // Reports the strip's height so the table can leave it out of its vertical
  // budget; otherwise the strip pushes the bottom seat row behind the results.
  onHeightChange?: (height: number) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = barRef.current;
    if (!node || !onHeightChange) return;
    const observer = new ResizeObserver(() => onHeightChange(node.getBoundingClientRect().height));
    observer.observe(node);
    return () => observer.disconnect();
  }, [onHeightChange]);
  const [panel, setPanel] = useState<'readiness' | 'tickets' | null>(null);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (!closing) return;
    // Keep the modal mounted through its exit so focus returns only after
    // the drawer leaves the table. Reduced motion closes immediately.
    const timer = setTimeout(() => { setPanel(null); setClosing(false); }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180);
    return () => clearTimeout(timer);
  }, [closing]);
  const items = room.readiness ?? {};
  const count = Object.keys(items).length;
  const checked = Object.values(items).filter(item => item.checked).length;
  return (
    <>
      <div ref={barRef} className="sp-planning-bar">
        <button className="sp-at-table" onClick={() => setPanel('tickets')}>
          {room.activeTicket ? <><strong>{room.activeTicket.key}</strong><span>{room.activeTicket.title}</span>{room.activeTicket.source === 'demo' && <small>Demo</small>}</>
            : <span>No ticket selected <small>Open tickets to plan the next round</small></span>}
        </button>
        <div className="sp-planning-tools">
          <button onClick={() => setPanel('readiness')}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m3 6 2 2 4-4M12 6h9M3 13h5m4 0h9M3 20h5m4 0h9" /></svg>Readiness <span>{checked}/{count}</span></button>
          <button onClick={() => setPanel('tickets')}>Tickets</button>
        </div>
      </div>
      {panel === 'readiness' && <ReadinessWindow items={items} onChange={onChange} closing={closing} onClose={() => setClosing(true)} />}
      {panel === 'tickets' && <TicketsWindow activeTicket={room.activeTicket} isCreator={isCreator} onSelect={onSelect} closing={closing} onClose={() => setClosing(true)} />}
    </>
  );
}
