import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RecentRooms from './RecentRooms.tsx';
import { randomAvatar } from '../avatar/avatar.ts';
import type { RecentRoom } from './recentRooms.ts';
import type { RoomStatus } from './useRoomStatuses.ts';

const NOW = Date.UTC(2026, 8, 18, 12, 0, 0);
const HOUR = 3600000;

function room(code: string, overrides: Partial<RecentRoom> = {}): RecentRoom {
  return { code, lastSeenAt: NOW - 2 * HOUR, createdByMe: false, people: [{ name: 'Sam', avatar: randomAvatar() }], ...overrides };
}

function renderHand(rooms: RecentRoom[], statuses: Record<string, RoomStatus> = {}, props: Partial<React.ComponentProps<typeof RecentRooms>> = {}) {
  const onRejoin = vi.fn();
  const onForget = vi.fn();
  render(<RecentRooms rooms={rooms} statuses={statuses} joiningCode={null} disabled={false} onRejoin={onRejoin} onForget={onForget} now={NOW} {...props} />);
  return { onRejoin, onForget };
}

describe('RecentRooms', () => {
  it('deals one card per room, newest first, and rejoins on tap', async () => {
    const user = userEvent.setup();
    const { onRejoin } = renderHand([room('ABCD'), room('EFGH')], { ABCD: { kind: 'open', people: [{ name: 'Sam' }, { name: 'Alex' }, { name: 'Kim' }] } });
    const cards = screen.getAllByRole('button', { name: /Rejoin room/ });
    expect(cards.map(c => c.getAttribute('aria-label'))).toEqual([
      'Rejoin room ABCD. 3 here. Last here 2h ago',
      'Rejoin room EFGH. 2h ago. Last here 2h ago',
    ]);
    await user.click(cards[0]);
    expect(onRejoin).toHaveBeenCalledExactlyOnceWith('ABCD');
  });

  it('shows who is at the table now when the room is open, and remembers who was there otherwise', () => {
    renderHand(
      [room('ABCD', { people: [{ name: 'Old', avatar: randomAvatar() }] }), room('EFGH', { people: [{ name: 'Old', avatar: randomAvatar() }, { name: 'Older', avatar: randomAvatar() }] })],
      { ABCD: { kind: 'open', people: [{ name: 'A', avatar: randomAvatar() }, { name: 'B', avatar: randomAvatar() }, { name: 'C', avatar: randomAvatar() }, { name: 'D', avatar: randomAvatar() }] } },
    );
    const [open, remembered] = screen.getAllByRole('button', { name: /Rejoin room/ });
    expect(open.querySelectorAll('img')).toHaveLength(3);
    expect(open.textContent).toContain('+1');
    expect(remembered.querySelectorAll('img')).toHaveLength(2);
  });

  it('marks an empty open room and a closed room in words, and does not rejoin a closed one', async () => {
    const user = userEvent.setup();
    const { onRejoin } = renderHand([room('ABCD'), room('EFGH')], { ABCD: { kind: 'open', people: [] }, EFGH: { kind: 'closed' } });
    expect(screen.getByText('Empty')).toBeInTheDocument();
    const closed = screen.getByRole('button', { name: 'Room EFGH is closed. Last here 2h ago' });
    expect(closed).toHaveAttribute('aria-disabled', 'true');
    await user.click(closed);
    expect(onRejoin).not.toHaveBeenCalled();
  });

  it('holds every card while disabled and says which room is being joined', async () => {
    const user = userEvent.setup();
    const { onRejoin } = renderHand([room('ABCD')], {}, { disabled: true, joiningCode: 'ABCD' });
    const card = screen.getByRole('button', { name: /Rejoin room ABCD/ });
    expect(card).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Joining…')).toBeInTheDocument();
    await user.click(card);
    expect(onRejoin).not.toHaveBeenCalled();
  });

  it('distinguishes rooms I created from rooms I joined', () => {
    renderHand([room('ABCD', { createdByMe: true }), room('EFGH')]);
    const [host, guest] = screen.getAllByRole('button', { name: /Rejoin room/ });
    expect(host).toHaveAttribute('data-face', 'host');
    expect(guest).toHaveAttribute('data-face', 'guest');
  });

  it('has a forget control per room', async () => {
    const user = userEvent.setup();
    const { onForget, onRejoin } = renderHand([room('ABCD')]);
    await user.click(screen.getByRole('button', { name: 'Forget room ABCD' }));
    expect(onForget).toHaveBeenCalledExactlyOnceWith('ABCD');
    expect(onRejoin).not.toHaveBeenCalled();
  });
});

it('uses the live name, including its removal, and renders remembered names as text', () => {
  renderHand([room('ABCD', { teamName: 'Old' }), room('EFGH', { teamName: 'Cleared' }), room('IJKL', { teamName: '<b>Team</b>' })], {
    ABCD: { kind: 'open', people: [], teamName: 'Renamed' }, EFGH: { kind: 'open', people: [] },
  });
  expect(screen.getByRole('button', { name: /Rejoin room ABCD.*Renamed/ })).toHaveTextContent('Renamed');
  expect(screen.queryByText('Old')).not.toBeInTheDocument();
  expect(screen.queryByText('Cleared')).not.toBeInTheDocument();
  expect(screen.getByText('<b>Team</b>').querySelector('b')).toBeNull();
});
