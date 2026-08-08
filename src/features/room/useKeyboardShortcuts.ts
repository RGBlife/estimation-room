import { useEffect } from 'react';
import type { CardValue } from '../../types/room.ts';

interface UseKeyboardShortcutsArgs {
  isRevealed: boolean;
  allVoted: boolean;
  anyVote: boolean;
  isObserver: boolean;
  // Active deck's card values in display order, or null for a deck with no
  // fixed cards (Custom) — digit-key vote casting is disabled in that case.
  deckValues: CardValue[] | null;
  onReveal: () => void;
  onStartNextRound: () => void;
  onCastVote: (value: CardValue) => void;
}

// Enter triggers whichever of the two round-progression actions is
// currently available, and the number row casts a vote by position (1 is
// the 1st card, 2 the 2nd, ... 0 the 10th) — keyed off deckValues' order
// rather than its contents, so this keeps working across any deck's card
// set. Both ignored while typing (story title input, Custom vote input) so
// they don't hijack normal text entry.
export function useKeyboardShortcuts({
  isRevealed, allVoted, anyVote, isObserver, deckValues, onReveal, onStartNextRound, onCastVote,
}: UseKeyboardShortcutsArgs): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (e.key === 'Enter') {
        if (!isRevealed && allVoted && anyVote) {
          e.preventDefault();
          onReveal();
        } else if (isRevealed) {
          e.preventDefault();
          onStartNextRound();
        }
        return;
      }
      if (!isRevealed && !isObserver && deckValues && /^[0-9]$/.test(e.key)) {
        const cardIdx = (Number(e.key) + 9) % 10; // '1'->0, '2'->1, ..., '9'->8, '0'->9
        const value = deckValues[cardIdx];
        if (value != null) {
          e.preventDefault();
          onCastVote(value);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isRevealed, allVoted, anyVote, isObserver, deckValues, onReveal, onStartNextRound, onCastVote]);
}
