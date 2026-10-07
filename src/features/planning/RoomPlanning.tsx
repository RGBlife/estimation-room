import { useEffect, useRef, useState } from 'react';
import type { RoomDoc } from '../../types/room.ts';
import type { BacklogChange, BacklogTicket, ReadinessChange } from '../../types/planning.ts';
import ReadinessChecklist from './ReadinessChecklist.tsx';
import ReadinessWindow from './ReadinessWindow.tsx';
import TicketsWindow from './TicketsWindow.tsx';
import './planning.css';

export default function RoomPlanning({ room, uid, tickets, isCreator, onChange, onBacklogChange, onSelect, onHeightChange }: {
  room: Pick<RoomDoc, 'readiness' | 'activeTicket' | 'activeTicketId' | 'participants'>; uid: string | null;
  tickets: BacklogTicket[]; isCreator: boolean;
  onChange: (change: ReadinessChange) => Promise<void>;
  onBacklogChange: (change: BacklogChange) => Promise<void>;
  onSelect: (ticketId: string | null) => Promise<void>;
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
  // The backlog entry at the table, or the snapshot an older build chose.
  const atTable = tickets.find(t => t.id === room.activeTicketId) ?? room.activeTicket;
  return (
    <>
      {/* Each button sits on the edge its drawer opens from: readiness left,
          tickets right, so a drawer never appears across the screen from
          the button that opened it. The checklist floats on the left too. */}
      <div ref={barRef} className="sp-planning-bar">
        <div className="sp-planning-tools">
          <button onClick={() => setPanel('readiness')}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m3 6 2 2 4-4M12 6h9M3 13h5m4 0h9M3 20h5m4 0h9" /></svg>Readiness{count > 0 && <span>{checked}/{count}</span>}</button>
        </div>
        <button className="sp-at-table" onClick={() => setPanel('tickets')}>
          {atTable ? <>{atTable.key && <strong>{atTable.key}</strong>}<span>{atTable.title}</span></>
            : <span>No ticket selected <small>{tickets.length ? 'Choose one from the backlog' : 'Add tickets to plan the next round'}</small></span>}
        </button>
        <div className="sp-planning-tools">
          <button onClick={() => setPanel('tickets')}>Tickets{tickets.length > 0 && <span>{tickets.length}</span>}</button>
        </div>
        {/* Out of the way while a drawer is open; the setup drawer has the
            same list, and two copies would compete for the same ticks. */}
        {count > 0 && !panel && <ReadinessChecklist items={items} onChange={onChange} onEdit={() => setPanel('readiness')} />}
      </div>
      {panel === 'readiness' && <ReadinessWindow items={items} onChange={onChange} closing={closing} onClose={() => setClosing(true)} />}
      {panel === 'tickets' && <TicketsWindow tickets={tickets} activeTicketId={room.activeTicketId} legacyTicket={room.activeTicketId ? undefined : room.activeTicket}
        uid={uid} participants={room.participants} isCreator={isCreator} onChange={onBacklogChange} onSelect={onSelect} closing={closing} onClose={() => setClosing(true)} />}
    </>
  );
}
