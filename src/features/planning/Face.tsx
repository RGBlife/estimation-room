import type { CSSProperties } from 'react';
import type { Participant } from '../../types/room.ts';
import type { Author } from '../../types/planning.ts';
import { participantAvatarSrc } from '../avatar/index.ts';
import { personColor } from './people.ts';

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();

// The person's avatar while they are in the room, their initials after.
export function Face({ author, participants, size = 18 }: { author: Pick<Author, 'uid' | 'name'>; participants: Record<string, Participant>; size?: number }) {
  const participant = participants[author.uid];
  const src = participant ? participantAvatarSrc(participant) : undefined;
  return (
    <span className="sp-face" aria-hidden="true" style={{ width: size, height: size, '--face': personColor(author.uid, participants) } as CSSProperties}>
      {src ? <img src={src} alt="" /> : <span style={{ fontSize: Math.round(size * .45) }}>{initials(author.name)}</span>}
    </span>
  );
}

