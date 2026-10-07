import type { Author, BacklogChange, BacklogTicket, EditableField, TicketDraft, TicketHighlight } from '../../types/planning.ts';

// Mirrors the room service's Backlog.cs and firestore.rules. The service is
// the authority there; on Firebase these run in the writer's transaction and
// the rules re-check the shape.
export const MAX_TICKETS = 50;
export const MAX_ADD_BATCH = 25;
export const MAX_HIGHLIGHTS = 12;
export const LIMITS = { key: 40, title: 200, description: 2000, status: 40 } as const;

const ID = /^[a-zA-Z0-9_-]{1,48}$/;
// Control characters and the bidirectional overrides that can make shared
// text display differently from what it says. Tabs and newlines stay.
// eslint-disable-next-line no-control-regex
const UNSAFE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

export const newBacklogId = () => `t${Date.now().toString(36)}${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;

export function cleanText(value: unknown, max: number, multiline: boolean): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new Error('Tickets are plain text');
  let text = value.replace(/\r\n?/g, '\n').replace(UNSAFE, '');
  text = multiline ? text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() : text.replace(/\s+/g, ' ').trim();
  if (text.length > max) throw new Error(`Keep this under ${max.toLocaleString()} characters`);
  return text;
}

export function cleanDraft(draft: TicketDraft): TicketDraft {
  const title = cleanText(draft.title, LIMITS.title, false);
  if (!title) throw new Error('Every ticket needs a title');
  const key = cleanText(draft.key, LIMITS.key, false);
  const description = cleanText(draft.description, LIMITS.description, true);
  const status = cleanText(draft.status, LIMITS.status, false);
  return { title, ...(key ? { key } : {}), ...(description ? { description } : {}), ...(status ? { status } : {}) };
}

const checkId = (id: string, what = 'ticket') => { if (typeof id !== 'string' || !ID.test(id)) throw new Error(`Invalid ${what}`); };

export function createTickets(existing: BacklogTicket[], drafts: Array<TicketDraft & { id: string }>, author: Author): BacklogTicket[] {
  if (drafts.length === 0 || drafts.length > MAX_ADD_BATCH) throw new Error(`Add up to ${MAX_ADD_BATCH} tickets at a time`);
  if (existing.length + drafts.length > MAX_TICKETS) throw new Error(`A room holds up to ${MAX_TICKETS} tickets. Remove some to add more.`);
  const taken = new Set(existing.map(t => t.id));
  let position = existing.reduce((max, t) => Math.max(max, t.position), 0);
  return drafts.map(draft => {
    checkId(draft.id);
    if (taken.has(draft.id)) throw new Error('This ticket already exists');
    taken.add(draft.id);
    return { id: draft.id, ...cleanDraft(draft), position: ++position, added: author };
  });
}

// Highlights follow the text they marked: after an edit each is moved to the
// occurrence of its passage nearest where it was, and dropped if the passage
// is gone. Overlaps a move creates are dropped too, keeping the earlier mark.
export function relocateHighlights(before: string, after: string, highlights: TicketHighlight[] = []): TicketHighlight[] {
  const moved: TicketHighlight[] = [];
  for (const h of highlights) {
    const quote = before.slice(h.start, h.end);
    if (!quote) continue;
    let best = -1;
    for (let at = after.indexOf(quote); at !== -1; at = after.indexOf(quote, at + 1)) {
      if (best === -1 || Math.abs(at - h.start) < Math.abs(best - h.start)) best = at;
    }
    if (best !== -1) moved.push({ ...h, start: best, end: best + quote.length });
  }
  moved.sort((a, b) => a.start - b.start);
  return moved.filter((h, i) => i === 0 || h.start >= moved[i - 1].end);
}

export function editTicket(ticket: BacklogTicket, field: EditableField, value: string, author: Author): BacklogTicket {
  if (!['key', 'title', 'description'].includes(field)) throw new Error('This field cannot be edited');
  const text = cleanText(value, LIMITS[field], field === 'description');
  if (field === 'title' && !text) throw new Error('Every ticket needs a title');
  if ((ticket[field] ?? '') === text) return ticket;
  const next: BacklogTicket = { ...ticket, edited: { ...ticket.edited, [field]: author } };
  if (text) next[field] = text; else delete (next as Partial<BacklogTicket>)[field];
  if (field === 'description') {
    const highlights = relocateHighlights(ticket.description ?? '', text, ticket.highlights);
    if (highlights.length) next.highlights = highlights; else delete next.highlights;
  }
  return next;
}

export function addHighlight(ticket: BacklogTicket, highlightId: string, start: number, end: number, author: Author): BacklogTicket {
  checkId(highlightId, 'highlight');
  const length = ticket.description?.length ?? 0;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > length) throw new Error('Select some of the description to highlight');
  const current = ticket.highlights ?? [];
  if (current.length >= MAX_HIGHLIGHTS) throw new Error(`A ticket holds up to ${MAX_HIGHLIGHTS} highlights`);
  if (current.some(h => h.id === highlightId)) throw new Error('This highlight already exists');
  if (current.some(h => start < h.end && end > h.start)) throw new Error('Part of that is already highlighted');
  return { ...ticket, highlights: [...current, { id: highlightId, start, end, by: author }].sort((a, b) => a.start - b.start) };
}

export function removeHighlight(ticket: BacklogTicket, highlightId: string): BacklogTicket {
  const highlights = (ticket.highlights ?? []).filter(h => h.id !== highlightId);
  if (highlights.length === (ticket.highlights ?? []).length) throw new Error('This highlight was already removed');
  const next: BacklogTicket = { ...ticket, highlights };
  if (!highlights.length) delete next.highlights;
  return next;
}

// The whole change against a snapshot, for in-memory backends and checks.
export function applyBacklogChange(current: BacklogTicket[], change: BacklogChange, author: Author, activeTicketId?: string): BacklogTicket[] {
  if (change.operation === 'clear') return [];
  if (change.operation === 'add') return [...current, ...createTickets(current, change.tickets, author)];
  const ticket = current.find(t => t.id === change.id);
  if (!ticket) throw new Error('This ticket was removed. Try again.');
  if (change.operation === 'remove') {
    if (change.id === activeTicketId) throw new Error('This ticket is at the table. Clear it first.');
    return current.filter(t => t.id !== change.id);
  }
  const next = change.operation === 'edit' ? editTicket(ticket, change.field, change.value, author)
    : change.operation === 'highlight' ? addHighlight(ticket, change.highlightId, change.start, change.end, author)
    : removeHighlight(ticket, change.highlightId);
  return current.map(t => t.id === change.id ? next : t);
}

// What the table agreed: the most common vote, ignoring "?" and coffee when
// anyone gave a real estimate. A tie keeps every tied value, in deck order of
// first appearance. Mirrors Backlog.Consensus in the room service.
const UNSURE = ['?', '\u2615'];
export function consensus(votes: Array<string | null | undefined>): string | null {
  const cast = votes.filter((v): v is string => !!v && v !== 'voted');
  const real = cast.filter(v => !UNSURE.includes(v));
  const pool = real.length ? real : cast;
  if (!pool.length) return null;
  const counts = new Map<string, number>();
  for (const v of pool) counts.set(v, (counts.get(v) ?? 0) + 1);
  const top = Math.max(...counts.values());
  const value = [...counts].filter(([, n]) => n === top).map(([v]) => v).join(' / ');
  return value.length > 40 ? `${value.slice(0, 39)}…` : value;
}

export const sortBacklog = (tickets: Iterable<BacklogTicket>) => [...tickets].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));

// Splits an import into commands the room service accepts: it reads at most
// 8 KiB per message, so batches stay well under that as UTF-8 JSON.
const BATCH_BYTES = 6500;
export function batchDrafts<T extends TicketDraft>(drafts: T[]): T[][] {
  const encoder = new TextEncoder();
  const batches: T[][] = [];
  let batch: T[] = [];
  let bytes = 0;
  for (const draft of drafts) {
    const size = encoder.encode(JSON.stringify(draft)).length + 1;
    if (batch.length && (batch.length === MAX_ADD_BATCH || bytes + size > BATCH_BYTES)) { batches.push(batch); batch = []; bytes = 0; }
    batch.push(draft); bytes += size;
  }
  if (batch.length) batches.push(batch);
  return batches;
}
