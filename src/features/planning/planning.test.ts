import { beforeEach, expect, it } from 'vitest';
import { applyReadinessChange, resetReadiness, validateTicket } from './planning.ts';
import { loadPresets, presetItems, removePreset, savePreset, STARTER_PRESETS } from './presets.ts';
import { demoTicketProvider } from './ticketProvider.ts';

beforeEach(() => localStorage.clear());
it('edits one criterion without losing other changes, validates and leaves rejected snapshots intact', () => {
  let items = applyReadinessChange({}, { operation: 'add', id: 'a', text: '  Clear outcome  ' });
  items = applyReadinessChange(items, { operation: 'add', id: 'b', text: 'Testable' });
  items = applyReadinessChange(items, { operation: 'toggle', id: 'a', checked: true });
  expect(items.a).toEqual({ text: 'Clear outcome', checked: true });
  const edited = applyReadinessChange(items, { operation: 'edit', id: 'b', text: 'Dependencies' });
  expect(edited.a.checked).toBe(true);
  expect(items.b.text).toBe('Testable');
  expect(() => applyReadinessChange(items, { operation: 'add', id: 'a', text: 'Duplicate' })).toThrow('exists');
  expect(() => applyReadinessChange(items, { operation: 'edit', id: 'b', text: ' ' })).toThrow();
  expect(() => applyReadinessChange(items, { operation: 'edit', id: 'missing', text: 'Old edit' })).toThrow('removed');
  expect(resetReadiness(items).a.checked).toBe(false);
  expect(items.a.checked).toBe(true);
  expect(applyReadinessChange(items, { operation: 'remove', id: 'b' })).not.toHaveProperty('b');
});
it('bounds checklist size and prevents field paths in criterion IDs', () => {
  const items = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`c${i}`, { text: 'Ready', checked: false }]));
  expect(() => applyReadinessChange(items, { operation: 'add', id: 'more', text: 'Extra' })).toThrow('12');
  expect(() => applyReadinessChange({}, { operation: 'add', id: 'a.b', text: 'Extra' })).toThrow();
});
it('saves reusable presets without checks, updates named presets and handles old storage', () => {
  const items = presetItems(STARTER_PRESETS[0]);
  Object.values(items)[0].checked = true;
  savePreset('  Our team  ', items);
  expect(loadPresets()[0].name).toBe('Our team');
  expect(Object.values(presetItems(loadPresets()[0])).every(i => !i.checked)).toBe(true);
  savePreset('Our team', { one: { text: 'Updated', checked: true } });
  expect(loadPresets()).toHaveLength(1);
  expect(loadPresets()[0].criteria).toEqual(['Updated']);
  removePreset(loadPresets()[0].id);
  expect(loadPresets()).toEqual([]);
  localStorage.setItem('sp_readiness_presets_v1', '[null,{},42]');
  expect(loadPresets()).toEqual([]);
});
it('filters demo tickets by team, backlog and search together', async () => {
  const tickets = await demoTicketProvider.list({ team: 'Web experience', status: 'Backlog', search: 'filter' });
  expect(tickets.map(t => t.key)).toEqual(['WEB-142']);
  expect(await demoTicketProvider.list({ team: 'Mobile', status: 'Backlog', search: 'nonexistent' })).toEqual([]);
  expect(validateTicket(tickets[0])).toEqual(tickets[0]);
  expect(() => validateTicket({ ...tickets[0], title: 'x'.repeat(201) })).toThrow();
});
