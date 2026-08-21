import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RoomHeader from './RoomHeader.tsx';
import { DECKS } from './decks.ts';

// jsdom has no matchMedia -- useMediaQuery (the touch-primary check gating
// the GTA Mode button) needs a stub. Default to "not touch" (a mouse/desktop
// pointer) so existing button-visibility tests reflect the common case.
let touchPrimary = false;
beforeEach(() => {
  touchPrimary = false;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === '(pointer: coarse)' ? touchPrimary : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

function renderHeader(overrides: Partial<React.ComponentProps<typeof RoomHeader>> = {}) {
  const props: React.ComponentProps<typeof RoomHeader> = {
    roomCode: 'ABCD',
    copied: false,
    onCopy: vi.fn(),
    isCreator: false,
    theme: 'dark',
    onToggleTheme: vi.fn(),
    isObserver: false,
    deck: DECKS.fibonacci,
    onSwitchDeck: vi.fn(),
    equippedWeaponId: null,
    onCancelTargeting: vi.fn(),
    onOpenWeaponTray: vi.fn(),
    isRevealed: false,
    isDriving: false,
    onStartDriving: vi.fn(),
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

  it('shows the GTA Mode button once revealed on a non-touch device', () => {
    renderHeader({ isRevealed: true });
    expect(screen.getByText(/GTA Mode/)).toBeInTheDocument();
  });

  it('hides the GTA Mode button on a touch-primary device -- driving needs a keyboard', () => {
    touchPrimary = true;
    renderHeader({ isRevealed: true });
    expect(screen.queryByText(/GTA Mode/)).not.toBeInTheDocument();
  });
});
