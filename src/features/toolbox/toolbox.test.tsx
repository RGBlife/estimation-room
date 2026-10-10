import { beforeAll, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SortedGame from './SortedGame.tsx';
import ToolboxWindow from './ToolboxWindow.tsx';
import type { SortedMove, SortedView } from '../../types/games.ts';

beforeAll(() => {
  // jsdom has <dialog> without its modal methods.
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.open = true; };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.open = false; };
});

const TILES = ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4', 'C1', 'C2', 'C3', 'C4', 'D1', 'D2', 'D3', 'D4'];
const board = (over: Partial<SortedView> = {}): SortedView => ({
  id: 's001', number: 1, tiles: TILES, found: [], lives: 3, finished: false, won: false, replay: false, ...over,
});

describe('SortedGame', () => {
  it('opens the game in play and lets four tiles be picked, no more', async () => {
    const play = vi.fn(async (_: SortedMove) => board());
    render(<SortedGame play={play} />);
    await screen.findByText('Sorted #1');
    expect(play).toHaveBeenCalledWith({ operation: 'open' });
    for (const tile of ['A1', 'A2', 'A3', 'A4']) fireEvent.click(screen.getByRole('button', { name: tile }));
    expect(screen.getByRole('button', { name: 'B1' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled();
  });
  it('sends the guess, and says when it was one away', async () => {
    const play = vi.fn(async (move: SortedMove) => move.operation === 'guess' ? board({ lives: 2, result: 'one-away' }) : board());
    render(<SortedGame play={play} />);
    await screen.findByText('Sorted #1');
    for (const tile of ['A1', 'A2', 'A3', 'B1']) fireEvent.click(screen.getByRole('button', { name: tile }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit' })); });
    expect(play).toHaveBeenLastCalledWith({ operation: 'guess', items: ['A1', 'A2', 'A3', 'B1'] });
    expect(screen.getByText('One away…')).toBeInTheDocument();
    expect(screen.getByLabelText('2 mistakes left')).toBeInTheDocument();
    // The selection stays, to adjust rather than start again.
    expect(screen.getByRole('button', { name: 'A1' })).toHaveAttribute('aria-pressed', 'true');
  });
  it('shows a found group as a band and takes its tiles off the board', async () => {
    const group = { name: 'Letters A', level: 0 as const, items: ['A1', 'A2', 'A3', 'A4'] };
    const play = vi.fn(async (move: SortedMove) => move.operation === 'guess' ? board({ tiles: TILES.slice(4), found: [group], result: 'correct' }) : board());
    render(<SortedGame play={play} />);
    await screen.findByText('Sorted #1');
    for (const tile of group.items) fireEvent.click(screen.getByRole('button', { name: tile }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Submit' })); });
    expect(screen.getByText('Letters A')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'A1' })).not.toBeInTheDocument();
  });
  it('reports a finished puzzle with its coins, then deals the next', async () => {
    const play = vi.fn(async (move: SortedMove) => move.operation === 'next' ? board({ id: 's002', number: 2 }) : board({ tiles: [], finished: true, won: true, lives: 2, paid: 20 }));
    render(<SortedGame play={play} />);
    expect(await screen.findByText('Sorted, with 1 mistake')).toBeInTheDocument();
    expect(screen.getByText('+20 coins')).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Next puzzle' })); });
    expect(await screen.findByText('Sorted #2')).toBeInTheDocument();
  });
  it('says when today’s coin limit swallowed the payout', async () => {
    render(<SortedGame play={async () => board({ tiles: [], finished: true, won: false, lives: 0, paid: 0, missed: [] })} />);
    expect(await screen.findByText("You've reached today's coin limit.")).toBeInTheDocument();
  });
  it('shows why a move failed', async () => {
    render(<SortedGame play={async () => { throw new Error('Games open once the votes are revealed'); }} />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Games open once the votes are revealed'));
  });
});

describe('ToolboxWindow', () => {
  it('shows the balance only once there is one', () => {
    const { rerender } = render(<ToolboxWindow coins={0} closing={false} onClose={() => {}}><p>game</p></ToolboxWindow>);
    expect(screen.queryByLabelText(/coins/)).not.toBeInTheDocument();
    rerender(<ToolboxWindow coins={45} closing={false} onClose={() => {}}><p>game</p></ToolboxWindow>);
    expect(screen.getByLabelText('45 coins')).toBeInTheDocument();
  });
  it('lists the games, with the ones still to come unavailable', () => {
    render(<ToolboxWindow coins={0} closing={false} onClose={() => {}}><p>game</p></ToolboxWindow>);
    expect(screen.getByRole('button', { name: 'Sorted' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: /Battleship/ })).toBeDisabled();
  });
});
