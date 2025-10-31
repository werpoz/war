import { SessionProvider } from '../../../domain/session.provider';
import { SessionStrategy, SessionBaileys } from '../strategy/session.strategy';

type SessionRecord = SessionBaileys & {
  status?: string;
  qrCode?: string;
};

export class BaileysSessionProvider implements SessionProvider {
  private sessions = new Map<string, SessionRecord>();
  private readonly strategy: SessionStrategy;

  async initialize(sessionId: string) {
    if (this.sessions.has(sessionId)) return;

    const session = await this.strategy.execute(sessionId);

    this.sessions.set(sessionId, {
      socket: session.socket,
      saveCreds: session.saveCreds,
      status: 'connecting',
      qrCode: '',
    });
  }

  connect(sessionId: string): Promise<void> {
    return this.initialize(sessionId);
  }

  get(sessionId: string) {
    return this.sessions.get(sessionId);
  }

  async disconnect(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    await session.socket.ws.close();
    this.sessions.delete(sessionId);
  }

  async delete(sessionId: string) {
    await this.disconnect(sessionId);
  }

  async getQRCode(sessionId: string) {
    return Promise.resolve(this.sessions.get(sessionId)?.qrCode ?? '');
  }

  async getStatus(sessionId: string) {
    return Promise.resolve(this.sessions.get(sessionId)?.status ?? 'close');
  }

  async update(sessionId: string, patch: Partial<SessionRecord>) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    this.sessions.set(sessionId, { ...session, ...patch });
    return Promise.resolve();
  }
}
