import { describe, it, expect } from 'vitest';
import { DECKS, DECK_ORDER, DEFAULT_DECK } from './decks.ts';

describe('decks registry', () => {
  it('has a unique, matching id for every deck keyed by that id', () => {
    for (const [key, deck] of Object.entries(DECKS)) {
      expect(deck.id).toBe(key);
    }
  });

  it('has unique names across all decks', () => {
    const names = Object.values(DECKS).map((d) => d.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('DEFAULT_DECK exists in DECKS', () => {
    expect(DECKS[DEFAULT_DECK]).toBeDefined();
  });

  it('DECK_ORDER lists every selectable deck in DECKS exactly once', () => {
    // Custom is deliberately excluded from DECK_ORDER (hidden from deck
    // pickers) while its DECKS entry stays fully defined -- see decks.ts.
    const selectableIds = Object.keys(DECKS).filter((id) => id !== 'custom');
    expect(new Set(DECK_ORDER)).toEqual(new Set(selectableIds));
    expect(DECK_ORDER.length).toBe(selectableIds.length);
  });

  it('Custom stays defined in DECKS even though it is hidden from DECK_ORDER', () => {
    expect(DECKS.custom).toBeDefined();
    expect(DECK_ORDER).not.toContain('custom');
  });

  it('ROM flagValue matches one of its own values', () => {
    const rom = DECKS.rom;
    expect(rom.flagValue).toBeDefined();
    expect(rom.values?.some((v) => v.value === rom.flagValue)).toBe(true);
  });

  it('Custom has no fixed values and a freeText result kind', () => {
    expect(DECKS.custom.values).toBeNull();
    expect(DECKS.custom.resultKind).toBe('freeText');
  });

  it('every non-Custom deck has at least one value and a non-freeText result kind', () => {
    for (const deck of Object.values(DECKS)) {
      if (deck.id === 'custom') continue;
      expect(deck.values && deck.values.length).toBeGreaterThan(0);
      expect(deck.resultKind).not.toBe('freeText');
    }
  });
});
