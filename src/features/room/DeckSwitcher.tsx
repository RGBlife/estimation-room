import { useEffect, useRef, useState } from 'react';
import { DECKS, DECK_ORDER } from './decks.ts';
import type { DeckId } from '../../types/room.ts';

interface DeckSwitcherProps {
  currentDeckId: DeckId;
  onSwitch: (deckId: DeckId) => void;
}

// Host-only header pill showing the active deck; opens a dropdown of the
// other decks. Picking one switches immediately (no confirmation step).
export default function DeckSwitcher({ currentDeckId, onSwitch }: DeckSwitcherProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const otherDecks = DECK_ORDER.filter((id) => id !== currentDeckId);

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        // Fixed min-width (sized for the longest deck name, "Powers of 2") so
        // the pill -- and everything after it in the header's flex row --
        // doesn't shift horizontally each time the active deck's label changes.
        className="flex min-w-[168px] cursor-pointer items-center gap-1.5 rounded-md border border-sp-accent-border bg-sp-accent-panel-2 px-2.5 py-2 font-sp-font text-xs font-bold whitespace-nowrap text-sp-accent-text"
      >
        <span className="uppercase tracking-[0.04em] text-sp-accent-text">Deck</span>
        <span className="text-sp-text">{DECKS[currentDeckId].name}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div
          className="sp-vote-card-enter absolute top-[calc(100%+8px)] right-0 z-30 w-[200px] overflow-hidden rounded-lg border border-sp-border-strong bg-sp-panel-2 py-1.5 shadow-[0_12px_28px_rgba(0,0,0,0.4)]"
        >
          {otherDecks.map((id) => (
            <button
              key={id}
              onClick={() => {
                setOpen(false);
                onSwitch(id);
              }}
              className="block w-full cursor-pointer border-none bg-transparent px-3.5 py-2 text-left font-sp-font text-[13px] font-semibold text-sp-text-dim"
            >
              {DECKS[id].name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
