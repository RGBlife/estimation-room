import { useEffect, useState } from 'react';
import type { PlanningTicket } from '../../types/planning.ts';
import PlanningWindow from './PlanningWindow.tsx';
import { DEMO_TEAMS, demoTicketProvider } from './ticketProvider.ts';

export default function TicketsWindow({ activeTicket, isCreator, onSelect, onClose, closing }: {
  activeTicket?: PlanningTicket; isCreator: boolean; onSelect: (ticket: PlanningTicket | null) => Promise<void>; onClose: () => void; closing?: boolean;
}) {
  const [demo, setDemo] = useState(() => import.meta.env.DEV && new URLSearchParams(location.search).get('jiraDemo') === '1');
  const [search, setSearch] = useState('');
  const [team, setTeam] = useState('');
  const [status, setStatus] = useState('');
  const [tickets, setTickets] = useState<PlanningTicket[]>([]);
  const [preview, setPreview] = useState<PlanningTicket | undefined>(activeTicket);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!demo) { setTickets([]); return; }
    let live = true;
    setLoading(true); setError('');
    demoTicketProvider.list({ search, team, status }).then(results => {
      if (live) { setTickets(results); setLoading(false); }
    }, () => { if (live) { setError('Could not load tickets. Change a filter to try again.'); setLoading(false); } });
    return () => { live = false; };
  }, [demo, search, team, status]);
  const select = async (ticket: PlanningTicket | null) => {
    setBusy(true); setError('');
    try { await onSelect(ticket); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not select this ticket'); setBusy(false); }
  };
  const alreadySelected = !!preview && preview.key === activeTicket?.key && preview.source === activeTicket.source;
  return (
    <PlanningWindow title="Tickets" subtitle="Bring one piece of work to the table." onClose={onClose} side="left" closing={closing}>
      <div className="sp-ticket-connection"><div><strong>{demo ? 'Demo workspace' : 'Jira'}</strong><span>{demo ? 'Sample issues. No Jira data is read or changed.' : 'Connection coming next. Your room is ready for ticket planning.'}</span></div>
        {import.meta.env.DEV && <label className="sp-demo-toggle"><input type="checkbox" checked={demo} onChange={e => setDemo(e.target.checked)} /> Use demo tickets</label>}
      </div>
      <div className="sp-ticket-browser">
        <section className="sp-ticket-list-pane" aria-label="Browse tickets">
          <div className="sp-ticket-filters">
            <input aria-label="Search tickets" placeholder="Search by key or title" value={search} onChange={e => setSearch(e.target.value)} disabled={!demo} />
            <div className="sp-planning-row">
              <select aria-label="Filter by team" value={team} onChange={e => setTeam(e.target.value)} disabled={!demo}><option value="">All teams</option>{DEMO_TEAMS.map(team => <option key={team}>{team}</option>)}</select>
              <select aria-label="Filter by status" value={status} onChange={e => setStatus(e.target.value)} disabled={!demo}><option value="">All work</option>{['Backlog', 'Ready', 'In progress'].map(status => <option key={status}>{status}</option>)}</select>
            </div>
          </div>
          {!demo ? <div className="sp-planning-empty"><h3>Your backlog belongs here</h3><p>Once Jira is connected, browse teams and backlogs, then choose the next ticket to estimate.</p></div>
            : loading ? <p role="status" className="sp-planning-empty">Loading tickets…</p>
            : tickets.length === 0 ? <div className="sp-planning-empty"><h3>No matching tickets</h3><p>Try another team or clear your search.</p><button className="sp-planning-secondary" onClick={() => { setSearch(''); setTeam(''); setStatus(''); }}>Clear filters</button></div>
            : <ul className="sp-ticket-list">{tickets.map(ticket => <li key={ticket.key}><button aria-pressed={preview?.key === ticket.key} onClick={() => setPreview(ticket)}>
              <span className="sp-ticket-meta"><strong>{ticket.key}</strong><span>{ticket.status}</span></span><span className="sp-ticket-list-title">{ticket.title}</span><span className="sp-ticket-team">{ticket.team}</span>
            </button></li>)}</ul>}
        </section>
        <section className="sp-ticket-detail" aria-label="Ticket details">
          {preview ? <>
            <div className="sp-ticket-meta"><strong>{preview.key}</strong><span>{preview.source === 'demo' ? 'Demo ticket' : preview.status}</span></div>
            <h3>{preview.title}</h3><p className="sp-ticket-team">{preview.team} · {preview.status}</p>
            <p className="sp-ticket-description">{preview.description}</p>
            <div className="sp-ticket-select">
              {isCreator ? <><p>{alreadySelected ? 'Everyone is estimating this ticket.' : 'Shows this ticket to everyone and starts a fresh round. Votes and readiness checks will reset.'}</p>
                <button className="sp-planning-primary" disabled={busy || alreadySelected} onClick={() => void select(preview)}>{busy ? 'Starting…' : alreadySelected ? 'At the table' : 'Start estimating'}</button></>
                : <p>The room creator chooses the ticket. Everyone can review it and vote.</p>}
            </div>
          </> : <div className="sp-planning-empty"><h3>Make room for the next discussion</h3><p>Choose a ticket to read its details before bringing it to the table.</p></div>}
          {error && <p role="alert" className="sp-planning-error">{error}</p>}
        </section>
      </div>
      {activeTicket && isCreator && <footer className="sp-ticket-footer"><span>At the table: <strong>{activeTicket.key}</strong></span><button disabled={busy} className="sp-planning-secondary" onClick={() => void select(null)}>Clear ticket and start fresh</button></footer>}
    </PlanningWindow>
  );
}
