import makeWASocket, { Browsers, useMultiFileAuthState } from 'baileys';
import { SessionStrategy, SessionBaileys } from './session.strategy';

export class UseMultiFileAuthStateStrategy implements SessionStrategy {
  private path: string = '.';

  async execute(sessionId: string): Promise<SessionBaileys> {
    const storeagePath = `${this.path}/sessions/${sessionId}`;
    const { state, saveCreds } = await useMultiFileAuthState(storeagePath);
    const socket = makeWASocket({
      auth: state,
      browser: Browsers.macOS('Chrome'),
      printQRInTerminal: false,
    });

    socket.ev.on('creds.update', () => {
      void saveCreds();
    });

    return { socket, saveCreds };
  }
}
