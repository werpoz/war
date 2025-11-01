import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import makeWASocket, {
  AuthenticationState,
  Browsers,
} from '@whiskeysockets/baileys';
import { BaileysLoggerAdapter } from './baileys-logger.adapter';

export type SocketWA = ReturnType<typeof makeWASocket>;
export type SessionBaileys = {
  socket: SocketWA;
  saveCreds: () => Promise<void>;
  qrCode?: string;
  status?: string;
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
  ) {
    if (this.sessions.has(sessionId)) return this.sessions.get(sessionId)!;

    const socket = makeWASocket({
      auth,
      browser: Browsers.macOS('Chrome'),
      qrTimeout: 60_000,
      logger: this.logger.child({ sessionId }),
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
