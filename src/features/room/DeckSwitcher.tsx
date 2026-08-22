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
        // This control only renders for the room's creator, so it is also
        // the one place they learn the deck is theirs to change -- the pill
        // alone reads as a label rather than a control. The title carries
        // that on hover; the aria-label makes it explicit to a screen reader,
        // which previously got only "Deck Fibonacci".
        title="You're the host — change the estimation deck for everyone"
        aria-label={`Estimation deck: ${DECKS[currentDeckId].name}. Change the deck for everyone`}
        aria-expanded={open}
        aria-haspopup="menu"
        // Sizes to content rather than a fixed min-width: a fixed width sized
        // for the longest deck name ("Powers of 2") left visibly uneven
        // padding after the chevron for short names like "ROM"/"Custom",
        // since equal padding on both sides of a variable-width label still
        // reads as more trailing whitespace once you account for the
        // chevron glyph's own visual weight sitting toward the top of its
        // box. The header row reflowing slightly when the host deliberately
        // switches decks (not on every render) is an acceptable trade-off
        // for correct spacing at every label length.
        // min-h rather than more padding, so the desktop pill keeps its exact
        // proportions while a phone still gets a 44px target. The 560px edge
        // matches RoomHeader's own narrow breakpoint.
        className="flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-md border border-sp-accent-border bg-sp-accent-panel-2 px-2.5 py-2 font-sp-font text-xs font-bold whitespace-nowrap text-sp-accent-text min-[560px]:min-h-0"
      >
        <span className="uppercase tracking-[0.04em] text-sp-accent-text">Deck</span>
        <span className="text-sp-text">{DECKS[currentDeckId].name}</span>
        {/* Tighter viewBox cropped to the chevron's actual ink (y 7-17 of the
            original 24-tall box, with a touch of margin) plus a small
            negative right margin -- the glyph's visible stroke sits in the
            upper-middle of its nominal box, so a viewBox with the same
            padding as the label text still reads as extra trailing
            whitespace next to it. */}
        <svg width="12" height="12" viewBox="2 7 20 10" fill="none" stroke="currentColor" strokeWidth={2.5} className="-mr-0.5">
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
