import { beforeEach, describe, expect, it, vi } from 'vitest';
import { randomAvatar } from '../avatar/avatar.ts';
const mock = vi.hoisted(() => ({ command: vi.fn(), remember: vi.fn(), forget: vi.fn(), update: vi.fn() }));
vi.mock('../../shared/lib/roomConnection.ts', () => ({ RoomConnection: class {
  connected = true;
  command = mock.command;
  rememberRoom = mock.remember;
  forgetRoom = mock.forget;
  updateProfile = mock.update;
  start = () => () => {};
} }));
const { useRoomStore } = await import('./roomStore.ts');
beforeEach(() => { vi.clearAllMocks(); mock.command.mockResolvedValue({ code: 'ABCD' }); useRoomStore.setState({ uid: 'u1', room: null, roomCode: null, throws: [], error: null }); });
describe('room API store', () => {
  it('normalizes profiles and remembers membership only after acknowledgement', async () => {
    const profile = { name: 'Sam', avatar: randomAvatar(), isObserver: false, deck: 'fibonacci' as const };
    await expect(useRoomStore.getState().createRoom(profile)).resolves.toBe('ABCD');
    expect(mock.command).toHaveBeenCalledWith('create', profile);
    expect(mock.remember).toHaveBeenCalledWith('ABCD', profile);
    expect(useRoomStore.getState().roomCode).toBe('ABCD');
  });
  it('does not remember a rejected join', async () => {
    mock.command.mockRejectedValueOnce(new Error('Room not found'));
    await expect(useRoomStore.getState().joinRoom('ABCD', { name: 'Sam', avatar: randomAvatar(), isObserver: false, deck: 'fibonacci' })).rejects.toThrow('Room not found');
    expect(mock.remember).not.toHaveBeenCalled();
  });
  it('lets the server atomically reset round and table damage', async () => {
    mock.command.mockRejectedValueOnce(new Error('Not in room'));
    await expect(useRoomStore.getState().startNextRound()).rejects.toThrow('Not in room');
    expect(mock.command).toHaveBeenCalledExactlyOnceWith('next', {});
  });
  it('leaves locally even when the server cannot acknowledge', async () => {
    useRoomStore.setState({ roomCode: 'ABCD', room: { code: 'ABCD' } as never });
    mock.command.mockRejectedValueOnce(new Error('Disconnected'));
    await expect(useRoomStore.getState().leave()).rejects.toThrow('Disconnected');
    expect(mock.forget).toHaveBeenCalled();
    expect(useRoomStore.getState().room).toBeNull();
    expect(useRoomStore.getState().roomCode).toBeNull();
  });
  it('peeks a room without joining it, reporting a missing room as null', async () => {
    mock.command.mockResolvedValueOnce({ room: { participants: [{ name: 'Sam', isObserver: false }] } });
    await expect(useRoomStore.getState().peekRoom('abcd')).resolves.toEqual({ participants: [{ name: 'Sam', isObserver: false }] });
    expect(mock.command).toHaveBeenCalledExactlyOnceWith('peek', { code: 'ABCD' });
    mock.command.mockResolvedValueOnce({ room: null });
    await expect(useRoomStore.getState().peekRoom('ZZZZ')).resolves.toBeNull();
    expect(mock.remember).not.toHaveBeenCalled();
    expect(useRoomStore.getState().roomCode).toBeNull();
  });
  it('clears own wasted state when starting a drive and throttles unchanged positions', () => {
    const state = useRoomStore.getState();
    state.startDrive();
    const pose = { x: .2, y: .3, r: 0, t: Date.now(), phase: 'driving' };
    for (let i = 0; i < 60; i++) state.publishDrive(pose);
    expect(mock.command.mock.calls.filter(([action]) => action === 'drive')).toHaveLength(1);
    expect(mock.command).toHaveBeenCalledWith('startDrive', {});
  });
});

it('sends normalized renames and clearing, validates length and propagates rejection', async () => {
  await useRoomStore.getState().renameRoom('  Platform  ');
  expect(mock.command).toHaveBeenLastCalledWith('rename', { teamName: 'Platform' });
  await useRoomStore.getState().renameRoom('  ');
  expect(mock.command).toHaveBeenLastCalledWith('rename', { teamName: null });
  mock.command.mockClear();
  await expect(useRoomStore.getState().renameRoom('x'.repeat(41))).rejects.toThrow('40');
  expect(mock.command).not.toHaveBeenCalled();
  mock.command.mockRejectedValueOnce(new Error('Only the room creator can rename it'));
  await expect(useRoomStore.getState().renameRoom('Guest')).rejects.toThrow('creator');
});
