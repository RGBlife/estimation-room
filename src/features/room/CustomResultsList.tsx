import type { CustomVoteGroup } from './stats.ts';

interface CustomResultsListProps {
  groups: CustomVoteGroup[];
}

// Replaces the bar-chart distribution for the Custom/Flexible deck: a plain
// grouped list, identical answers counted together, top group accent-bordered.
export default function CustomResultsList({ groups }: CustomResultsListProps) {
  return (
    <div className="flex w-full max-w-[420px] flex-col gap-2">
      {groups.map((g) => (
        <div
          key={g.key}
          className={`sp-dist-column flex items-center justify-between rounded-lg border px-3 py-2.5 ${
            g.isTop ? 'border-sp-accent-border bg-sp-accent-panel' : 'border-sp-border bg-sp-card-bg'
          }`}
        >
          <span className={`font-sp-mono text-sm ${g.isTop ? 'font-bold text-sp-text' : 'font-semibold text-sp-text-dim'}`}>
            &ldquo;{g.display}&rdquo;
          </span>
          <span className={`text-[11.5px] ${g.isTop ? 'font-bold text-sp-accent-text' : 'text-sp-text-faintest'}`}>×{g.count}</span>
        </div>
      ))}
    </div>
  );
}
