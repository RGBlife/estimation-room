import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import JoinScreen from './JoinScreen.tsx';
import { randomAvatar } from '../avatar/avatar.ts';
import type { PeekRoom } from './useRoomStatuses.ts';

function seedRecentRoom(code: string) {
  localStorage.setItem('sp_recent_rooms_v1', JSON.stringify([{ code, lastSeenAt: Date.now(), createdByMe: false, people: [{ name: 'Sam', avatar: randomAvatar() }] }]));
}

function baseProps() {
  return {
    onJoin: vi.fn().mockResolvedValue(true),
    onCreate: vi.fn().mockResolvedValue(true),
    joinError: null as string | null,
    notice: null as string | null,
    prefillRoomCode: null as string | null,
    ready: true,
    theme: 'dark' as const,
    onToggleTheme: vi.fn(),
    peekRoom: undefined as PeekRoom | undefined,
  };
}

function renderJoinScreen(overrides: Partial<ReturnType<typeof baseProps>> = {}) {
  const props = { ...baseProps(), ...overrides };
  return { ...render(<JoinScreen {...props} />), props };
}

describe('JoinScreen', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts in join mode with the join button disabled until a name and room code are entered', () => {
    renderJoinScreen();
    expect(screen.getByText('Join room')).toBeDisabled();
  });

  it('enables the submit button once a name and room code are present, and calls onJoin', async () => {
    const user = userEvent.setup();
    const { props } = renderJoinScreen();

    await user.type(screen.getByPlaceholderText('e.g. Sam Rivera'), 'Ada');
    await user.type(screen.getByPlaceholderText('Enter your room code'), 'abcd');

    const submit = screen.getByText('Join room');
    expect(submit).toBeEnabled();
    await user.click(submit);

    expect(props.onJoin).toHaveBeenCalledOnce();
    const [code, payload] = props.onJoin.mock.calls[0];
    expect(code).toBe('ABCD'); // uppercased by handleRoomCodeChange
    expect(payload).toMatchObject({ name: 'Ada', isObserver: false });
    expect(payload.avatar).toBeTruthy();
  });

  it('switches to create mode, generates a room code, and calls onCreate on submit', async () => {
    const user = userEvent.setup();
    const { props } = renderJoinScreen();

    await user.click(screen.getByText('or create a new room'));
    expect(screen.getByText('or join an existing room')).toBeInTheDocument();
    expect(screen.getByText('Create room')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('e.g. Sam Rivera'), 'Ada');
    await user.click(screen.getByText('Create room'));

    expect(props.onCreate).toHaveBeenCalledOnce();
    const [payload] = props.onCreate.mock.calls[0];
    expect(payload.name).toBe('Ada');
  });

  it('shows the deck picker only in create mode, defaulting to Fibonacci', async () => {
    const user = userEvent.setup();
    renderJoinScreen();
    expect(screen.queryByText('Estimation deck')).not.toBeInTheDocument();

    await user.click(screen.getByText('or create a new room'));
    expect(screen.getByText('Estimation deck')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fibonacci' })).toHaveClass('bg-sp-accent');
  });

  it('includes the picked deck in the create payload', async () => {
    const user = userEvent.setup();
    const { props } = renderJoinScreen();

    await user.click(screen.getByText('or create a new room'));
    await user.click(screen.getByRole('button', { name: 'T-shirt' }));
    await user.type(screen.getByPlaceholderText('e.g. Sam Rivera'), 'Ada');
    await user.click(screen.getByText('Create room'));

    const [payload] = props.onCreate.mock.calls[0];
    expect(payload.deck).toBe('tshirt');
  });

  it('sets isObserver true on the submitted payload when Observer role is selected', async () => {
    const user = userEvent.setup();
    const { props } = renderJoinScreen();

    await user.type(screen.getByPlaceholderText('e.g. Sam Rivera'), 'Ada');
    await user.type(screen.getByPlaceholderText('Enter your room code'), 'ABCD');
    await user.click(screen.getByText('Observer'));
    await user.click(screen.getByText('Join room'));

    const [, payload] = props.onJoin.mock.calls[0];
    expect(payload.isObserver).toBe(true);
  });

  it('remembers the observer role from a previous session', async () => {
    const user = userEvent.setup();
    localStorage.setItem('sp_profile', JSON.stringify({
      name: 'Ada', avatar: { seed: 'abc' }, isObserver: true,
    }));
    const { props } = renderJoinScreen();

    expect(screen.getByText('Observer')).toHaveClass('text-sp-bg');

    await user.type(screen.getByPlaceholderText('Enter your room code'), 'ABCD');
    await user.click(screen.getByText('Join room'));

    const [, payload] = props.onJoin.mock.calls[0];
    expect(payload.isObserver).toBe(true);
  });

  it('shows "Connecting…" instead of the mode label while not ready', () => {
    renderJoinScreen({ ready: false });
    expect(screen.getByText('Connecting…')).toBeInTheDocument();
  });

  it('renders a join error message', () => {
    renderJoinScreen({ joinError: 'Room not found' });
    expect(screen.getByText('Room not found')).toBeInTheDocument();
  });

  it('renders a notice only when there is no error', () => {
    const { rerender, props } = renderJoinScreen({ notice: 'This room was closed.' });
    expect(screen.getByText('This room was closed.')).toBeInTheDocument();

    rerender(<JoinScreen {...props} notice="This room was closed." joinError="Room not found" />);
    expect(screen.queryByText('This room was closed.')).not.toBeInTheDocument();
    expect(screen.getByText('Room not found')).toBeInTheDocument();
  });

  it('shows the decorative hand until this device has been in a room', () => {
    renderJoinScreen();
    expect(screen.queryByRole('heading', { name: 'Your recent rooms' })).not.toBeInTheDocument();
  });

  it('rejoins a recent room in one tap with the saved name, look and role', async () => {
    const user = userEvent.setup();
    localStorage.setItem('sp_profile', JSON.stringify({ name: 'Ada', avatar: randomAvatar(), isObserver: true }));
    seedRecentRoom('ABCD');
    const peekRoom = vi.fn().mockResolvedValue({ participants: [{ name: 'Sam', isObserver: false }] });
    const { props } = renderJoinScreen({ peekRoom });

    expect(screen.getByRole('heading', { name: 'Your recent rooms' })).toBeInTheDocument();
    await screen.findByText('1 here');
    expect(peekRoom).toHaveBeenCalledExactlyOnceWith('ABCD');
    await user.click(screen.getByRole('button', { name: /Rejoin room ABCD/ }));

    expect(props.onJoin).toHaveBeenCalledOnce();
    const [code, payload] = props.onJoin.mock.calls[0];
    expect(code).toBe('ABCD');
    expect(payload).toMatchObject({ name: 'Ada', isObserver: true });
  });

  it('fills in the form instead when there is no saved name yet', async () => {
    const user = userEvent.setup();
    seedRecentRoom('ABCD');
    const { props } = renderJoinScreen();

    await user.click(screen.getByRole('button', { name: /Rejoin room ABCD/ }));

    expect(props.onJoin).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText('Enter your room code')).toHaveValue('ABCD');
    expect(screen.getByPlaceholderText('e.g. Sam Rivera')).toHaveFocus();
  });

  it('asks about the room again when a rejoin is refused', async () => {
    const user = userEvent.setup();
    localStorage.setItem('sp_profile', JSON.stringify({ name: 'Ada', avatar: randomAvatar() }));
    seedRecentRoom('ABCD');
    const peekRoom = vi.fn().mockResolvedValueOnce({ participants: [] }).mockResolvedValueOnce(null);
    renderJoinScreen({ peekRoom, onJoin: vi.fn().mockResolvedValue(false) });

    await screen.findByText('Empty');
    await user.click(screen.getByRole('button', { name: /Rejoin room ABCD/ }));

    await screen.findByText('Closed');
    expect(peekRoom).toHaveBeenCalledTimes(2);
  });

  it('forgets a room from its card', async () => {
    const user = userEvent.setup();
    seedRecentRoom('ABCD');
    renderJoinScreen();

    await user.click(screen.getByRole('button', { name: 'Forget room ABCD' }));

    expect(screen.queryByRole('button', { name: /Rejoin room ABCD/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Your recent rooms' })).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('sp_recent_rooms_v1')!)).toEqual([]);
  });
});

it('offers remembered teams only on create and trims an optional name', async () => {
  localStorage.clear();
  localStorage.setItem('sp_recent_rooms_v1', JSON.stringify([{ code: 'ABCD', teamName: 'Platform', lastSeenAt: 1, people: [] }]));
  const user = userEvent.setup();
  const { props } = renderJoinScreen();
  expect(screen.queryByLabelText(/Team name/)).not.toBeInTheDocument();
  await user.type(screen.getByLabelText('Your name'), 'Ada');
  await user.click(screen.getByText('or create a new room'));
  const input = screen.getByLabelText(/Team name/);
  expect(input).toHaveAttribute('maxLength', '40');
  expect(document.querySelector('datalist option')).toHaveAttribute('value', 'Platform');
  await user.click(screen.getByText('Create room'));
  expect(props.onCreate.mock.calls[0][0]).not.toHaveProperty('teamName');
  await user.type(input, '   ');
  await user.click(screen.getByText('Create room'));
  expect(props.onCreate.mock.calls[1][0]).not.toHaveProperty('teamName');
  await user.type(input, 'Platform  ');
  await user.click(screen.getByText('Create room'));
  expect(props.onCreate.mock.calls[2][0].teamName).toBe('Platform');
});
