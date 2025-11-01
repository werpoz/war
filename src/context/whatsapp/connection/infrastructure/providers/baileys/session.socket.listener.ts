// infrastructure/providers/baileys/session.socket.listener.ts
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { BaileysEventMap } from '@whiskeysockets/baileys';
import { BaileysSessionProvider } from './baileys-session.provider';
import type { SessionBaileys } from './baileys-session.provider';

@Injectable()
export class SessionSocketListener {
  private readonly logger = new Logger(SessionSocketListener.name);
  private readonly boundSessions = new Set<string>();
  private readonly pendingPairing = new Map<string, string>();

  constructor(
    private readonly provider: BaileysSessionProvider,
    private readonly events: EventEmitter2,
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

    const { socket, saveCreds } = session;

    const credsHandler = () => {
      void saveCreds();
    };

    const messagesHandler = (msg: BaileysEventMap['messages.upsert']) => {
      this.events.emit('session.message', { sessionId, msg });
    };

    const connectionHandler = (
      update: BaileysEventMap['connection.update'],
    ) => {
      void this.handleConnectionUpdate(sessionId, session, update);
    };

    socket.ev.on('creds.update', credsHandler);
    socket.ev.on('messages.upsert', messagesHandler);
    socket.ev.on('connection.update', connectionHandler);

    this.boundSessions.add(sessionId);
  }

  private async handleConnectionUpdate(
    sessionId: string,
    session: SessionBaileys,
    update: BaileysEventMap['connection.update'],
  ) {
    const { connection, qr } = update;

    if (connection) {
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
      await this.provider.disconnect(sessionId);
      this.events.emit('session.closed', { sessionId });
      this.boundSessions.delete(sessionId);
    }
  }
}
