import makeWASocket, {
  AuthenticationState,
  Browsers,
} from '@whiskeysockets/baileys';

export type SocketWA = ReturnType<typeof makeWASocket>;
export type SessionBaileys = {
  socket: SocketWA;
  saveCreds: () => Promise<void>;
  qrCode?: string;
  status?: string;
};

export class BaileysSessionProvider {
  private sessions = new Map<string, SessionBaileys>();

  async createWithAuth(
    sessionId: string,
    auth: AuthenticationState,
    saveCreds: () => Promise<void>,
  ) {
    if (this.sessions.has(sessionId)) return this.sessions.get(sessionId)!;

    const socket = makeWASocket({
      auth,
      browser: Browsers.macOS('Chrome'),
      qrTimeout: 60_000,
    });

    const rec: SessionBaileys = {
      socket,
      saveCreds,
      status: 'connecting',
      qrCode: '',
    };
    this.sessions.set(sessionId, rec);
    return Promise.resolve(rec);
  }

  async get(sessionId: string): Promise<SessionBaileys | undefined> {
    return Promise.resolve(this.sessions.get(sessionId));
  }

  async update(
    sessionId: string,
    patch: Partial<SessionBaileys>,
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    this.sessions.set(sessionId, { ...session, ...patch });
    return Promise.resolve();
  }

  async disconnect(sessionId: string) {
    const s = this.sessions.get(sessionId);
    if (!s) return;
    await s.socket.ws.close();
    this.sessions.delete(sessionId);
  }
}
