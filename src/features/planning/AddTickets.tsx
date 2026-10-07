import { useId, useMemo, useRef, useState, type DragEvent } from 'react';
import type { BacklogTicket, TicketDraft } from '../../types/planning.ts';
import { MAX_TICKETS, newBacklogId } from './backlog.ts';
import { parseTickets, readTicketFile, type ImportResult } from './ticketImport.ts';
import { DEMO_DRAFTS } from './ticketProvider.ts';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const SOURCE = { jira: 'from a Jira export', table: 'from a table', list: 'from your list' } as const;

// Paste, drop or choose a file; review what was read; add it for everyone.
// Nothing leaves the browser before "Add", and then only the kept fields.
export default function AddTickets({ existing, onAdd, onManual, onCancel }: {
  existing: BacklogTicket[];
  onAdd: (drafts: Array<TicketDraft & { id: string }>) => Promise<void>;
  onManual: () => void;
  // Absent while the backlog is empty: the drop zone is the empty state.
  onCancel?: () => void;
}) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const review = (parsed: ImportResult) => {
    if (!parsed.tickets.length) { setError('No tickets found. Put one ticket on each line, or use a CSV with a Summary or Title column.'); return; }
    setError(''); setResult(parsed);
  };
  const readFile = async (chosen: File) => {
    try { review(await readTicketFile(chosen)); } catch (e) { setError(e instanceof Error ? e.message : 'Could not read that file'); }
  };
  const drop = (event: DragEvent) => {
    event.preventDefault(); setDragging(false);
    const dropped = event.dataTransfer.files[0];
    if (dropped) void readFile(dropped);
    else { const pasted = event.dataTransfer.getData('text/plain'); if (pasted) review(parseTickets(pasted)); }
  };
  const reset = () => { setResult(null); setText(''); setError(''); };

  if (result) return <div className="sp-add-tickets"><ImportReview result={result} existing={existing} onBack={reset}
    onAdd={async drafts => { await onAdd(drafts); reset(); onCancel?.(); }} /></div>;

  const found = text.trim() ? parseTickets(text).tickets.length : 0;
  return (
    <div className="sp-add-tickets">
      <div className="sp-dropzone" data-dragging={dragging}
        onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}>
        <label htmlFor={inputId}>{dragging ? 'Drop to read it here' : 'Paste tickets or drop a CSV'}</label>
        {/* Part of the box it explains, and closed until asked for. */}
        <details className="sp-import-help">
          <summary>From Jira? See how to export</summary>
          <ol>
            <li>Open your board's backlog, or search for the issues you want to estimate.</li>
            <li>Choose <strong>Export</strong>, then <strong>Export CSV (current fields)</strong>.</li>
            <li>Drop the file in this box, or choose it below.</li>
          </ol>
          <p>Only the key, summary and description are read. Assignees, reporters and every other column stay on this device.</p>
          {import.meta.env.DEV && <button type="button" className="sp-link-button" onClick={() => review({ source: 'list', tickets: DEMO_DRAFTS.map(draft => ({ draft, trimmed: false })), kept: [], dropped: [], masked: { emails: 0, phones: 0, mentions: 0 }, skipped: 0 })}>Use sample tickets</button>}
        </details>
        <textarea id={inputId} rows={4} value={text} spellCheck={false}
          placeholder={'WEB-142 Keep filters when returning\nWEB-148 Keyboard navigation in the menu'}
          onChange={event => { setText(event.target.value); setError(''); }}
          onPaste={event => {
            const pasted = event.clipboardData.getData('text/plain');
            // A multi-line paste is a list or a table: straight to review.
            if (/\n/.test(pasted.trim())) { event.preventDefault(); review(parseTickets(pasted)); }
          }} />
        <div className="sp-dropzone-actions">
          <span className="sp-planning-hint">One ticket per line. Descriptions come with a CSV, or add them after.</span>
          <button type="button" className="sp-planning-secondary" onClick={() => file.current?.click()}>Choose file</button>
          <input ref={file} type="file" hidden accept=".csv,.tsv,.txt,text/csv,text/plain,text/tab-separated-values"
            onChange={event => { const chosen = event.target.files?.[0]; event.target.value = ''; if (chosen) void readFile(chosen); }} />
          {found > 0 && <button type="button" className="sp-planning-primary" onClick={() => review(parseTickets(text))}>Review {plural(found, 'ticket')}</button>}
        </div>
      </div>
      {error && <p role="alert" className="sp-planning-error">{error}</p>}
      <div className="sp-add-links">
        <button type="button" onClick={onManual}>Add one by hand</button>
        {onCancel && <button type="button" onClick={onCancel}>Cancel</button>}
      </div>
    </div>
  );
}

function ImportReview({ result, existing, onAdd, onBack }: {
  result: ImportResult; existing: BacklogTicket[];
  onAdd: (drafts: Array<TicketDraft & { id: string }>) => Promise<void>; onBack: () => void;
}) {
  const keys = useMemo(() => new Set(existing.map(t => t.key?.toLowerCase()).filter(Boolean)), [existing]);
  const duplicate = (i: number) => !!result.tickets[i].draft.key && keys.has(result.tickets[i].draft.key!.toLowerCase());
  const room = Math.max(0, MAX_TICKETS - existing.length);
  const [selected, setSelected] = useState(() => {
    const picked = new Set<number>();
    result.tickets.forEach((_, i) => { if (!duplicate(i) && picked.size < room) picked.add(i); });
    return picked;
  });
  const [originals, setOriginals] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { emails, phones, mentions } = result.masked;
  const masked = [emails && plural(emails, 'email address', 'email addresses'), phones && plural(phones, 'phone number'), mentions && plural(mentions, 'mention')].filter(Boolean);
  const trimmed = result.tickets.filter(t => t.trimmed).length;
  const duplicates = result.tickets.filter((_, i) => duplicate(i)).length;
  const over = result.tickets.length - duplicates > room;
  // Name the columns about people first: they are the reassuring ones.
  const people = /assignee|reporter|creator|watcher|comment|email|user|owner|author/i;
  const named = [...result.dropped].sort((a, b) => Number(people.test(b)) - Number(people.test(a)));
  const dropped = named.length > 2 ? `${named.slice(0, 2).join(', ')} and ${plural(named.length - 2, 'other column')}` : named.join(' and ');

  const add = async () => {
    setBusy(true); setError('');
    try {
      await onAdd([...selected].sort((a, b) => a - b).map(i => {
        const { draft, unmasked } = result.tickets[i];
        return { ...draft, ...(originals && unmasked ? { description: unmasked } : {}), id: newBacklogId() };
      }));
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not add these tickets'); setBusy(false); }
  };
  const toggle = (i: number) => setSelected(current => {
    const next = new Set(current);
    if (next.has(i)) next.delete(i); else next.add(i);
    return next;
  });

  return (
    <section className="sp-import-review" aria-label="Review tickets">
      <header>
        <h3>{plural(result.tickets.length, 'ticket')} {SOURCE[result.source]}</h3>
        <button type="button" className="sp-link-button" onClick={onBack}>Start over</button>
      </header>
      {/* Only what needs saying: each line appears when it applies. */}
      <ul className="sp-import-notes">
        {dropped && <li>Read key, title and description only. {dropped} stay on this device.</li>}
        {masked.length > 0 && <li>
          {originals ? `Keeping ${masked.join(', ')} as written.` : `Masked ${masked.join(', ')} in descriptions.`}{' '}
          <button type="button" className="sp-link-button" onClick={() => setOriginals(o => !o)}>{originals ? 'Mask them' : 'Keep originals'}</button>
        </li>}
        {trimmed > 0 && <li>{plural(trimmed, 'description')} trimmed to 2,000 characters.</li>}
        {over && <li>A room holds {MAX_TICKETS} tickets, so only the first {room} are ticked.</li>}
      </ul>
      <ul className="sp-import-list">
        {result.tickets.map(({ draft }, i) => (
          <li key={i}>
            <label data-disabled={duplicate(i)}>
              <input type="checkbox" checked={selected.has(i)} disabled={duplicate(i) || busy} onChange={() => toggle(i)} />
              <span className="sp-import-row">
                <span>{draft.key && <strong>{draft.key}</strong>}{draft.title}</span>
                {draft.description && <small>{draft.description.split('\n')[0]}</small>}
              </span>
              {duplicate(i) && <small>In backlog</small>}
            </label>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="sp-planning-error">{error}</p>}
      <footer>
        <p>Everyone in this room will see them until they're removed or the room expires.</p>
        <button type="button" className="sp-planning-primary" disabled={busy || selected.size === 0} onClick={() => void add()}>
          {busy ? 'Adding…' : `Add ${plural(selected.size, 'ticket')}`}
        </button>
      </footer>
    </section>
  );
}
