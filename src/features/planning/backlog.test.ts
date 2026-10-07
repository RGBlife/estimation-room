import { expect, it } from 'vitest';
import type { BacklogTicket } from '../../types/planning.ts';
import { addHighlight, applyBacklogChange, cleanText, consensus, createTickets, editTicket, MAX_TICKETS, relocateHighlights, removeHighlight } from './backlog.ts';

const ada = { uid: 'u1', name: 'Ada', at: 1 };
const bo = { uid: 'u2', name: 'Bo', at: 2 };
const base = (): BacklogTicket[] => createTickets([], [{ id: 'a', key: ' WEB-1 ', title: ' Keep\n filters ', description: 'Restore the search.\r\n\r\n\r\nKeep scroll.' }], ada);

it('adds clean tickets in order and bounds the backlog', () => {
  const [ticket] = base();
  expect(ticket).toEqual({ id: 'a', key: 'WEB-1', title: 'Keep filters', description: 'Restore the search.\n\nKeep scroll.', position: 1, added: ada });
  const more = applyBacklogChange([ticket], { operation: 'add', tickets: [{ id: 'b', title: 'Second' }] }, bo);
  expect(more.map(t => [t.id, t.position])).toEqual([['a', 1], ['b', 2]]);
  expect(() => createTickets(more, [{ id: 'a', title: 'Again' }], ada)).toThrow('exists');
  expect(() => createTickets([], [{ id: 'bad id', title: 'X' }], ada)).toThrow('Invalid');
  expect(() => createTickets([], [{ id: 'c', title: '  ' }], ada)).toThrow('title');
  const full = Array.from({ length: MAX_TICKETS }, (_, i) => ({ ...ticket, id: `f${i}` }));
  expect(() => createTickets(full, [{ id: 'z', title: 'One too many' }], ada)).toThrow('up to 50');
});

it('strips control and bidirectional override characters', () => {
  expect(cleanText('Pay\u202Eexe.txt\u0007', 100, false)).toBe('Payexe.txt');
  expect(() => cleanText({}, 10, false)).toThrow('plain text');
});

it('attributes each edited field to whoever changed it last', () => {
  let [ticket] = base();
  ticket = editTicket(ticket, 'title', 'Keep search filters', bo);
  ticket = editTicket(ticket, 'key', '', ada);
  expect(ticket.title).toBe('Keep search filters');
  expect(ticket).not.toHaveProperty('key');
  expect(ticket.edited).toEqual({ title: bo, key: ada });
  expect(editTicket(ticket, 'title', ' Keep search filters ', ada)).toBe(ticket);
  expect(() => editTicket(ticket, 'title', '', ada)).toThrow('title');
});

it('highlights passages without overlap and moves them with edits', () => {
  let [ticket] = base();
  ticket = addHighlight(ticket, 'h1', 0, 7, ada);
  ticket = addHighlight(ticket, 'h2', 21, 33, bo);
  expect(() => addHighlight(ticket, 'h3', 5, 10, bo)).toThrow('already highlighted');
  expect(() => addHighlight(ticket, 'h3', 30, 99, bo)).toThrow('Select');
  ticket = editTicket(ticket, 'description', 'Context first. Restore the search.\n\nScroll is fine.', bo);
  expect(ticket.highlights).toEqual([{ id: 'h1', start: 15, end: 22, by: ada }]);
  expect(ticket.description!.slice(15, 22)).toBe('Restore');
  ticket = removeHighlight(ticket, 'h1');
  expect(ticket).not.toHaveProperty('highlights');
  expect(() => removeHighlight(ticket, 'h1')).toThrow('removed');
});

it('relocates to the nearest occurrence and drops overlaps a move creates', () => {
  const hs = [{ id: 'x', start: 3, end: 6, by: ada }, { id: 'y', start: 7, end: 10, by: bo }];
  expect(relocateHighlights('xx abc cde', 'abcde', hs).map(h => [h.id, h.start])).toEqual([['x', 0]]);
  expect(relocateHighlights('one two one', 'one two one one', [{ id: 'z', start: 8, end: 11, by: ada }])[0].start).toBe(8);
});

it('protects the ticket at the table from removal', () => {
  const tickets = base();
  expect(() => applyBacklogChange(tickets, { operation: 'remove', id: 'a' }, ada, 'a')).toThrow('at the table');
  expect(applyBacklogChange(tickets, { operation: 'remove', id: 'a' }, ada)).toEqual([]);
  expect(() => applyBacklogChange([], { operation: 'edit', id: 'a', field: 'title', value: 'x' }, ada)).toThrow('removed');
});

it('takes the most common vote as the estimate, keeping ties and ignoring unsure votes', () => {
  expect(consensus(['5', '8', '5', null])).toBe('5');
  expect(consensus(['3', '5', '3', '5', '?', '?', '?'])).toBe('3 / 5');
  expect(consensus(['?', '\u2615', '?'])).toBe('?');
  expect(consensus(['voted', null])).toBeNull();
});
