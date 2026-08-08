import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import JoinScreen from './JoinScreen.tsx';

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
});
