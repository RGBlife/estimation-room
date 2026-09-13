import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoomConnection } from './roomConnection.ts';
import { randomAvatar } from '../../features/avatar/avatar.ts';

class Socket {
  static OPEN = 1;
  static instances: Socket[] = [];
  readyState = 1;
  bufferedAmount = 0;
  sent: { id?: string; action?: string; token?: string; data?: unknown }[] = [];
  onopen?: () => void;
  onmessage?: (event: { data: string }) => void;
  onclose?: (event: { code: number; reason: string }) => void;
  onerror?: () => void;
  constructor() { Socket.instances.push(this); }
  send(value: string) { this.sent.push(JSON.parse(value)); }
  close(code = 1000, reason = '') { this.readyState = 3; this.onclose?.({ code, reason }); }
  receive(value: object) { this.onmessage?.({ data: JSON.stringify(value) }); }
}
let stop: (() => void) | undefined;
beforeEach(() => {
  sessionStorage.clear(); Socket.instances = [];
  vi.stubGlobal('WebSocket', Socket);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ uid: 'u1', token: 'signed-token' }) }));
});
afterEach(() => { stop?.(); stop = undefined; vi.useRealTimers(); vi.unstubAllGlobals(); });
async function setup() {
  const receive = vi.fn(), error = vi.fn(), identity = vi.fn();
  const connection = new RoomConnection(receive, error, identity);
  stop = connection.start();
  await vi.waitFor(() => expect(Socket.instances).toHaveLength(1));
  const socket = Socket.instances[0]; socket.onopen?.(); socket.receive({ type: 'ready', uid: 'u1' });
  return { connection, socket, receive, error, identity };
}
describe('room connection', () => {
  it('authenticates before setting identity and waits for command acknowledgement', async () => {
    const { connection, socket, identity } = await setup();
    expect(socket.sent[0]).toEqual({ token: 'signed-token' });
    expect(identity).toHaveBeenCalledWith('u1');
    const result = connection.command('vote', { value: '5' });
    const id = socket.sent.at(-1)!.id;
    socket.receive({ type: 'ack', id });
    await expect(result).resolves.toMatchObject({ id });
  });
  it('surfaces server rejections without mutating room state', async () => {
    const { connection, socket, receive } = await setup();
    const result = connection.command('join', { code: 'ZZZZ' });
    const assertion = expect(result).rejects.toThrow('Room not found');
    socket.receive({ type: 'ack', id: socket.sent.at(-1)!.id, error: 'Room not found' });
    await assertion; expect(receive).not.toHaveBeenCalled();
  });
  it('restores membership after reconnect without replaying an uncertain vote', async () => {
    const { connection, socket } = await setup(); vi.useFakeTimers();
    connection.rememberRoom('ABCD', { name: 'Sam', avatar: randomAvatar(), isObserver: false, deck: 'fibonacci' });
    const vote = connection.command('vote', { value: '5' });
    const assertion = expect(vote).rejects.toThrow('Connection interrupted');
    socket.close(); await assertion;
    await vi.advanceTimersByTimeAsync(1000);
    const replacement = Socket.instances[1]; replacement.onopen?.(); replacement.receive({ type: 'ready', uid: 'u1' });
    expect(replacement.sent.filter(s => s.action).map(s => s.action)).toEqual(['join']);
    replacement.receive({ type: 'ack', id: replacement.sent.at(-1)!.id, code: 'ABCD' });
  });
  it('bounds outgoing traffic and expires unanswered requests', async () => {
    const { connection, socket } = await setup(); vi.useFakeTimers();
    socket.bufferedAmount = 70000;
    await expect(connection.command('vote')).rejects.toThrow('Connection is busy');
    socket.bufferedAmount = 0;
    const result = connection.command('vote');
    const assertion = expect(result).rejects.toThrow('Request timed out');
    await vi.advanceTimersByTimeAsync(10000); await assertion;
  });
  it('does not create a socket from an abandoned initialization', async () => {
    const connection = new RoomConnection(vi.fn(), vi.fn(), vi.fn());
    const cleanup = connection.start(); cleanup();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(Socket.instances).toHaveLength(0);
  });
  it('honours server cooldowns and keeps the existing identity', async () => {
    const { socket } = await setup(); vi.useFakeTimers();
    socket.close(1013, 'retry:30000');
    await vi.advanceTimersByTimeAsync(29999);
    expect(Socket.instances).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(Socket.instances).toHaveLength(2);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('backs off repeated short connections instead of restarting the retry delay', async () => {
    const { socket } = await setup(); vi.useFakeTimers();
    socket.close(); await vi.advanceTimersByTimeAsync(1000);
    const second = Socket.instances[1]; second.onopen?.(); second.receive({ type: 'ready', uid: 'u1' });
    second.close(); await vi.advanceTimersByTimeAsync(750);
    expect(Socket.instances).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(600);
    expect(Socket.instances).toHaveLength(3);
  });
  it('shares session issuance during development remounts', async () => {
    const connection = new RoomConnection(vi.fn(), vi.fn(), vi.fn());
    const cleanup = connection.start(); cleanup(); stop = connection.start();
    await vi.waitFor(() => expect(Socket.instances).toHaveLength(1));
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('respects Retry-After from session issuance', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 429, headers: new Headers({ 'Retry-After': '10' }) } as Response);
    const connection = new RoomConnection(vi.fn(), vi.fn(), vi.fn()); stop = connection.start();
    await vi.advanceTimersByTimeAsync(9999); expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000); expect(fetch).toHaveBeenCalledTimes(2);
  });

});
