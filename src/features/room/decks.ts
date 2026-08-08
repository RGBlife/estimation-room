import type { DeckId } from '../../types/room.ts';

// One entry per selectable card/pill in a deck. Plain numeric/text decks use
// only `value`; ROM's two non-square pills set `wide`/`warn`; Custom has no
// DeckCardSpec entries at all (see DeckDefinition.values below).
export interface DeckCardSpec {
  value: string;
  wide?: boolean;
  warn?: boolean;
}

// Drives which results-view treatment a deck gets:
//   'average'  — bars + numeric average (Fibonacci, Powers of 2)
//   'mode'     — bars + most-picked-value summary (T-shirt, ROM)
//   'freeText' — grouped list, no bars (Custom)
export type DeckResultKind = 'average' | 'mode' | 'freeText';

export interface DeckDefinition {
  id: DeckId;
  name: string;
  values: DeckCardSpec[] | null; // null => no fixed cards (Custom / free text)
  resultKind: DeckResultKind;
  flagValue?: string; // value that drives the "N of M flagged ..." warning row (ROM only)
}

export const DECKS: Record<DeckId, DeckDefinition> = {
  fibonacci: {
    id: 'fibonacci',
    name: 'Fibonacci',
    values: ['0', '1', '2', '3', '5', '8', '13', '21', '?', '☕'].map((value) => ({ value })),
    resultKind: 'average',
  },
  powersOf2: {
    id: 'powersOf2',
    name: 'Powers of 2',
    values: ['0', '1', '2', '4', '8', '16', '32', '?', '☕'].map((value) => ({ value })),
    resultKind: 'average',
  },
  tshirt: {
    id: 'tshirt',
    name: 'T-shirt',
    values: ['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((value) => ({ value })),
    resultKind: 'mode',
  },
  rom: {
    id: 'rom',
    name: 'ROM',
    values: [
      { value: 'Needs breaking down', wide: true, warn: true },
      { value: '1' },
      { value: '2' },
      { value: '3' },
      { value: '5' },
      { value: '8+ sprints', wide: true, warn: true },
      { value: '?' },
    ],
    resultKind: 'mode',
    flagValue: 'Needs breaking down',
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    values: null,
    resultKind: 'freeText',
  },
};

export const DECK_ORDER: DeckId[] = ['fibonacci', 'tshirt', 'powersOf2', 'rom', 'custom'];
export const DEFAULT_DECK: DeckId = 'fibonacci';
