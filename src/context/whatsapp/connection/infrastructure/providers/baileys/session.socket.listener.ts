// infrastructure/providers/baileys/session.socket.listener.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DisconnectReason,
  type BaileysEventMap,
} from '@whiskeysockets/baileys';
import {
  BaileysSessionProvider,
  type SessionBaileys,
  type SessionEventHandlers,
} from './baileys-session.provider';
import { SessionRepository } from '../../../domain/repository/session.repository';

@Injectable()
export class SessionSocketListener {
  private readonly logger = new Logger(SessionSocketListener.name);
  private readonly boundSessions = new Set<string>();
  private readonly pendingPairing = new Map<string, string>();

  constructor(
    private readonly provider: BaileysSessionProvider,
    private readonly events: EventEmitter2,
    @Inject('SESSION_REPOSITORY')
    private readonly sessionRepo: SessionRepository,
  ) {}

  async listen(sessionId: string, phone?: string): Promise<string | undefined> {
    const s = await this.provider.get(sessionId);
    if (!s) return;
    this.bindSessionEvents(sessionId, s);

    const normalizedPhone = phone?.trim();
    if (normalizedPhone) {
      this.pendingPairing.set(sessionId, normalizedPhone);
    } else {
      this.pendingPairing.delete(sessionId);
    }

    return new Promise<string | undefined>((resolve) => {
      let settled = false;
      const cleanupHandlers: Array<() => void> = [];
      const settle = (qr?: string) => {
        if (settled) return;
        settled = true;
        cleanupHandlers.forEach((fn) => fn());
        if (normalizedPhone) {
          this.pendingPairing.delete(sessionId);
        }
        resolve(qr);
      };

      if (s.qrCode) {
        settle(s.qrCode);
        return;
      }

      if (s.status === 'open') {
        settle(undefined);
        return;
      }

      const onQr = ({
        sessionId: sid,
        qr,
      }: {
        sessionId: string;
        qr: string;
      }) => {
        if (sid !== sessionId) return;
        settle(qr);
      };
      this.events.on('session.qr', onQr);
      cleanupHandlers.push(() => this.events.off('session.qr', onQr));

      const onStatus = ({
        sessionId: sid,
        status,
      }: {
        sessionId: string;
        status: string;
      }) => {
        if (sid !== sessionId) return;
        if (status === 'open') {
          settle(undefined);
        }
      };
      this.events.on('session.status', onStatus);
      cleanupHandlers.push(() => this.events.off('session.status', onStatus));

      const onClosed = ({ sessionId: sid }: { sessionId: string }) => {
        if (sid !== sessionId) return;
        settle(undefined);
      };
      this.events.on('session.closed', onClosed);
      cleanupHandlers.push(() => this.events.off('session.closed', onClosed));
    });
  }

  private bindSessionEvents(sessionId: string, session: SessionBaileys) {
    if (this.boundSessions.has(sessionId)) return;

    const handlers: SessionEventHandlers = {
      creds: () => {
        void session.saveCreds();
      },
      messages: (msg: BaileysEventMap['messages.upsert']) => {
        this.events.emit('session.message', { sessionId, msg });
      },
      connection: (update: BaileysEventMap['connection.update']) => {
        void this.handleConnectionUpdate(sessionId, session, update);
      },
    };

    this.provider.attachHandlers(sessionId, handlers);
    this.boundSessions.add(sessionId);
  }

  private async handleConnectionUpdate(
    sessionId: string,
    session: SessionBaileys,
    update: BaileysEventMap['connection.update'],
  ) {
    const { connection, qr } = update;

    if (connection) {
      if (connection === 'connecting') {
        await this.sessionRepo.updateStatus(sessionId, 'starting');
      }
      if (connection === 'open') {
        await this.sessionRepo.updateStatus(sessionId, 'ready');
      }
      await this.provider.update(sessionId, { status: connection });
      this.events.emit('session.status', { sessionId, status: connection });
    }

    if (qr) {
      await this.provider.update(sessionId, { qrCode: qr });
      this.events.emit('session.qr', { sessionId, qr });
    }

    const phone = this.pendingPairing.get(sessionId);
    if (connection === 'connecting' && phone) {
      try {
        const code = await session.socket.requestPairingCode(phone);
        await this.provider.update(sessionId, { qrCode: code });
        this.events.emit('session.qr', { sessionId, qr: code });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        this.logger.error(
          `Failed to request pairing code: ${error.message}`,
          error.stack,
        );
      } finally {
        this.pendingPairing.delete(sessionId);
      }
    }

    if (connection === 'open') {
      this.pendingPairing.delete(sessionId);
    }

    if (connection === 'close') {
      this.pendingPairing.delete(sessionId);
      const statusCode = this.extractDisconnectCode(update);

      if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
        await this.provider.logout(sessionId);
        await this.sessionRepo.updateStatus(sessionId, 'removed');
        this.events.emit('session.removed', { sessionId });
        this.boundSessions.delete(sessionId);
        return;
      }

      if (statusCode === DisconnectReason.restartRequired) {
        this.logger.log(`Restart required; recreating socket for ${sessionId}`);
        const restarted = await this.provider.restart(sessionId);
        if (restarted) {
          this.boundSessions.delete(sessionId);
          this.bindSessionEvents(sessionId, restarted);
          await this.sessionRepo.updateStatus(sessionId, 'starting');
          this.events.emit('session.status', {
            sessionId,
            status: 'connecting',
          });
          return;
        }
        this.logger.warn(
          `Restart required but session ${sessionId} could not be recreated`,
        );
      }

      await this.provider.disconnect(sessionId);
      await this.sessionRepo.updateStatus(sessionId, 'closed');
      this.events.emit('session.closed', { sessionId });
      this.boundSessions.delete(sessionId);
    }
  }

  private extractDisconnectCode(
    update: BaileysEventMap['connection.update'],
  ): number | undefined {
    const error = update.lastDisconnect?.error as
      | {
          output?: {
            statusCode?: number | string;
            payload?: Record<string, unknown>;
          };
        }
      | { statusCode?: number | string; data?: Record<string, unknown> }
      | undefined;
    if (!error) return undefined;

    const output = 'output' in error ? error.output : undefined;
    const payload = output?.payload as
      | { statusCode?: number | string; status?: number | string }
      | undefined;
    const data = (error as { data?: Record<string, unknown> }).data as
      | {
          statusCode?: number | string;
          status?: number | string;
          code?: number | string;
        }
      | undefined;

    const candidates = [
      output?.statusCode,
      payload?.statusCode,
      payload?.status,
      data?.statusCode,
      data?.status,
      data?.code,
      (error as { statusCode?: number | string }).statusCode,
    ];

    for (const code of candidates) {
      if (typeof code === 'number') return code;
      if (typeof code === 'string' && code.trim() !== '') {
        const parsed = Number(code);
        if (!Number.isNaN(parsed)) return parsed;
      }
    }
    return undefined;
  }
}
