import { participantAvatarSrc } from '../avatar/index.js';
import type { Participant } from '../../types/room.ts';

interface ObserverRailProps {
  observers: [string, Participant][];
  uid: string | null;
  canTarget?: boolean;
  onThrowAt: (id: string, e?: React.MouseEvent) => void;
  registerSeatNode?: (id: string, node: HTMLElement | null) => void;
  horizontal?: boolean;
}

// Each observer sits on a small CSS-drawn chair: back, two legs, seat, avatar
// on top, and a "gaze" triangle pointing toward the table. Vertical rail on the
// right of the table by default; `horizontal` renders it as a wrapping strip
// instead, for narrow viewports where a side rail would starve the seats.
export default function ObserverRail({
  observers,
  uid,
  canTarget = false,
  onThrowAt,
  registerSeatNode = () => {},
  horizontal = false,
}: ObserverRailProps) {
  if (observers.length === 0) return null;

  const containerClass = horizontal
    ? 'flex w-full flex-row flex-wrap items-start justify-center gap-2.5 border-t border-sp-border bg-sp-panel px-2.5 py-3.5'
    : 'flex w-[150px] shrink-0 flex-col items-center gap-2.5 overflow-y-auto border-l border-sp-border bg-sp-panel px-2.5 py-4.5';

  return (
    <div className={containerClass}>
      <div className={`text-center text-[11px] font-extrabold tracking-[0.06em] text-sp-text-faint uppercase ${horizontal ? 'w-full' : ''}`}>
        Observers
      </div>
      {!horizontal && (
        <div className="mb-1 text-center text-[10px] leading-[1.4] text-sp-text-faintest">
          Seated at the rail, watching the table
        </div>
      )}

      {observers.map(([id, p]) => {
        const canClick = canTarget && id !== uid;
        return (
          <div
            key={id}
            className="relative h-[104px] w-[76px] shrink-0"
          >
            <div className="absolute top-1.5 left-5 z-[1] h-[50px] w-[38px] rounded-tl-lg rounded-tr-lg rounded-br-sm rounded-bl-sm border border-sp-border bg-sp-panel-3" />
            <div className="absolute top-16 left-4 z-[1] h-6 w-[5px] rounded-br-sm rounded-bl-sm bg-sp-panel-3" />
            <div className="absolute top-16 left-[55px] z-[1] h-6 w-[5px] rounded-br-sm rounded-bl-sm bg-sp-panel-3" />
            <div className="absolute top-[52px] left-3 z-[2] h-[15px] w-[52px] rounded-md border border-sp-border bg-sp-panel-2" />
            <img
              ref={node => registerSeatNode(id, node)}
              src={participantAvatarSrc(p)}
              alt=""
              onClick={canClick ? (e) => onThrowAt(id, e) : undefined}
              className={`absolute top-2.5 left-0.5 z-[3] block h-11 w-11 rounded-full border-2 border-sp-panel bg-sp-card-bg shadow-[0_2px_6px_rgba(0,0,0,0.35)] ${canClick ? 'cursor-crosshair' : 'cursor-default'}`}
            />
            <div className="absolute top-[30px] left-[-8px] z-[3] h-0 w-0 border-t-4 border-b-4 border-r-[7px] border-t-transparent border-b-transparent border-r-sp-text-faint" />
            <div className="absolute top-[92px] left-0 w-[76px] overflow-hidden text-center text-[11px] font-bold text-ellipsis whitespace-nowrap text-sp-text-dim">
              {id === uid ? p.name + ' (you)' : p.name}
            </div>
          </div>
        );
      })}
    </div>
  );
}
