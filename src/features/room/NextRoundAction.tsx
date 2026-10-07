// The way out of a revealed round. With backlog tickets still to estimate,
// the host's main action brings up the next one; voting again on the same
// ticket stays available beside it.
export interface NextTicket { key?: string; title: string; onStart: () => void }

export default function NextRoundAction({ onStartNextRound, nextTicket }: { onStartNextRound: () => void; nextTicket?: NextTicket | null }) {
  const name = nextTicket ? nextTicket.key ?? (nextTicket.title.length > 28 ? `${nextTicket.title.slice(0, 27)}…` : nextTicket.title) : '';
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="sp-kbd-hint-wrap">
        <div className="sp-kbd-hint rounded-md border border-sp-border-strong bg-sp-panel-3 px-1.5 py-0.5 text-[11px] font-semibold text-sp-text-dim shadow-sp-sm">
          Enter
        </div>
        {nextTicket
          ? <button
            onClick={nextTicket.onStart}
            aria-label={`Start next ticket: ${[nextTicket.key, nextTicket.title].filter(Boolean).join(' ')}`}
            className="max-w-[min(360px,80vw)] cursor-pointer truncate rounded-lg border-none bg-sp-accent px-4.5 py-2.5 font-sp-font text-sm font-bold text-sp-bg"
          >Start next ticket: {name}</button>
          : <button
            onClick={onStartNextRound}
            className="cursor-pointer rounded-lg border-none bg-sp-accent px-4.5 py-2.5 font-sp-font text-sm font-bold text-sp-bg"
          >Start next round</button>}
      </div>
      {nextTicket && (
        <button onClick={onStartNextRound} className="cursor-pointer border-none bg-transparent px-2 py-1 font-sp-font text-xs font-semibold text-sp-text-faint hover:text-sp-text">
          Vote again on this one
        </button>
      )}
    </div>
  );
}
