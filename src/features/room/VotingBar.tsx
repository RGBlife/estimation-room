import { useEffect, useRef, useState } from 'react';
import type { CardValue } from '../../types/room.ts';
import type { DeckDefinition } from './decks.ts';
import type { DistributionGroup, CustomVoteGroup } from './stats.ts';
import CustomVoteInput from './CustomVoteInput.tsx';
import CustomResultsList from './CustomResultsList.tsx';

const MAX_BAR_HEIGHT = 64;
const MIN_BAR_HEIGHT = 18;
const STAGGER_MS = 45;
const VOTE_ROW_EXIT_MS = 260;

interface DistributionBarProps {
  deck: DeckDefinition;
  distribution: DistributionGroup[];
  hasAverage: boolean;
  average: string | null;
  isWideSpread: boolean;
  mode: string | null;
  modeIsTie: boolean;
  flaggedCount: number;
  onStartNextRound: () => void;
  hoveredValue: CardValue | null;
  onHoverValue: (value: CardValue | null) => void;
}

function DistributionBar({
  deck, distribution, hasAverage, average, isWideSpread, mode, modeIsTie, flaggedCount,
  onStartNextRound, hoveredValue, onHoverValue,
}: DistributionBarProps) {
  const maxCount = Math.max(1, ...distribution.map(d => d.count));
  const totalVotes = distribution.reduce((sum, d) => sum + d.count, 0);
  const showSummary = deck.resultKind === 'average' ? hasAverage : distribution.length > 0;
  return (
    <div className="flex flex-col items-center gap-3.5 py-1">
      <div className="flex flex-wrap items-end justify-center gap-5.5">
        {distribution.map((d, i) => {
          const dimmed = hoveredValue != null && hoveredValue !== d.value;
          return (
            <div
              key={d.value}
              className="sp-dist-column flex cursor-default flex-col items-center gap-1.5 transition-opacity duration-150"
              onMouseEnter={() => onHoverValue(d.value)}
              onMouseLeave={() => onHoverValue(null)}
              style={{ opacity: dimmed ? 0.35 : 1, animationDelay: `${i * STAGGER_MS}ms` }}
            >
              <div
                className={`sp-dist-bar flex w-[38px] items-center justify-center rounded-tl-md rounded-tr-md ${d.isTop ? 'bg-sp-accent' : 'bg-sp-bar-track'}`}
                style={{
                  height: Math.round(MIN_BAR_HEIGHT + (d.count / maxCount) * (MAX_BAR_HEIGHT - MIN_BAR_HEIGHT)),
                  animationDelay: `${i * STAGGER_MS}ms`,
                }}
              >
                <span className={`font-sp-mono text-[11px] font-bold ${d.isTop ? 'text-sp-bg' : 'text-sp-text-dim'}`}>{d.count}</span>
              </div>
              <div className="font-sp-mono text-sm font-bold text-sp-text">{d.value}</div>
            </div>
          );
        })}

        {showSummary && (
          <div
            className="sp-dist-average ml-1 border-l border-sp-border pl-2 text-center"
            style={{ animationDelay: `${distribution.length * STAGGER_MS}ms` }}
          >
            {deck.resultKind === 'average' ? (
              <>
                <div className="font-sp-mono text-2xl font-bold text-sp-text">{average}</div>
                <div className="mt-0.5 text-[11px] text-sp-text-faint">average</div>
              </>
            ) : (
              <>
                <div className="font-sp-mono text-2xl font-bold text-sp-text">{modeIsTie ? 'tie' : mode}</div>
                <div className="mt-0.5 text-[11px] text-sp-text-faint">most picked</div>
              </>
            )}
          </div>
        )}
      </div>

      {isWideSpread && (
        <div
          className="sp-dist-average rounded-lg border border-sp-warn-border bg-sp-warn-bg px-3.5 py-1.5 text-sm font-semibold text-sp-warn-text"
          style={{ animationDelay: `${distribution.length * STAGGER_MS + 80}ms` }}
        >⚠ Wide spread — discuss?</div>
      )}

      {flaggedCount > 0 && (
        <div
          className="sp-dist-average rounded-lg border border-sp-warn-border bg-sp-warn-bg px-3.5 py-1.5 text-sm font-semibold text-sp-warn-text"
          style={{ animationDelay: `${distribution.length * STAGGER_MS + 80}ms` }}
        >⚠ {flaggedCount} of {totalVotes} flagged &ldquo;needs breaking down&rdquo;</div>
      )}

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

interface VoteCardRowProps {
  deck: DeckDefinition;
  myVote: CardValue | null;
  onSelect: (value: CardValue) => void;
  exiting?: boolean;
}

function VoteCardRow({ deck, myVote, onSelect, exiting }: VoteCardRowProps) {
  const values = deck.values ?? [];
  return (
    <>
      <span className="text-[11px] font-bold tracking-[0.05em] whitespace-nowrap text-sp-text-faintest uppercase">Your vote</span>
      <div className="flex flex-wrap justify-center gap-2">
        {values.map((spec, i) => {
          const { value, wide, warn } = spec;
          const selected = value === myVote;
          // Matches the number-key handler in useKeyboardShortcuts: '1' selects
          // the 1st card, ..., '9' the 9th, '0' the 10th. Cards beyond the 10th
          // have no key shortcut, so no hint is shown.
          const keyHint = i < 10 ? String((i + 1) % 10) : null;
          const shapeClass = wide ? 'h-[58px] w-auto px-4' : 'h-[58px] w-[42px]';
          const colorClass = selected
            ? warn
              ? 'border-2 border-sp-accent bg-sp-warn-bg text-sp-warn-text shadow-[0_0_0_3px_var(--sp-accent-glow)]'
              : 'border-2 border-sp-accent bg-sp-accent-panel text-sp-accent-on-card shadow-[0_0_0_3px_var(--sp-accent-glow)]'
            : warn
              ? 'border-[1.5px] border-dashed border-sp-warn-border bg-sp-warn-bg text-sp-warn-text'
              : 'border-[1.5px] border-sp-border-strong bg-sp-card-bg text-sp-text-dim';
          const card = (
            <button
              onClick={() => onSelect(value)}
              className={`cursor-pointer rounded-lg font-sp-mono text-base font-bold whitespace-nowrap transition-[transform,border-color] duration-150 ${shapeClass} ${colorClass} ${exiting ? 'sp-vote-card-exit' : 'sp-vote-card-enter'}`}
              style={{
                transform: selected && !exiting ? 'translateY(-6px)' : undefined,
                animationDelay: `${(exiting ? values.length - 1 - i : i) * 20}ms`,
              }}
            >{value}</button>
          );
          if (!keyHint) return <div key={value}>{card}</div>;
          return (
            <div key={value} className="sp-kbd-hint-wrap">
              <div className="sp-kbd-hint rounded-md border border-sp-border-strong bg-sp-panel-3 px-1.5 py-0.5 text-[11px] font-semibold text-sp-text-dim shadow-[0_2px_6px_rgba(0,0,0,0.25)]">
                {keyHint}
              </div>
              {card}
            </div>
          );
        })}
      </div>
    </>
  );
}

interface VotingBarProps {
  deck: DeckDefinition;
  isObserver: boolean;
  myVote: CardValue | null;
  isRevealed: boolean;
  onSelect: (value: CardValue) => void;
  onJoinVoting: () => void;
  distribution: DistributionGroup[];
  customGroups: CustomVoteGroup[];
  hasAverage: boolean;
  average: string | null;
  isWideSpread: boolean;
  mode: string | null;
  modeIsTie: boolean;
  flaggedCount: number;
  onStartNextRound: () => void;
  hoveredValue: CardValue | null;
  onHoverValue: (value: CardValue | null) => void;
  onHeightChange?: (height: number) => void;
}

export default function VotingBar({
  deck, isObserver, myVote, isRevealed, onSelect, onJoinVoting,
  distribution, customGroups, hasAverage, average, isWideSpread, mode, modeIsTie, flaggedCount,
  onStartNextRound, hoveredValue, onHoverValue, onHeightChange,
}: VotingBarProps) {
  const isCustom = deck.values === null;

  // The vote-card row stays mounted briefly after reveal so it can animate
  // out instead of being swapped for the distribution bar instantly. Not
  // applicable to Custom's text input, which has no card grid to animate.
  const [showExitingCards, setShowExitingCards] = useState(false);
  useEffect(() => {
    if (isRevealed && !isCustom) {
      setShowExitingCards(true);
      const t = setTimeout(() => setShowExitingCards(false), VOTE_ROW_EXIT_MS);
      return () => clearTimeout(t);
    }
    setShowExitingCards(false);
  }, [isRevealed, isCustom]);

  // Reports this bar's real height so SeatTable can reserve exactly enough
  // clearance above it — the bar grows a lot taller once the distribution
  // panel replaces the vote-card row, and measuring beats guessing.
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = barRef.current;
    if (!node || !onHeightChange) return;
    const observer = new ResizeObserver(([entry]) => onHeightChange(entry.contentRect.height));
    observer.observe(node);
    return () => observer.disconnect();
  }, [onHeightChange]);

  return (
    <div ref={barRef} className="fixed right-0 bottom-0 left-0 flex flex-wrap items-center justify-center gap-5 border-t border-sp-border bg-sp-panel px-5 py-3">
      {isRevealed ? (
        showExitingCards && !isObserver ? (
          <VoteCardRow deck={deck} myVote={myVote} onSelect={onSelect} exiting />
        ) : deck.resultKind === 'freeText' ? (
          <CustomResultsList groups={customGroups} />
        ) : (
          <DistributionBar
            deck={deck}
            distribution={distribution}
            hasAverage={hasAverage}
            average={average}
            isWideSpread={isWideSpread}
            mode={mode}
            modeIsTie={modeIsTie}
            flaggedCount={flaggedCount}
            onStartNextRound={onStartNextRound}
            hoveredValue={hoveredValue}
            onHoverValue={onHoverValue}
          />
        )
      ) : !isObserver ? (
        isCustom ? (
          <CustomVoteInput myVote={myVote} onSubmit={onSelect} />
        ) : (
          <VoteCardRow deck={deck} myVote={myVote} onSelect={onSelect} />
        )
      ) : (
        <>
          <span className="text-sm text-sp-text-faintest">You're observing this round — no vote needed.</span>
          <button onClick={onJoinVoting} className="cursor-pointer rounded-md border border-sp-border-strong bg-transparent px-3.5 py-1.5 font-sp-font text-sm text-sp-text-dim">Join voting</button>
        </>
      )}
    </div>
  );
}
