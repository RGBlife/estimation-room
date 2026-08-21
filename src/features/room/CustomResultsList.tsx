import type { CustomVoteGroup } from './stats.ts';

interface CustomResultsListProps {
  groups: CustomVoteGroup[];
  onStartNextRound: () => void;
}

// Replaces the bar-chart distribution for the Custom/Flexible deck: a plain
// grouped list, identical answers counted together, top group accent-bordered.
export default function CustomResultsList({ groups, onStartNextRound }: CustomResultsListProps) {
  return (
    <div className="flex w-full max-w-[420px] flex-col items-center gap-3.5 py-1">
      <div className="flex w-full flex-col gap-2">
        {groups.map((g) => (
          <div
            key={g.key}
            className={`sp-dist-column flex items-center justify-between rounded-lg border px-3 py-2.5 ${
              g.isTop ? 'border-sp-accent-border bg-sp-accent-panel' : 'border-sp-border bg-sp-card-bg'
            }`}
          >
            {/* min-w-0 lets the answer actually shrink inside the flex row --
                without it a long free-text answer pushes the count off the
                end instead of truncating. */}
            <span className={`min-w-0 truncate font-sp-mono text-sm ${g.isTop ? 'font-bold text-sp-text' : 'font-semibold text-sp-text-dim'}`}>
              &ldquo;{g.display}&rdquo;
            </span>
            <span className={`shrink-0 pl-2 text-[11.5px] ${g.isTop ? 'font-bold text-sp-accent-text' : 'text-sp-text-faintest'}`}>×{g.count}</span>
          </div>
        ))}
      </div>

      <div className="h-px w-[120px] max-w-[60%] bg-sp-border" />

      <div className="sp-kbd-hint-wrap">
        <div className="sp-kbd-hint rounded-md border border-sp-border-strong bg-sp-panel-3 px-1.5 py-0.5 text-[11px] font-semibold text-sp-text-dim shadow-[0_2px_6px_rgba(0,0,0,0.25)]">
          Enter
        </div>
        <button
          onClick={onStartNextRound}
          className="cursor-pointer rounded-lg border-none bg-sp-accent px-4.5 py-2.5 font-sp-font text-sm font-bold text-sp-bg"
        >Start next round</button>
      </div>
    </div>
  );
}
