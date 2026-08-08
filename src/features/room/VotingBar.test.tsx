import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VotingBar from './VotingBar.tsx';
import { DECKS } from './decks.ts';
import type { DistributionGroup, CustomVoteGroup } from './stats.ts';

beforeAll(() => {
  // jsdom has no ResizeObserver -- VotingBar uses one to report its measured
  // height to SeatTable, which isn't exercised by these tests.
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

function renderVotingBar(overrides: Partial<React.ComponentProps<typeof VotingBar>> = {}) {
  const props: React.ComponentProps<typeof VotingBar> = {
    deck: DECKS.fibonacci,
    isObserver: false,
    myVote: null,
    isRevealed: false,
    onSelect: vi.fn(),
    onJoinVoting: vi.fn(),
    distribution: [],
    customGroups: [],
    hasAverage: false,
    average: null,
    isWideSpread: false,
    mode: null,
    modeIsTie: false,
    flaggedCount: 0,
    onStartNextRound: vi.fn(),
    hoveredValue: null,
    onHoverValue: vi.fn(),
    ...overrides,
  };
  return { ...render(<VotingBar {...props} />), props };
}

describe('VotingBar', () => {
  it('shows the vote card row with all card values when not revealed and voting', () => {
    renderVotingBar();
    expect(screen.getByText('Your vote')).toBeInTheDocument();
    for (const value of ['0', '1', '2', '3', '5', '8', '13', '21', '?']) {
      expect(screen.getByRole('button', { name: value })).toBeInTheDocument();
    }
  });

  it('calls onSelect with the clicked card value', async () => {
    const user = userEvent.setup();
    const { props } = renderVotingBar();
    // getByText would also match this card's own keyboard-hint number (card
    // '5' is the 5th card, so its hint is also "5") -- scope to the button.
    await user.click(screen.getByRole('button', { name: '5' }));
    expect(props.onSelect).toHaveBeenCalledWith('5');
  });

  it('shows an observer message and a Join voting button for observers pre-reveal', async () => {
    const user = userEvent.setup();
    const { props } = renderVotingBar({ isObserver: true });
    expect(screen.getByText(/observing this round/)).toBeInTheDocument();
    await user.click(screen.getByText('Join voting'));
    expect(props.onJoinVoting).toHaveBeenCalledOnce();
  });

  // isRevealed briefly keeps the vote-card row mounted (VOTE_ROW_EXIT_MS) so
  // it can animate out before the distribution bar takes its place -- tests
  // that need the distribution bar must wait for that transition.
  it('shows the distribution bar and numeric average once revealed for the fibonacci deck', async () => {
    const distribution: DistributionGroup[] = [
      { value: '5', count: 2, isTop: true, voters: [] },
      { value: '8', count: 1, isTop: false, voters: [] },
    ];
    renderVotingBar({
      isRevealed: true,
      distribution,
      hasAverage: true,
      average: '6.0',
    });
    await waitFor(() => expect(screen.getByText('6.0')).toBeInTheDocument());
    expect(screen.getByText('average')).toBeInTheDocument();
    expect(screen.getByText('Start next round')).toBeInTheDocument();
  });

  it('shows a wide-spread warning when isWideSpread is true', async () => {
    renderVotingBar({ isRevealed: true, isWideSpread: true });
    await waitFor(() => expect(screen.getByText(/Wide spread/)).toBeInTheDocument());
  });

  it('calls onStartNextRound when the button is clicked', async () => {
    const user = userEvent.setup();
    const { props } = renderVotingBar({ isRevealed: true });
    await waitFor(() => expect(screen.getByText('Start next round')).toBeInTheDocument());
    await user.click(screen.getByText('Start next round'));
    expect(props.onStartNextRound).toHaveBeenCalledOnce();
  });

  it('renders the T-shirt deck cards', () => {
    renderVotingBar({ deck: DECKS.tshirt });
    for (const value of ['XS', 'S', 'M', 'L', 'XL', 'XXL']) {
      expect(screen.getByRole('button', { name: value })).toBeInTheDocument();
    }
  });

  it('shows a "most picked" summary for the T-shirt deck once revealed', async () => {
    const distribution: DistributionGroup[] = [{ value: 'M', count: 2, isTop: true, voters: [] }];
    renderVotingBar({ deck: DECKS.tshirt, isRevealed: true, distribution, mode: 'M' });
    await waitFor(() => expect(screen.getByText('most picked')).toBeInTheDocument());
    expect(screen.getAllByText('M')).toHaveLength(2); // the M bar's label, and the mode summary
  });

  it('renders ROM\'s wide/warn pills for its flag values', () => {
    renderVotingBar({ deck: DECKS.rom });
    expect(screen.getByRole('button', { name: 'Needs breaking down' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '8+ sprints' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
  });

  it('shows the ROM flagged-count warning when flaggedCount > 0', async () => {
    renderVotingBar({
      deck: DECKS.rom,
      isRevealed: true,
      distribution: [{ value: 'Needs breaking down', count: 2, isTop: true, voters: [] }],
      mode: null,
      flaggedCount: 2,
    });
    await waitFor(() => expect(screen.getByText(/2 of 2 flagged/)).toBeInTheDocument());
  });

  it('renders a free-text input instead of a card grid for the Custom deck', () => {
    renderVotingBar({ deck: DECKS.custom });
    expect(screen.getByPlaceholderText(/type your estimate/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '5' })).not.toBeInTheDocument();
  });

  it('submitting the Custom input calls onSelect with the typed value', async () => {
    const user = userEvent.setup();
    const { props } = renderVotingBar({ deck: DECKS.custom });
    await user.type(screen.getByPlaceholderText(/type your estimate/i), 'a sprint{Enter}');
    expect(props.onSelect).toHaveBeenCalledWith('a sprint');
  });

  it('shows the grouped free-text results list for the Custom deck once revealed', () => {
    const customGroups: CustomVoteGroup[] = [{ key: '2 weeks', display: '2 weeks', count: 2, isTop: true }];
    renderVotingBar({ deck: DECKS.custom, isRevealed: true, customGroups });
    expect(screen.getByText('“2 weeks”')).toBeInTheDocument();
    expect(screen.getByText('×2')).toBeInTheDocument();
  });
});
