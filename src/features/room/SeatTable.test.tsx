import { describe, it, expect, vi, beforeAll } from 'vitest';
import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SeatTable from './SeatTable.tsx';
import type { Participant } from '../../types/room.ts';

beforeAll(() => {
  // jsdom has no matchMedia -- useMediaQuery (wide-viewport end-seat/observer-
  // rail layout) needs a stub. Default to "not wide" (narrow viewport).
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

function participant(overrides: Partial<Participant> = {}): Participant {
  return {
    name: 'Ada',
    isObserver: false,
    vote: null,
    joinedAt: 0,
    avatar: { seed: 'a', bgIdx: 0, hairIdx: 0, hairColorIdx: 0, skinColorIdx: 0, eyesIdx: 0, eyebrowsIdx: 0, mouthIdx: 0, glassesIdx: 0, glassesIdxOn: false, earringsIdx: 0, earringsIdxOn: false, featureIdx: 0, featureIdxOn: false },
    ...overrides,
  };
}

function renderSeatTable(overrides: Partial<React.ComponentProps<typeof SeatTable>> = {}) {
  const props: React.ComponentProps<typeof SeatTable> = {
    participants: { a: participant({ name: 'Ada', joinedAt: 0 }) },
    uid: 'a',
    isRevealed: false,
    anyVote: false,
    allVoted: false,
    onReveal: vi.fn(),
    canTarget: false,
    onThrowAt: vi.fn(),
    registerSeatNode: vi.fn(),
    getSeatNode: vi.fn(() => null),
    stageRef: createRef<HTMLDivElement>() as React.RefObject<HTMLDivElement | null>,
    throws: [],
    onThrowDone: vi.fn(),
    isDriving: false,
    forceEndDrive: false,
    drivers: {},
    onPublishDrive: vi.fn(),
    onExitDrive: vi.fn(),
    ...overrides,
  };
  return { ...render(<SeatTable {...props} />), props };
}

describe('SeatTable', () => {
  it('renders a seat for each active participant, labeling the current user "(you)"', () => {
    renderSeatTable({
      participants: {
        a: participant({ name: 'Ada', joinedAt: 0 }),
        b: participant({ name: 'Bo', joinedAt: 1 }),
      },
      uid: 'a',
    });
    expect(screen.getByText('Ada (you)')).toBeInTheDocument();
    expect(screen.getByText('Bo')).toBeInTheDocument();
  });

  it('excludes observers from the seat count shown at the table center', () => {
    renderSeatTable({
      participants: {
        a: participant({ name: 'Ada', joinedAt: 0 }),
        b: participant({ name: 'Bo', joinedAt: 1, isObserver: true }),
      },
      uid: 'a',
      allVoted: false,
    });
    // 1 active participant (Ada), Bo is an observer and excluded from n/votedCount
    expect(screen.getByText('0/1')).toBeInTheDocument();
    expect(screen.getByText('Bo')).toBeInTheDocument();
  });

  it('shows a Reveal votes button once everyone has voted, disabled without any vote', () => {
    renderSeatTable({ allVoted: true, anyVote: false });
    expect(screen.getByText('Reveal votes')).toBeDisabled();
  });

  it('enables and triggers onReveal when all have voted and at least one vote exists', async () => {
    const user = userEvent.setup();
    const { props } = renderSeatTable({ allVoted: true, anyVote: true });
    const revealBtn = screen.getByText('Reveal votes');
    expect(revealBtn).toBeEnabled();
    await user.click(revealBtn);
    expect(props.onReveal).toHaveBeenCalledOnce();
  });

  it('calls onThrowAt when a targetable seat avatar is clicked, ignoring my own seat', async () => {
    const user = userEvent.setup();
    const { props } = renderSeatTable({
      participants: {
        a: participant({ name: 'Ada', joinedAt: 0 }),
        b: participant({ name: 'Bo', joinedAt: 1 }),
      },
      uid: 'a',
      canTarget: true,
    });
    // Only "other" seats are clickable when targeting (canClick = canTarget
    // && !seat.isMe) -- click every avatar and confirm exactly one throw
    // fires, regardless of DOM order from the top/bottom seat distribution.
    for (const avatar of screen.getAllByAltText('')) {
      await user.click(avatar);
    }
    expect(props.onThrowAt).toHaveBeenCalledOnce();
  });
});
