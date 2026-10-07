import { useEffect, useMemo, useState } from 'react';
import type { Participant } from '../../types/room.ts';
import type { BacklogChange, BacklogTicket, PlanningTicket, TicketDraft } from '../../types/planning.ts';
import PlanningWindow from './PlanningWindow.tsx';
import AddTickets from './AddTickets.tsx';
import TicketDetail from './TicketDetail.tsx';
import './tickets.css';
import { LIMITS, MAX_TICKETS, newBacklogId } from './backlog.ts';
import { Face } from './Face.tsx';

// The people who have touched a ticket, most recent first, once each.
function contributors(ticket: BacklogTicket) {
  const all = [ticket.added, ...Object.values(ticket.edited ?? {}), ...(ticket.highlights ?? []).map(h => h.by)];
  const seen = new Set<string>();
  return all.filter(Boolean).sort((a, b) => b!.at - a!.at).filter(a => !seen.has(a!.uid) && !!seen.add(a!.uid)) as BacklogTicket['added'][];
}

function NewTicket({ onAdd, onCancel }: { onAdd: (draft: TicketDraft & { id: string }) => Promise<void>; onCancel: () => void }) {
  const [draft, setDraft] = useState({ key: '', title: '', description: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    setBusy(true); setError('');
    try { await onAdd({ ...draft, id: newBacklogId() }); } catch (e) { setError(e instanceof Error ? e.message : 'Could not add this ticket'); setBusy(false); }
  };
  return (
    <form className="sp-new-ticket" onSubmit={event => { event.preventDefault(); void save(); }}>
      <h3>New ticket</h3>
      <div className="sp-planning-row">
        <input aria-label="Key" placeholder="Key, optional" className="sp-new-key" maxLength={LIMITS.key} value={draft.key} onChange={e => setDraft({ ...draft, key: e.target.value })} />
        <input aria-label="Title" placeholder="Title" required autoFocus maxLength={LIMITS.title} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} />
      </div>
      <textarea aria-label="Description" placeholder="Description, optional" rows={6} maxLength={LIMITS.description} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} />
      {error && <p role="alert" className="sp-planning-error">{error}</p>}
      <div className="sp-planning-row sp-new-ticket-actions">
        <button type="button" className="sp-planning-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="sp-planning-primary" disabled={busy || !draft.title.trim()}>{busy ? 'Adding…' : 'Add ticket'}</button>
      </div>
    </form>
  );
}

export default function TicketsWindow({ tickets, activeTicketId, legacyTicket, uid, participants, isCreator, onChange, onSelect, onClose, closing }: {
  tickets: BacklogTicket[]; activeTicketId?: string; legacyTicket?: PlanningTicket;
  uid: string | null; participants: Record<string, Participant>; isCreator: boolean;
  onChange: (change: BacklogChange) => Promise<void>; onSelect: (ticketId: string | null) => Promise<void>;
  onClose: () => void; closing?: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | undefined>(activeTicketId ?? tickets[0]?.id);
  const [adding, setAdding] = useState(false);
  const [manual, setManual] = useState(false);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const selected = tickets.find(t => t.id === selectedId);
  // Someone else removed the ticket being read: fall back to the first.
  useEffect(() => { if (selectedId && !selected && !manual) setSelectedId(tickets[0]?.id); }, [selectedId, selected, manual, tickets]);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? tickets.filter(t => `${t.key ?? ''} ${t.title} ${t.description ?? ''}`.toLowerCase().includes(q)) : tickets;
  }, [tickets, search]);
  const empty = tickets.length === 0;
  // Three plain groups, all automatic: the ticket at the table, what is still
  // to estimate, and what a reveal has estimated.
  const atTable = shown.find(t => t.id === activeTicketId);
  const upNext = shown.filter(t => t.id !== activeTicketId && !t.estimate);
  const estimated = shown.filter(t => t.id !== activeTicketId && t.estimate);
  const row = (ticket: BacklogTicket) => (
    <li key={ticket.id}><button aria-pressed={!manual && selected?.id === ticket.id} onClick={() => { setSelectedId(ticket.id); setManual(false); }}>
      <span className="sp-ticket-meta"><strong>{ticket.key}</strong>{ticket.estimate && <span className="sp-estimate">{ticket.estimate.value}</span>}</span>
      <span className="sp-ticket-list-title">{ticket.title}</span>
      <span className="sp-ticket-people">
        <span className="sp-face-stack">{contributors(ticket).slice(0, 3).map(a => <Face key={a.uid} author={a} participants={participants} />)}</span>
        {!!ticket.highlights?.length && <span>{ticket.highlights.length === 1 ? '1 highlight' : `${ticket.highlights.length} highlights`}</span>}
      </span>
    </button></li>
  );
  const addDrafts = async (drafts: Array<TicketDraft & { id: string }>) => {
    await onChange({ operation: 'add', tickets: drafts });
    setSelectedId(drafts[0].id);
  };
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong. Try again.'); }
    setBusy(false);
  };

  return (
    <PlanningWindow title="Tickets" subtitle="The room's backlog, shared with everyone here." onClose={onClose} side="right" wide closing={closing}>
      <div className="sp-ticket-browser">
        <section className="sp-ticket-list-pane" aria-label="Backlog">
          <div className="sp-backlog-heading">
            <h3>Backlog <span>{tickets.length > 0 && `${tickets.length} of ${MAX_TICKETS}`}</span></h3>
            {!empty && !adding && <button type="button" className="sp-planning-secondary" onClick={() => { setAdding(true); setManual(false); }} disabled={tickets.length >= MAX_TICKETS}>Add tickets</button>}
          </div>
          {(empty || adding) && <AddTickets existing={tickets} onAdd={addDrafts} onManual={() => { setManual(true); setAdding(false); }} onCancel={empty ? undefined : () => setAdding(false)} />}
          {!empty && !adding && <div className="sp-ticket-filters"><input aria-label="Search tickets" placeholder="Search the backlog" value={search} onChange={e => setSearch(e.target.value)} /></div>}
          {!empty && (shown.length === 0
            ? <div className="sp-planning-empty"><h3>No matching tickets</h3><p>Try another word, or clear the search.</p><button className="sp-planning-secondary" onClick={() => setSearch('')}>Clear search</button></div>
            : <div className="sp-backlog-groups">
              {atTable && <><h4 className="sp-backlog-group sp-backlog-live">At the table</h4><ul className="sp-ticket-list">{row(atTable)}</ul></>}
              {upNext.length > 0 && <>{(atTable || estimated.length > 0) && <h4 className="sp-backlog-group">Up next <span>{upNext.length}</span></h4>}<ul className="sp-ticket-list">{upNext.map(row)}</ul></>}
              {estimated.length > 0 && <details className="sp-backlog-estimated">
                <summary className="sp-backlog-group">Estimated <span>{estimated.length}</span></summary>
                <ul className="sp-ticket-list">{estimated.map(row)}</ul>
              </details>}
              {isCreator && !search && <ClearBacklog busy={busy} onClear={() => run(() => onChange({ operation: 'clear' }))} />}
            </div>)}
        </section>
        <section className="sp-ticket-detail" aria-label="Ticket details">
          {manual ? <NewTicket onCancel={() => setManual(false)} onAdd={async draft => { await addDrafts([draft]); setManual(false); }} />
            : selected ? <TicketDetail key={selected.id} ticket={selected} uid={uid} participants={participants} isCreator={isCreator} isActive={selected.id === activeTicketId} onChange={onChange}
              onSelect={async id => { await onSelect(id); if (id) onClose(); }} />
            : legacyTicket ? <div className="sp-planning-empty"><h3>{legacyTicket.key} {legacyTicket.title}</h3><p>This ticket was chosen before the room had a shared backlog. Add it to the backlog to edit or highlight it.</p>
              {isCreator && <button className="sp-planning-secondary" disabled={busy} onClick={() => void run(() => onSelect(null))}>Clear the table</button>}</div>
            : <div className="sp-planning-empty"><h3>Bring work to the table</h3><p>Add tickets on the left. Everyone in the room sees them as they arrive and can edit or highlight what matters.</p></div>}
          {error && <p role="alert" className="sp-planning-error">{error}</p>}
        </section>
      </div>
    </PlanningWindow>
  );
}

function ClearBacklog({ busy, onClear }: { busy: boolean; onClear: () => Promise<void> }) {
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { if (!confirm) return; const t = setTimeout(() => setConfirm(false), 4000); return () => clearTimeout(t); }, [confirm]);
  return confirm
    ? <button disabled={busy} className="sp-link-button sp-danger sp-clear-backlog" onClick={() => void onClear().then(() => setConfirm(false))}>Delete every ticket for everyone</button>
    : <button disabled={busy} className="sp-link-button sp-clear-backlog" onClick={() => setConfirm(true)}>Clear backlog</button>;
}
