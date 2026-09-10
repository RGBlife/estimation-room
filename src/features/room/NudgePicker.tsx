import type { Participant } from '../../types/room.ts';

export default function NudgePicker({ participants, uid, onNudge, disabled = false }: {
  participants: Record<string, Participant>;
  uid: string | null;
  onNudge?: (uid: string) => void;
  disabled?: boolean;
}) {
  const waiting = Object.entries(participants).filter(([id, p]) => id !== uid && !p.isObserver && p.vote == null);
  if (!onNudge || waiting.length === 0) return null;
  return (
    <select
      aria-label="Nudge a player who has not voted"
      value=""
      disabled={disabled}
      onChange={event => { if (event.target.value) onNudge(event.target.value); }}
      className="max-w-full min-h-9 cursor-pointer rounded-md border border-sp-border-strong bg-sp-panel px-2 font-sp-font text-xs text-sp-text-dim disabled:cursor-default disabled:opacity-60"
    >
      <option value="" disabled>{disabled ? 'Nudge sent — give them a moment' : 'Nudge a player…'}</option>
      {waiting.map(([id, p]) => <option key={id} value={id}>{p.name}</option>)}
    </select>
  );
}
