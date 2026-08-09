import { useState } from 'react';
import VotingBar from '../features/room/VotingBar.tsx';
import { DECKS, ALL_DECK_IDS } from '../features/room/decks.ts';
import { computeStats, computeDistribution, computeCustomGroups } from '../features/room/stats.ts';
import type { Participant, DeckId } from '../types/room.ts';

// Dev-only, Firestore-free stage for exercising VotingBar in isolation across
// every deck and vote-selection state, so layout/clipping bugs (long ROM
// labels, Custom free text) can be checked without creating a real room.
// Reached via ?visual-test=cards, stripped from production builds by the same
// import.meta.env.DEV gate used elsewhere (see useDevFakeParticipants.ts).
//
// One deck is rendered at a time (rather than all stacked) because
// VotingBar is `position: fixed` to the viewport bottom by design in the real
// app -- stacking multiple instances would have them all overlap at the
// bottom of the page instead of laying out predictably for a test to target.
function fixtureParticipants(deckId: DeckId): Record<string, Participant> {
  const deck = DECKS[deckId];
  const values = deck.values ? deck.values.map((v) => v.value) : ['about 2 weeks', 'depends on API', 'about 2 weeks'];
  const out: Record<string, Participant> = {};
  values.forEach((v, i) => {
    out[`p${i}`] = { name: `Player ${i + 1}`, isObserver: false, vote: v, joinedAt: i };
  });
  return out;
}

export default function VisualTestHarness() {
  const [deckId, setDeckId] = useState<DeckId>(ALL_DECK_IDS[0]);
  const deck = DECKS[deckId];
  const [myVote, setMyVote] = useState<string | null>(deck.values?.[0]?.value ?? null);
  const [revealed, setRevealed] = useState(false);
  const participants = fixtureParticipants(deckId);
  const stats = computeStats(participants, deck);
  const distribution = revealed && deck.resultKind !== 'freeText' ? computeDistribution(participants, deck) : [];
  const customGroups = revealed && deck.resultKind === 'freeText' ? computeCustomGroups(participants) : [];

  const selectDeck = (id: DeckId) => {
    setDeckId(id);
    setMyVote(DECKS[id].values?.[0]?.value ?? null);
    setRevealed(false);
  };

  return (
    <div className="sp-app">
      <div className="flex flex-wrap items-center gap-2 p-4">
        <span className="font-sp-mono text-xs font-bold text-sp-text">Visual test harness:</span>
        {ALL_DECK_IDS.map((id) => (
          <button
            key={id}
            data-testid={`select-deck-${id}`}
            onClick={() => selectDeck(id)}
            className={`cursor-pointer rounded border px-2 py-1 text-[11px] ${id === deckId ? 'border-sp-accent bg-sp-accent-panel text-sp-accent-text' : 'border-sp-border-strong bg-sp-panel-2 text-sp-text-dim'}`}
          >{DECKS[id].name}</button>
        ))}
        <button
          data-testid="toggle-reveal"
          onClick={() => setRevealed((r) => !r)}
          className="cursor-pointer rounded border border-sp-border-strong bg-sp-panel-2 px-2 py-1 text-[11px] text-sp-text-dim"
        >{revealed ? 'Show voting' : 'Show revealed'}</button>
      </div>

      <VotingBar
        deck={deck}
        isObserver={false}
        myVote={myVote}
        isRevealed={revealed}
        onSelect={setMyVote}
        onJoinVoting={() => {}}
        distribution={distribution}
        customGroups={customGroups}
        hasAverage={stats.hasAverage}
        average={stats.average}
        isWideSpread={stats.isWideSpread}
        mode={stats.mode}
        modeIsTie={stats.modeIsTie}
        flaggedCount={stats.flaggedCount}
        onStartNextRound={() => {}}
        hoveredValue={null}
        onHoverValue={() => {}}
      />
    </div>
  );
}
