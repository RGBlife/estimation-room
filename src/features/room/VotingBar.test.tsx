import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VotingBar from './VotingBar.tsx';
import type { DistributionGroup } from './stats.ts';

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
    isObserver: false,
    myVote: null,
    isRevealed: false,
    onSelect: vi.fn(),
    onJoinVoting: vi.fn(),
    distribution: [],
    hasAverage: false,
    average: null,
    isWideSpread: false,
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
  it('shows the distribution bar once revealed', async () => {
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
});
