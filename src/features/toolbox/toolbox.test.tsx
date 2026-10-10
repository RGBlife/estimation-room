import { beforeAll, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SortedGame from './SortedGame.tsx';
import ToolboxWindow from './ToolboxWindow.tsx';
import NoughtsGame from './NoughtsGame.tsx';
import ChallengeCard from './ChallengeCard.tsx';
import { duelSummary, formatSeconds } from './duels.ts';
import { randomAvatar } from '../avatar/avatar.ts';
import type { Participant } from '../../types/room.ts';
import type { DuelMove, DuelView, SortedMove, SortedView } from '../../types/games.ts';

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
    const { rerender } = render(<ToolboxWindow coins={0} game="sorted" onSelectGame={() => {}} closing={false} onClose={() => {}}><p>game</p></ToolboxWindow>);
    expect(screen.queryByLabelText(/coins/)).not.toBeInTheDocument();
    rerender(<ToolboxWindow coins={45} game="sorted" onSelectGame={() => {}} closing={false} onClose={() => {}}><p>game</p></ToolboxWindow>);
    expect(screen.getByLabelText('45 coins')).toBeInTheDocument();
  });
  it('lists the games, with the ones still to come unavailable', () => {
    render(<ToolboxWindow coins={0} game="sorted" onSelectGame={() => {}} closing={false} onClose={() => {}}><p>game</p></ToolboxWindow>);
    expect(screen.getByRole('button', { name: 'Sorted' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: /Battleship/ })).toBeDisabled();
  });
});

describe('ToolboxWindow game list', () => {
  it('switches game, and marks one with something waiting', () => {
    const select = vi.fn();
    render(<ToolboxWindow coins={0} game="sorted" onSelectGame={select} waiting={['noughts']} closing={false} onClose={() => {}}><p>game</p></ToolboxWindow>);
    fireEvent.click(screen.getByRole('button', { name: /Noughts and crosses/ }));
    expect(select).toHaveBeenCalledWith('noughts');
    expect(screen.getByRole('button', { name: /Noughts and crosses/ })).toHaveAccessibleName('Noughts and crosses (waiting for you)');
  });
});

const person = (name: string): Participant => ({ name, isObserver: false, vote: null, avatar: randomAvatar() } as Participant);
const PEOPLE = { me: person('Me'), sam: person('Sam'), alex: person('Alex'), priya: person('Priya') };
const duelOf = (over: Partial<DuelView> = {}): DuelView => ({
  id: 'd1', game: 'noughts', status: 'playing', stake: 0, paused: false, board: Array(9).fill(null),
  challenger: { uid: 'me', name: 'Me', mark: 'X' }, opponent: { uid: 'sam', name: 'Sam', mark: 'O' }, turn: 'me', turnLeftMs: 60_000, ...over,
});

describe('duelSummary', () => {
  it('says where a duel stands from each seat', () => {
    expect(duelSummary(duelOf({ status: 'offered', turn: undefined }), 'me').text).toBe('Waiting for Sam to accept');
    expect(duelSummary(duelOf({ status: 'offered', turn: undefined }), 'sam').text).toBe('Me challenges you');
    expect(duelSummary(duelOf(), 'me').text).toBe('Your move');
    expect(duelSummary(duelOf(), 'sam').text).toBe("Me's move");
    expect(duelSummary(duelOf({ paused: true }), 'me').text).toBe('Paused until the next reveal');
    expect(duelSummary(duelOf({ status: 'won', winner: 'me', reason: 'line' }), 'me')).toEqual({ text: 'You won', outcome: 'won' });
    expect(duelSummary(duelOf({ status: 'won', winner: 'me', reason: 'timeout' }), 'sam')).toEqual({ text: 'You ran out of time', outcome: 'lost' });
    expect(duelSummary(duelOf({ status: 'won', winner: 'sam', reason: 'left' }), 'alex').text).toBe('Me left the game. Sam wins');
    expect(duelSummary(duelOf({ status: 'drawn' }), 'me')).toEqual({ text: "It's a draw", outcome: 'drawn' });
  });
  it('formats the clock', () => {
    expect(formatSeconds(60_000)).toBe('1:00');
    expect(formatSeconds(8_200)).toBe('0:09');
  });
});

describe('NoughtsGame', () => {
  const props = (over: Partial<Parameters<typeof NoughtsGame>[0]> = {}) => ({
    uid: 'me', coins: 45, participants: PEOPLE, duels: [] as DuelView[], duel: vi.fn(async (_: DuelMove) => {}), ...over,
  });
  it('challenges someone free, with a stake up to your own coins', async () => {
    const p = props({ duels: [duelOf({ challenger: { uid: 'alex', name: 'Alex' }, opponent: { uid: 'priya', name: 'Priya' } })] });
    render(<NoughtsGame {...p} />);
    expect(screen.getByRole('radio', { name: /Alex/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: /Sam/ }));
    for (let i = 0; i < 12; i++) fireEvent.click(screen.getByRole('button', { name: 'Raise the stake' }));
    expect(screen.getByRole('button', { name: 'Raise the stake' })).toBeDisabled();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send challenge' })); });
    expect(p.duel).toHaveBeenCalledWith({ operation: 'challenge', opponent: 'sam', stake: 45 });
    expect(screen.getByRole('button', { name: 'Watch' })).toBeInTheDocument();
  });
  it('keeps the stake out of sight without coins', () => {
    render(<NoughtsGame {...props({ coins: 0 })} />);
    expect(screen.queryByText('Stake')).not.toBeInTheDocument();
  });
  it('plays a square on your turn only', async () => {
    const p = props({ duels: [duelOf({ board: ['X', null, null, null, 'O', null, null, null, null] })] });
    const { rerender } = render(<NoughtsGame {...p} />);
    expect(screen.getByRole('button', { name: 'Square 1, X' })).toBeDisabled();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Square 9' })); });
    expect(p.duel).toHaveBeenCalledWith({ operation: 'move', id: 'd1', cell: 8 });
    rerender(<NoughtsGame {...p} duels={[duelOf({ turn: 'sam' })]} />);
    expect(screen.getByRole('button', { name: 'Square 9' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent("Sam's move");
  });
  it("won't accept a stake you can't cover", () => {
    render(<NoughtsGame {...props({ uid: 'sam', coins: 10, duels: [duelOf({ status: 'offered', stake: 20, turn: undefined })] })} />);
    expect(screen.getByRole('button', { name: 'You need 🪙 20' })).toBeDisabled();
  });
  it('shows the result and what it paid, then offers a new challenge', () => {
    render(<NoughtsGame {...props({ duels: [duelOf({ status: 'won', winner: 'me', reason: 'line', line: [0, 4, 8], paid: { me: 55, sam: 5 } })] })} />);
    expect(screen.getByRole('status')).toHaveTextContent('You won');
    expect(screen.getByText('+55 coins')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'New challenge' }));
    expect(screen.getByRole('button', { name: 'Send challenge' })).toBeInTheDocument();
  });
});

describe('ChallengeCard', () => {
  it('shows who and what is at stake, and answers', async () => {
    const answer = vi.fn(async (_: boolean) => {});
    render(<ChallengeCard duel={duelOf({ status: 'offered', stake: 20, challenger: { uid: 'sam', name: 'Sam' }, opponent: { uid: 'me', name: 'Me' }, offerLeftMs: 30_000 })} coins={45} onAnswer={answer} top={80} />);
    expect(screen.getByText('Sam challenges you')).toBeInTheDocument();
    expect(screen.getByText(/20 each, winner takes both/)).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveAccessibleName('0:30 left to answer');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Accept' })); });
    expect(answer).toHaveBeenCalledWith(true);
  });
  it('renders nothing without a challenge', () => {
    const { container } = render(<ChallengeCard duel={null} coins={0} onAnswer={async () => {}} top={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});
