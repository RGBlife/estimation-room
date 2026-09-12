import type { JoinPayload, RoomDoc } from '../../types/room.ts';
import type { ThrowEvent } from '../../types/throws.ts';
import type { DriverState, TableCrackEvent, TablePieceMove, WastedMap } from '../../types/gta.ts';

type Message =
  | { type: 'ready'; uid: string }
  | { type: 'ack'; id: string; code?: string; error?: string }
  | { type: 'room'; room: RoomDoc }
  | { type: 'throw'; item: ThrowEvent }
  | { type: 'driver'; uid: string; driver: DriverState | null }
  | { type: 'drivers'; drivers: Record<string, DriverState> }
  | { type: 'crack'; item: TableCrackEvent }
  | { type: 'table'; tableCracks: TableCrackEvent[]; tablePieceMove: { left: TablePieceMove; right: TablePieceMove }; tableWasted: WastedMap }
  | { type: 'closed'; reason: string };
type Ack = Extract<Message, { type: 'ack' }>;
const SESSION_KEY = 'sp_session_v1';

// One authenticated connection per tab. Mutations are acknowledged and never
// blindly replayed after a disconnect; only room membership is restored.
export class RoomConnection {
  private socket: WebSocket | null = null;
  private active = false;
  private ready = false;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private heartbeat?: ReturnType<typeof setInterval>;
  private generation = 0;
  private attempts = 0;
  private session: { uid: string; token: string } | null = null;
  private room: { code: string; payload: JoinPayload } | null = null;
  private pending = new Map<string, { resolve: (ack: Ack) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private base = (import.meta.env.VITE_API_URL || window.location.origin).replace(/\/$/, '');
  constructor(private receive: (message: Message) => void, private error: (message: string | null) => void, private identity: (uid: string) => void) {}
  get connected() { return this.ready && this.socket?.readyState === WebSocket.OPEN; }
  start() {
    this.active = true;
    void this.connect();
    return () => {
      this.active = false; this.generation++;
      clearTimeout(this.reconnectTimer); clearInterval(this.heartbeat);
      this.socket?.close(); this.socket = null; this.ready = false;
      this.rejectPending();
    };
  }
  rememberRoom(code: string, payload: JoinPayload) { this.room = { code, payload }; }
  updateProfile(payload: Partial<JoinPayload>) { if (this.room) this.room.payload = { ...this.room.payload, ...payload }; }
  forgetRoom() { this.room = null; }
  private rejectPending() {
    for (const request of this.pending.values()) { clearTimeout(request.timer); request.reject(new Error('Connection interrupted. Please try again.')); }
    this.pending.clear();
  }
  private async connect() {
    const generation = ++this.generation;
    try {
      if (!this.session) {
        try { this.session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch { /* private browsing */ }
        if (!this.session?.token || !this.session.uid) {
          const response = await fetch(`${this.base}/api/session`, { method: 'POST', signal: AbortSignal.timeout(10000) });
          if (!response.ok) throw new Error('Unable to connect. Please try again shortly.');
          this.session = await response.json();
          try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(this.session)); } catch { /* in-memory identity */ }
        }
      }
      if (!this.active || generation !== this.generation) return;
      const session = this.session!;
      const url = new URL(`${this.base}/api/connect`); url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(url);
      this.socket = socket;
      let authenticated = false;
      const authTimeout = setTimeout(() => socket.close(), 12000);
      socket.onopen = () => socket.send(JSON.stringify({ token: session.token }));
      socket.onmessage = event => {
        if (generation !== this.generation) return;
        const message = JSON.parse(event.data) as Message;
        if (message.type === 'ready') {
          authenticated = true; clearTimeout(authTimeout); this.ready = true; this.attempts = 0;
          this.identity(message.uid); this.error(null);
          clearInterval(this.heartbeat);
          this.heartbeat = setInterval(() => { void this.command('ping').catch(() => socket.close()); }, 25000);
          if (this.room) void this.command('join', { ...this.room.payload, code: this.room.code }).catch(error => {
            // A transport failure can recover. A server rejection means the
            // room expired or is unavailable, so leave the stale screen.
            if (!this.connected) return;
            this.room = null;
            this.receive({ type: 'closed', reason: error.message });
          });
        } else if (message.type === 'ack') {
          const request = this.pending.get(message.id);
          if (request) {
            clearTimeout(request.timer); this.pending.delete(message.id);
            if (message.error) request.reject(new Error(message.error)); else request.resolve(message);
          }
        } else this.receive(message);
      };
      socket.onclose = () => {
        clearTimeout(authTimeout);
        if (generation !== this.generation) return;
        this.ready = false; clearInterval(this.heartbeat); this.rejectPending();
        if (!authenticated) { this.session = null; try { sessionStorage.removeItem(SESSION_KEY); } catch { /* storage unavailable */ } }
        this.retry();
      };
      socket.onerror = () => socket.close();
    } catch (error) {
      if (generation !== this.generation) return;
      this.error(error instanceof Error ? error.message : 'Unable to connect'); this.retry();
    }
  }
  private retry() {
    if (!this.active) return;
    this.error('Connection lost. Reconnecting…');
    this.reconnectTimer = setTimeout(() => { void this.connect(); }, Math.min(30000, 500 * 2 ** this.attempts++) + Math.random() * 250);
  }
  command(action: string, data: object = {}): Promise<Ack> {
    if (!this.connected) return Promise.reject(new Error('Not connected yet. Please try again.'));
    if (this.pending.size >= 64 || this.socket!.bufferedAmount > 65536) return Promise.reject(new Error('Connection is busy. Please try again.'));
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('Request timed out. Please try again.')); }, 10000);
      this.pending.set(id, { resolve, reject, timer });
      this.socket!.send(JSON.stringify({ id, action, data }));
    });
  }
}
