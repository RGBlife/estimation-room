import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import RoomHeader from './RoomHeader.tsx';
import { DECKS } from './decks.ts';

function renderHeader(overrides: Partial<React.ComponentProps<typeof RoomHeader>> = {}) {
  const props: React.ComponentProps<typeof RoomHeader> = {
    roomCode: 'ABCD',
    copied: false,
    onCopy: vi.fn(),
    isCreator: false,
    storyDraft: '',
    storyInputRef: createRef<HTMLInputElement>(),
    onStoryChange: vi.fn(),
    story: '',
    theme: 'dark',
    onToggleTheme: vi.fn(),
    isObserver: false,
    deck: DECKS.fibonacci,
    onSwitchDeck: vi.fn(),
    equippedWeaponId: null,
    onCancelTargeting: vi.fn(),
    onOpenWeaponTray: vi.fn(),
    onSwitchRole: vi.fn(),
    onLeave: vi.fn(),
    ...overrides,
  };
  return { ...render(<RoomHeader {...props} />), props };
}

describe('RoomHeader', () => {
  it('shows the room code and calls onCopy when clicked', async () => {
    const user = userEvent.setup();
    const { props } = renderHeader();
    expect(screen.getByText('ABCD')).toBeInTheDocument();
    await user.click(screen.getByTitle('Copy shareable invite link'));
    expect(props.onCopy).toHaveBeenCalledOnce();
  });

  it('shows "link copied" once copied is true', () => {
    renderHeader({ copied: true });
    expect(screen.getByText('link copied')).toBeInTheDocument();
  });

  it('shows an editable story input for the creator', () => {
    renderHeader({ isCreator: true, storyDraft: 'My story' });
    expect(screen.getByPlaceholderText(/story title/i)).toHaveValue('My story');
  });

  it('shows read-only story text for non-creators, falling back to "Untitled story"', () => {
    renderHeader({ isCreator: false, story: '' });
    expect(screen.getByText('Untitled story')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/story title/i)).not.toBeInTheDocument();
  });

  it('hides weapon controls for observers', () => {
    renderHeader({ isObserver: true });
    expect(screen.queryByText(/Choose Your Weapon/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Cancel throwing/)).not.toBeInTheDocument();
  });

  it('shows "Choose Your Weapon" when unequipped, "Cancel throwing <label>" when equipped', async () => {
    const user = userEvent.setup();
    const { props, rerender } = renderHeader({ equippedWeaponId: null });
    expect(screen.getByText(/Choose Your Weapon/)).toBeInTheDocument();

    rerender(
      <RoomHeader
        {...props}
        equippedWeaponId="paper-airplane"
      />,
    );
    const cancelBtn = screen.getByText(/Cancel throwing Paper Airplane/);
    expect(cancelBtn).toBeInTheDocument();
    await user.click(cancelBtn);
    expect(props.onCancelTargeting).toHaveBeenCalledOnce();
  });

  it('toggles role via onSwitchRole with the opposite of the current isObserver', async () => {
    const user = userEvent.setup();
    const { props } = renderHeader({ isObserver: false });
    await user.click(screen.getByText('Switch to observing'));
    expect(props.onSwitchRole).toHaveBeenCalledWith(true);
  });

  it('calls onLeave when leaving', async () => {
    const user = userEvent.setup();
    const { props } = renderHeader();
    await user.click(screen.getByText('Leave room'));
    expect(props.onLeave).toHaveBeenCalledOnce();
  });

  it('shows the deck switcher for the creator', () => {
    renderHeader({ isCreator: true, deck: DECKS.tshirt });
    expect(screen.getByText('T-shirt')).toBeInTheDocument();
  });

  it('hides the deck switcher for non-creators', () => {
    renderHeader({ isCreator: false });
    expect(screen.queryByText('Fibonacci')).not.toBeInTheDocument();
  });

  it('calls onSwitchDeck with the picked deck id', async () => {
    const user = userEvent.setup();
    const { props } = renderHeader({ isCreator: true, deck: DECKS.fibonacci });
    await user.click(screen.getByText('Fibonacci'));
    await user.click(screen.getByText('T-shirt'));
    expect(props.onSwitchDeck).toHaveBeenCalledWith('tshirt');
  });
});
