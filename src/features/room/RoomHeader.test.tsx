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

  it('offers weapon controls for observers', () => {
    renderHeader({ isObserver: true });
    expect(screen.getByText(/Choose Your Weapon/)).toBeInTheDocument();
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

  it('disables the weapon button while driving', async () => {
    // Both modes running at once puts a full-screen tray over a live physics
    // loop, has GTA Mode and the tray reading the same keys, and leaves your
    // own seat clickable while it's invisible (you're in the car).
    const user = userEvent.setup();
    const { props } = renderHeader({ isRevealed: true, isDriving: true });
    const weaponBtn = screen.getByText(/Choose Your Weapon/);
    expect(weaponBtn).toBeDisabled();
    await user.click(weaponBtn);
    expect(props.onOpenWeaponTray).not.toHaveBeenCalled();
  });

  it('keeps Cancel enabled while driving so targeting can still be backed out of', async () => {
    const user = userEvent.setup();
    const { props } = renderHeader({ isRevealed: true, isDriving: true, equippedWeaponId: 'paper-airplane' });
    const cancelBtn = screen.getByText(/Cancel throwing Paper Airplane/);
    expect(cancelBtn).not.toBeDisabled();
    await user.click(cancelBtn);
    expect(props.onCancelTargeting).toHaveBeenCalledOnce();
  });

  it('keeps role, theme and leaving in the room menu', async () => {
    const user = userEvent.setup();
    const { props } = renderHeader({ isObserver: false });
    expect(screen.queryByText('Leave room')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Room menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Switch to observing' }));
    expect(props.onSwitchRole).toHaveBeenCalledWith(true);
    await user.click(screen.getByRole('button', { name: 'Room menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Switch to light theme' }));
    expect(props.onToggleTheme).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Room menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Leave room' }));
    expect(props.onLeave).toHaveBeenCalledOnce();
  });

  it('lets only the creator pick the deck, from the room menu', async () => {
    const user = userEvent.setup();
    const { props } = renderHeader({ isCreator: true, deck: DECKS.fibonacci });
    await user.click(screen.getByRole('button', { name: 'Room menu' }));
    expect(screen.getByRole('menuitemradio', { name: 'Fibonacci' })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('menuitemradio', { name: 'T-shirt' }));
    expect(props.onSwitchDeck).toHaveBeenCalledWith('tshirt');
  });

  it('hides the deck from non-creators', async () => {
    const user = userEvent.setup();
    renderHeader({ isCreator: false });
    await user.click(screen.getByRole('button', { name: 'Room menu' }));
    expect(screen.queryByRole('menuitemradio')).not.toBeInTheDocument();
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

  it('opens your own menu from the avatar, with achievements and coins', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const { props } = renderHeader({ onEditAvatar: vi.fn(), achievements: { unlocked: 5, total: 19, onOpen }, arcade: { coins: 45, available: false, onOpen: vi.fn() } });
    await user.click(screen.getByRole('button', { name: 'You' }));
    expect(screen.getByText('45 coins')).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: /Achievements/ }));
    expect(onOpen).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'You' }));
    await user.click(screen.getByRole('menuitem', { name: 'Edit avatar' }));
    expect(props.onEditAvatar).toHaveBeenCalledOnce();
  });

  it('opens the avatar editor directly where there is no progress', () => {
    renderHeader({ onEditAvatar: vi.fn() });
    expect(screen.getByRole('button', { name: 'Customise your avatar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'You' })).not.toBeInTheDocument();
  });

  it('keeps the Arcade shut until the reveal, and says what is waiting', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const { rerender, props } = renderHeader({ arcade: { coins: 0, available: false, onOpen } });
    await user.click(screen.getByRole('button', { name: 'Arcade, opens after the reveal' }));
    expect(onOpen).not.toHaveBeenCalled();
    rerender(<RoomHeader {...props} arcade={{ coins: 45, available: true, alert: 'Challenge', onOpen }} />);
    await user.click(screen.getByRole('button', { name: 'Arcade, Challenge, 45 coins' }));
    expect(onOpen).toHaveBeenCalledOnce();
  });
});
