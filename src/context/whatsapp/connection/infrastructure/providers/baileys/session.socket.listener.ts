// infrastructure/providers/baileys/session.socket.listener.ts
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BaileysSessionProvider } from './baileys-session.provider';

@Injectable()
export class SessionSocketListener {
  constructor(
    private readonly provider: BaileysSessionProvider,
    private readonly events: EventEmitter2,
  ) {}

  async listen(sessionId: string, phone?: string): Promise<string | undefined> {
    const s = await this.provider.get(sessionId);
    if (!s) return;
    const { socket, saveCreds } = s;

    socket.ev.on('creds.update', () => {
      void saveCreds();
    });

    socket.ev.on('messages.upsert', (msg) => {
      this.events.emit('session.message', { sessionId, msg });
    });

    return new Promise<string | undefined>((resolve) => {
      let settled = false;
      const settle = (qr?: string) => {
        if (settled) return;
        settled = true;
        resolve(qr);
      };

      if (s.qrCode) {
        settle(s.qrCode);
      }

      socket.ev.on('connection.update', (update) => {
        void (async () => {
          if (update.connection) {
            await this.provider.update(sessionId, {
              status: update.connection,
            });
            this.events.emit('session.status', {
              sessionId,
              status: update.connection,
            });
          }
          if (update.qr) {
            await this.provider.update(sessionId, { qrCode: update.qr });
            this.events.emit('session.qr', { sessionId, qr: update.qr });
            settle(update.qr);
          }
          if (update.connection === 'connecting' && phone) {
            try {
              const code = await s.socket.requestPairingCode(phone);
              await this.provider.update(sessionId, { qrCode: code });
              this.events.emit('session.qr', { sessionId, qr: code });
              settle(code);
            } catch {
              //TODO: implement throw error here
              console.log('error');
            }
          }
          if (update.connection === 'open') {
            settle(undefined);
          }
          if (update.connection === 'close') {
            await this.provider.disconnect(sessionId);
            this.events.emit('session.closed', { sessionId });
            settle(undefined);
          }
        })();
      });
    });
  }
}
