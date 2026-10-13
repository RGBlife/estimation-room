import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import AchievementToast from './AchievementToast.tsx';
import AchievementsWindow from './AchievementsWindow.tsx';
import { ACHIEVEMENTS, unlockedCount } from './catalogue.ts';

beforeAll(() => {
  // jsdom has <dialog> without its modal methods.
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.open = true; };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.open = false; };
});
afterEach(() => { vi.useRealTimers(); });

describe('achievement catalogue', () => {
  it('has unique ids, and a clue only where the achievement is secret', () => {
    expect(new Set(ACHIEVEMENTS.map(a => a.id)).size).toBe(ACHIEVEMENTS.length);
    expect(ACHIEVEMENTS.find(a => a.id === 'table-for-none')?.clue).toBeTruthy();
    expect(ACHIEVEMENTS.find(a => a.id === 'mission-passed')?.clue).toBeUndefined();
  });
  it('counts only achievements it knows', () => {
    expect(unlockedCount({ 'mission-passed': 1, 'from-a-newer-service': 2 })).toBe(1);
    expect(unlockedCount(undefined)).toBe(0);
  });
});

describe('AchievementToast', () => {
  it('announces the oldest unlock, then reports it shown', () => {
    vi.useFakeTimers();
    const onShown = vi.fn();
    render(<AchievementToast queue={['table-for-none', 'mission-passed']} onShown={onShown} onOpen={() => {}} top={100} />);
    expect(screen.getByRole('status')).toHaveTextContent('Secret achievement unlocked');
    expect(screen.getByText('Table for None')).toBeInTheDocument();
    expect(screen.queryByText('Mission Passed')).not.toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(4600); });
    expect(onShown).toHaveBeenCalledOnce();
  });
  it('opens the collection when clicked', () => {
    const onShown = vi.fn(), onOpen = vi.fn();
    render(<AchievementToast queue={['mission-passed']} onShown={onShown} onOpen={onOpen} top={100} />);
    fireEvent.click(screen.getByRole('button', { name: /Mission Passed/ }));
    expect(onOpen).toHaveBeenCalledOnce();
    expect(onShown).toHaveBeenCalledOnce();
  });
  it('skips an id this page does not know', () => {
    const onShown = vi.fn();
    render(<AchievementToast queue={['from-a-newer-service']} onShown={onShown} onOpen={() => {}} top={100} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(onShown).toHaveBeenCalledOnce();
  });
});

describe('AchievementsWindow', () => {
  const profile = { coins: 0, achievements: { 'mission-passed': Date.UTC(2026, 9, 9), 'wasted': Date.UTC(2026, 9, 9) } };
  it('shows earned cards with their date, locked ones with how to earn them, and secrets only as a clue', () => {
    render(<AchievementsWindow profile={profile} closing={false} onClose={() => {}} onReset={async () => {}} />);
    expect(screen.getByText(`2 of ${ACHIEVEMENTS.length} unlocked`)).toBeInTheDocument();
    expect(screen.getByText('Mission Passed')).toBeInTheDocument();
    expect(screen.getByText('Vote in 25 rounds.')).toBeInTheDocument();
    // An earned secret shows in full; an unearned one keeps its name hidden.
    expect(screen.getByText('Wasted')).toBeInTheDocument();
    expect(screen.queryByText('Table for None')).not.toBeInTheDocument();
    expect(screen.getByText("Some furniture isn't rated for this.")).toBeInTheDocument();
  });
  it('resets progress only after confirming', async () => {
    const onReset = vi.fn().mockResolvedValue(undefined);
    render(<AchievementsWindow profile={profile} closing={false} onClose={() => {}} onReset={onReset} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reset my progress' }));
    expect(onReset).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Reset my progress' })); });
    expect(onReset).toHaveBeenCalledOnce();
  });
  it('says why a reset failed', async () => {
    const onReset = vi.fn().mockRejectedValue(new Error('Not connected yet. Please try again.'));
    render(<AchievementsWindow profile={profile} closing={false} onClose={() => {}} onReset={onReset} confirmingReset />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Reset my progress' })); });
    expect(screen.getByRole('alert')).toHaveTextContent('Not connected yet');
  });
  it('offers no reset to a player with nothing to reset', () => {
    render(<AchievementsWindow profile={{ coins: 0, achievements: {} }} closing={false} onClose={() => {}} onReset={async () => {}} />);
    expect(screen.queryByRole('button', { name: 'Reset my progress' })).not.toBeInTheDocument();
  });
});
