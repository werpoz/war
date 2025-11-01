import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import makeWASocket, {
  AuthenticationState,
  Browsers,
  type BaileysEventMap,
} from '@whiskeysockets/baileys';
import { BaileysLoggerAdapter } from './baileys-logger.adapter';

export type SocketWA = ReturnType<typeof makeWASocket>;
export type SessionBaileys = {
  socket: SocketWA;
  auth: AuthenticationState;
  saveCreds: () => Promise<void>;
  clearStorage?: () => Promise<void>;
  qrCode?: string;
  status?: string;
  handlers?: SessionEventHandlers;
};

export type SessionEventHandlers = {
  creds: () => void;
  messages: (msg: BaileysEventMap['messages.upsert']) => void;
  connection: (update: BaileysEventMap['connection.update']) => void;
};

@Injectable()
export class BaileysSessionProvider {
  private readonly sessions = new Map<string, SessionBaileys>();
  private readonly logger: BaileysLoggerAdapter;

  constructor(private readonly configService: ConfigService) {
    const debugEnv = this.configService.get<string>('BAILEYS_DEBUG');
    const structuredEnv = this.configService.get<string>('LOG_FORMAT');
    this.logger = new BaileysLoggerAdapter(BaileysSessionProvider.name, {
      debug: ['true', '1', 'on'].includes((debugEnv ?? '').toLowerCase()),
      structured: (structuredEnv ?? '').toLowerCase() === 'json',
    });
  }

  async createWithAuth(
    sessionId: string,
    auth: AuthenticationState,
    saveCreds: () => Promise<void>,
    clearStorage?: () => Promise<void>,
  ) {
    if (this.sessions.has(sessionId)) return this.sessions.get(sessionId)!;

    const socket = this.createSocket(auth, sessionId);

    const rec: SessionBaileys = {
      socket,
      auth,
      saveCreds,
      clearStorage,
      status: 'connecting',
      qrCode: '',
      handlers: undefined,
    };
    this.sessions.set(sessionId, rec);
    return Promise.resolve(rec);
  }

  async get(sessionId: string): Promise<SessionBaileys | undefined> {
    return Promise.resolve(this.sessions.get(sessionId));
  }

  async restart(sessionId: string): Promise<SessionBaileys | undefined> {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    this.detachHandlers(sessionId, session);
    await this.closeSocket(sessionId, session);

    const socket = this.createSocket(session.auth, sessionId);
    const updated: SessionBaileys = {
      ...session,
      socket,
      status: 'connecting',
      qrCode: '',
      handlers: undefined,
    };
    this.sessions.set(sessionId, updated);
    return updated;
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
    const session = this.sessions.get(sessionId);
    if (!session) return;
    this.detachHandlers(sessionId, session);
    await this.closeSocket(sessionId, session);
    this.sessions.delete(sessionId);
  }

  async logout(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      this.detachHandlers(sessionId, session);
      await session.socket.logout();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.child({ sessionId }).error({ err }, 'Logout failed');
    } finally {
      await this.closeSocket(sessionId, session);
      if (session.clearStorage) {
        try {
          await session.clearStorage();
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          this.logger
            .child({ sessionId })
            .warn({ err }, 'Failed to clear auth storage');
        }
      }
      this.sessions.delete(sessionId);
    }
  }

  attachHandlers(sessionId: string, handlers: SessionEventHandlers): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    this.detachHandlers(sessionId, session);

    session.socket.ev.on('creds.update', handlers.creds);
    session.socket.ev.on('messages.upsert', handlers.messages);
    session.socket.ev.on('connection.update', handlers.connection);

    session.handlers = handlers;
    this.sessions.set(sessionId, session);
  }

  private createSocket(auth: AuthenticationState, sessionId: string): SocketWA {
    return makeWASocket({
      auth,
      browser: Browsers.macOS('Chrome'),
      qrTimeout: 60_000,
      logger: this.logger.child({ sessionId }),
    });
  }

  private detachHandlers(sessionId: string, session: SessionBaileys): void {
    if (!session.handlers) return;

    const { handlers } = session;
    session.socket.ev.off('creds.update', handlers.creds);
    session.socket.ev.off('messages.upsert', handlers.messages);
    session.socket.ev.off('connection.update', handlers.connection);

    session.handlers = undefined;
    this.sessions.set(sessionId, session);
  }

  private async closeSocket(
    sessionId: string,
    session: SessionBaileys,
  ): Promise<void> {
    const ws = session.socket.ws;
    if (!ws) return;

    try {
      if (typeof ws.close === 'function') {
        await ws.close();
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.child({ sessionId }).warn({ err }, 'WebSocket close failed');
    }
  }
}
