import { useEffect } from 'react';
import { CARD_VALUES } from '../avatar/index.js';
import type { CardValue } from '../../types/room.ts';

interface UseKeyboardShortcutsArgs {
  isRevealed: boolean;
  allVoted: boolean;
  anyVote: boolean;
  isObserver: boolean;
  onReveal: () => void;
  onStartNextRound: () => void;
  onCastVote: (value: CardValue) => void;
}

// Enter triggers whichever of the two round-progression actions is
// currently available, and the number row casts a vote by position (1 is
// the 1st card, 2 the 2nd, ... 0 the 10th) — keyed off CARD_VALUES' order
// rather than its contents, so this keeps working if the cards ever become
// customizable and stop being plain 0/1/2/3/5/8/13/21/?/☕. Both ignored
// while typing (story title input) so they don't hijack normal text entry.
export function useKeyboardShortcuts({
  isRevealed, allVoted, anyVote, isObserver, onReveal, onStartNextRound, onCastVote,
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
      if (!isRevealed && !isObserver && /^[0-9]$/.test(e.key)) {
        const cardIdx = (Number(e.key) + 9) % 10; // '1'->0, '2'->1, ..., '9'->8, '0'->9
        const value = CARD_VALUES[cardIdx];
        if (value != null) {
          e.preventDefault();
          onCastVote(value);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isRevealed, allVoted, anyVote, isObserver, onReveal, onStartNextRound, onCastVote]);
}
