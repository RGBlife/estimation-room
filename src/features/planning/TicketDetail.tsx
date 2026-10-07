import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import type { Participant } from '../../types/room.ts';
import type { Author, BacklogChange, BacklogTicket, EditableField, TicketHighlight } from '../../types/planning.ts';
import { LIMITS, newBacklogId } from './backlog.ts';
import { Face } from './Face.tsx';
import { personColor, timeAgo, useNow } from './people.ts';

type Change = (change: BacklogChange) => Promise<void>;
const FLASH_MS = 1800;
const VERB: Record<EditableField, string> = { key: 'changed the key', title: 'edited the title', description: 'edited the description' };

// Fields someone else changed since the last render, for a moment, so a
// change made across the table is noticed where it happened.
function useFreshFields(ticket: BacklogTicket, uid: string | null) {
  const previous = useRef(ticket);
  const [fresh, setFresh] = useState<{ fields: Set<EditableField>; highlights: Set<string> }>({ fields: new Set(), highlights: new Set() });
  useEffect(() => {
    const before = previous.current;
    previous.current = ticket;
    if (before.id !== ticket.id) return;
    const fields = new Set((['key', 'title', 'description'] as const).filter(f => before[f] !== ticket[f] && ticket.edited?.[f] && ticket.edited[f]!.uid !== uid));
    const known = new Set(before.highlights?.map(h => h.id));
    const highlights = new Set((ticket.highlights ?? []).filter(h => !known.has(h.id) && h.by.uid !== uid).map(h => h.id));
    if (!fields.size && !highlights.size) return;
    setFresh({ fields, highlights });
    const timer = setTimeout(() => setFresh({ fields: new Set(), highlights: new Set() }), FLASH_MS);
    return () => clearTimeout(timer);
  }, [ticket, uid]);
  return fresh;
}

// Characters of the description before a point in it. Faces and popovers
// inside the text are marked data-skip and do not count.
function textOffset(root: HTMLElement, node: Node, at: number): number {
  const before = document.createRange();
  before.selectNodeContents(root);
  before.setEnd(node, at);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: n => (n.parentElement?.closest('[data-skip]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  let count = 0;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n === node) return count + at;
    if (!before.intersectsNode(n)) break;
    count += n.textContent?.length ?? 0;
  }
  return count;
}

const ink = (author: Pick<Author, 'uid'>, participants: Record<string, Participant>) => ({ '--ink': personColor(author.uid, participants) }) as CSSProperties;
// Escape belongs to the field being edited, not the drawer around it.
const keepEscape = (event: KeyboardEvent, cancel: () => void) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel(); } };

function EditedBy({ field, ticket, participants, uid, now, fresh }: { field: EditableField; ticket: BacklogTicket; participants: Record<string, Participant>; uid: string | null; now: number; fresh: boolean }) {
  const by = ticket.edited?.[field];
  if (!by) return null;
  return (
    <span className="sp-edited-by" data-fresh={fresh} style={ink(by, participants)}>
      <Face author={by} participants={participants} size={16} />
      {by.uid === uid ? 'You' : by.name} {VERB[field]} {timeAgo(by.at, now)}
    </span>
  );
}

// Named by its own text so the heading around it keeps its name; the
// title attribute describes what clicking does.
function InlineEdit({ value, label, max, placeholder, onSave, children }: { value: string; label: string; max: number; placeholder?: string; onSave: (value: string) => Promise<void>; children: ReactNode }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState('');
  const save = async () => {
    if (draft === null) return;
    if (draft.trim() === value) { setDraft(null); return; }
    try { await onSave(draft); setDraft(null); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save'); }
  };
  if (draft === null) return <button type="button" className="sp-inline-edit" title={`Edit ${label}`} onClick={() => setDraft(value)}>{children}</button>;
  return (
    <span className="sp-inline-editing">
      <input autoFocus aria-label={label} value={draft} maxLength={max} placeholder={placeholder}
        onChange={event => setDraft(event.target.value)} onBlur={() => void save()}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void save(); } else keepEscape(event, () => { setDraft(null); setError(''); }); }} />
      {error && <span role="alert" className="sp-planning-error">{error}</span>}
    </span>
  );
}

// The description with its highlights. Selecting text offers to highlight it
// for everyone; a highlight says who made it and can be removed.
function Description({ ticket, participants, uid, now, fresh, onChange }: { ticket: BacklogTicket; participants: Record<string, Participant>; uid: string | null; now: number; fresh: Set<string>; onChange: Change }) {
  const text = ticket.description ?? '';
  const box = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  // The open highlight's options, placed under it but kept inside the box.
  const [open, setOpen] = useState<{ id: string; left: number; top: number } | null>(null);
  // Just highlighted by this person: a moment to take it back.
  const [undo, setUndo] = useState<{ id: string; left: number; top: number } | null>(null);
  const [error, setError] = useState('');
  const highlights = ticket.highlights ?? [];
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), 5000);
    return () => clearTimeout(timer);
  }, [undo]);

  // Selecting is highlighting: when a selection inside the description is
  // finished (pointer or keyboard released), it is marked for everyone.
  // Selections touching an existing highlight are left alone, so text can
  // still be selected to copy.
  const commit = async () => {
    const sel = document.getSelection();
    const root = body.current;
    if (!sel || sel.isCollapsed || !root || !sel.rangeCount || !root.contains(sel.anchorNode) || !root.contains(sel.focusNode)) return;
    const range = sel.getRangeAt(0);
    let start = textOffset(root, range.startContainer, range.startOffset);
    let end = textOffset(root, range.endContainer, range.endOffset);
    while (start < end && /\s/.test(text[start])) start++;
    while (end > start && /\s/.test(text[end - 1])) end--;
    if (end - start < 2 || highlights.some(h => start < h.end && end > h.start)) return;
    const rect = range.getBoundingClientRect();
    const frame = box.current!.getBoundingClientRect();
    const id = newBacklogId();
    setError(''); setOpen(null);
    sel.removeAllRanges();
    try {
      await onChange({ operation: 'highlight', id: ticket.id, highlightId: id, start, end });
      setUndo({ id, left: Math.max(0, Math.min(rect.right - frame.left, frame.width - 200)), top: rect.bottom - frame.top + 6 });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not highlight that'); }
  };
  const unhighlight = async (h: TicketHighlight) => {
    setError('');
    try { await onChange({ operation: 'unhighlight', id: ticket.id, highlightId: h.id }); setOpen(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not remove that highlight'); }
  };

  const parts: ReactNode[] = [];
  let at = 0;
  for (const h of highlights) {
    if (h.start > at) parts.push(text.slice(at, h.start));
    const who = h.by.uid === uid ? 'you' : h.by.name;
    const isOpen = open?.id === h.id;
    const toggle = (from: Element) => {
      if (isOpen) { setOpen(null); return; }
      const mark = from.closest('mark')!.getClientRects();
      const last = mark[mark.length - 1];
      const frame = box.current!.getBoundingClientRect();
      setOpen({ id: h.id, left: Math.max(0, Math.min(last.left - frame.left, frame.width - 280)), top: last.bottom - frame.top + 6 });
    };
    // The face at the end is the control: it names who highlighted the
    // passage and opens the option to remove it. Clicking the text works too.
    parts.push(
      <mark key={h.id} className="sp-mark" data-fresh={fresh.has(h.id)} data-open={isOpen} style={ink(h.by, participants)} onClick={event => toggle(event.currentTarget)}>
        {text.slice(h.start, h.end)}
        <button type="button" className="sp-mark-nib" data-skip aria-expanded={isOpen} aria-label={`Highlighted by ${who} ${timeAgo(h.by.at, now)}`}
          onClick={event => { event.stopPropagation(); toggle(event.currentTarget); }} onKeyDown={event => { if (isOpen) keepEscape(event, () => setOpen(null)); }}>
          <Face author={h.by} participants={participants} size={14} />
        </button>
      </mark>,
    );
    at = h.end;
  }
  if (at < text.length) parts.push(text.slice(at));
  const openHighlight = highlights.find(h => h.id === open?.id);

  return (
    <div ref={box} className="sp-description">
      <div ref={body} className="sp-ticket-description" onPointerUp={() => setTimeout(() => void commit())}
        onKeyUp={event => { if (event.key === 'Shift') void commit(); }}>{parts}</div>
      {openHighlight && (
        <div className="sp-mark-pop" role="group" aria-label="Highlight" style={{ left: open!.left, top: open!.top }} onKeyDown={event => keepEscape(event, () => setOpen(null))}>
          <span>Highlighted by {openHighlight.by.uid === uid ? 'you' : openHighlight.by.name} {timeAgo(openHighlight.by.at, now)}</span>
          <button type="button" onClick={() => void unhighlight(openHighlight)}>Remove highlight</button>
        </div>
      )}
      {undo && highlights.some(h => h.id === undo.id) && (
        <div className="sp-mark-pop sp-undo" role="status" style={{ left: undo.left, top: undo.top }}>
          <span>Highlighted for everyone</span>
          <button type="button" onClick={() => { const h = highlights.find(x => x.id === undo.id); setUndo(null); if (h) void unhighlight(h); }}>Undo</button>
        </div>
      )}
      {error && <p role="alert" className="sp-planning-error">{error}</p>}
      {!highlights.length && <p className="sp-planning-hint">Select any passage to highlight it for everyone.</p>}
    </div>
  );
}

function DescriptionEditor({ ticket, onSave, onCancel }: { ticket: BacklogTicket; onSave: (value: string) => Promise<void>; onCancel: () => void }) {
  const [draft, setDraft] = useState(ticket.description ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const area = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => { const node = area.current; if (node) { node.style.height = 'auto'; node.style.height = `${Math.min(node.scrollHeight + 2, 420)}px`; } }, [draft]);
  const save = async () => {
    setBusy(true); setError('');
    try { await onSave(draft); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save'); setBusy(false); }
  };
  return (
    <div className="sp-description-editor">
      <textarea ref={area} autoFocus aria-label="Description" value={draft} maxLength={LIMITS.description}
        onChange={event => setDraft(event.target.value)} onKeyDown={event => keepEscape(event, onCancel)} />
      <div className="sp-planning-row">
        <span className="sp-planning-hint">{ticket.highlights?.length ? 'Highlights stay with their text when it moves.' : `${draft.length.toLocaleString()} / ${LIMITS.description.toLocaleString()}`}</span>
        <button type="button" className="sp-planning-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="button" className="sp-planning-primary" onClick={() => void save()} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
      {error && <p role="alert" className="sp-planning-error">{error}</p>}
    </div>
  );
}

export default function TicketDetail({ ticket, uid, participants, isCreator, isActive, onChange, onSelect }: {
  ticket: BacklogTicket; uid: string | null; participants: Record<string, Participant>;
  isCreator: boolean; isActive: boolean; onChange: Change; onSelect: (id: string | null) => Promise<void>;
}) {
  const now = useNow();
  const fresh = useFreshFields(ticket, uid);
  const [editing, setEditing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setEditing(false); setConfirmRemove(false); setError(''); }, [ticket.id]);
  useEffect(() => {
    if (!confirmRemove) return;
    const timer = setTimeout(() => setConfirmRemove(false), 4000);
    return () => clearTimeout(timer);
  }, [confirmRemove]);
  const edit = (field: EditableField) => (value: string) => onChange({ operation: 'edit', id: ticket.id, field, value });
  const act = async (action: () => Promise<void>, fallback: string) => {
    setBusy(true); setError('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : fallback); }
    setBusy(false);
  };
  const tagProps = { ticket, participants, uid, now };

  return (
    <article className="sp-ticket-view" aria-label={ticket.title}>
      <div className="sp-ticket-meta">
        <span data-fresh={fresh.fields.has('key')} className="sp-fresh-field" style={ticket.edited?.key ? ink(ticket.edited.key, participants) : undefined}>
          <InlineEdit value={ticket.key ?? ''} label="key" max={LIMITS.key} placeholder="WEB-142" onSave={edit('key')}>
            {ticket.key ? <strong>{ticket.key}</strong> : <span className="sp-add-key">Add a key</span>}
          </InlineEdit>
        </span>
        {ticket.estimate && <span className="sp-estimate" title={`Estimated ${timeAgo(ticket.estimate.at, now)}`}>Estimated {ticket.estimate.value}</span>}
      </div>
      <h3 data-fresh={fresh.fields.has('title')} className="sp-fresh-field" style={ticket.edited?.title ? ink(ticket.edited.title, participants) : undefined}>
        <InlineEdit value={ticket.title} label="title" max={LIMITS.title} onSave={edit('title')}>{ticket.title}</InlineEdit>
      </h3>
      {(ticket.edited?.title || ticket.edited?.key) && (
        <p className="sp-edit-trail">
          <EditedBy field="title" {...tagProps} fresh={fresh.fields.has('title')} />
          <EditedBy field="key" {...tagProps} fresh={fresh.fields.has('key')} />
        </p>
      )}
      <div data-fresh={fresh.fields.has('description')} className="sp-fresh-field sp-description-field" style={ticket.edited?.description ? ink(ticket.edited.description, participants) : undefined}>
        {editing ? <DescriptionEditor ticket={ticket} onCancel={() => setEditing(false)} onSave={async value => { await edit('description')(value); setEditing(false); }} />
          : ticket.description ? <Description ticket={ticket} participants={participants} uid={uid} now={now} fresh={fresh.highlights} onChange={onChange} />
          : <p className="sp-ticket-description sp-no-description">No description yet.</p>}
        {!editing && (
          <p className="sp-edit-trail">
            <button type="button" className="sp-link-button" onClick={() => setEditing(true)}>{ticket.description ? 'Edit description' : 'Add a description'}</button>
            <EditedBy field="description" {...tagProps} fresh={fresh.fields.has('description')} />
          </p>
        )}
      </div>
      <p className="sp-ticket-provenance">
        <span style={ink(ticket.added, participants)}><Face author={ticket.added} participants={participants} size={16} />Added by {ticket.added.uid === uid ? 'you' : ticket.added.name} {timeAgo(ticket.added.at, now)}</span>
        {!isActive && (confirmRemove
          ? <button type="button" className="sp-link-button sp-danger" disabled={busy} onClick={() => void act(() => onChange({ operation: 'remove', id: ticket.id }), 'Could not remove this ticket')}>Remove for everyone</button>
          : <button type="button" className="sp-link-button" onClick={() => setConfirmRemove(true)}>Remove</button>)}
      </p>
      {/* One compact row: what this ticket is to the table, and the action. */}
      <div className="sp-ticket-select" data-active={isActive}>
        {isActive ? <>
          <span className="sp-live-dot">At the table</span>
          {isCreator && <button type="button" className="sp-link-button" disabled={busy} onClick={() => void act(() => onSelect(null), 'Could not clear the table')}>Clear the table</button>}
        </> : isCreator ? <>
          <button className="sp-planning-primary" disabled={busy} onClick={() => void act(() => onSelect(ticket.id), 'Could not select this ticket')}>{ticket.estimate ? 'Estimate again' : 'Start estimating'}</button>
          <span>Resets votes and readiness for everyone.</span>
        </> : <span>The room creator brings tickets to the table.</span>}
      </div>
      {error && <p role="alert" className="sp-planning-error">{error}</p>}
    </article>
  );
}
