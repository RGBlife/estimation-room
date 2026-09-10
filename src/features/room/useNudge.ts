import { useEffect, useRef, useState } from 'react';
import type { ThrowEvent } from '../../types/throws.ts';
import type { Participant } from '../../types/room.ts';

// A brief reminder, with a recipient-wide cooldown so several teammates
// cannot stack screen shakes. Reduced motion gets the text reminder only.
export function useNudge(events: ThrowEvent[], uid: string | null, participants: Record<string, Participant>, isRevealed: boolean) {
  const [message, setMessage] = useState<string | null>(null);
  const seen = useRef(new Set<string>());
  const lastNudge = useRef(-Infinity);
  const animation = useRef<Animation | null>(null);
  useEffect(() => {
    const activeIds = new Set(events.map(event => event.id));
    for (const id of seen.current) if (!activeIds.has(id)) seen.current.delete(id);
    for (const event of events) {
      if (event.weaponId !== 'nudge' || seen.current.has(event.id)) continue;
      seen.current.add(event.id);
      const me = uid ? participants[uid] : null;
      if (!me || event.toUid !== uid || me.isObserver || me.vote != null || isRevealed) continue;
      if (performance.now() - lastNudge.current < 10000) continue;
      lastNudge.current = performance.now();
      setMessage(`${participants[event.fromUid]?.name ?? 'A teammate'} nudged you — your vote is still needed.`);
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        animation.current?.cancel();
        animation.current = document.querySelector('.sp-app')?.animate?.([
          { translate: '0px 0px' }, { translate: '-5px 0px' },
          { translate: '5px 0px' }, { translate: '-3px 0px' }, { translate: '0px 0px' },
        ], { duration: 350, easing: 'ease-out' }) ?? null;
      }
    }
  }, [events, uid, participants, isRevealed]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [message]);
  useEffect(() => () => animation.current?.cancel(), []);
  return message;
}
