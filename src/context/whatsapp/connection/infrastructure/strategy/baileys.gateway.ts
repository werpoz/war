import { WhatsappGateway } from '../../domain/services/whatsapp.gateway';
import { AuthStorageFactory } from '../factory/auth-storage.factory';
import { BaileysSessionProvider } from '../providers/baileys/baileys-session.provider';
import { SessionSocketListener } from '../providers/baileys/session.socket.listener';

export class BaileysGateway implements WhatsappGateway {
  constructor(
    private readonly storageFactory: AuthStorageFactory,
    private readonly provider: BaileysSessionProvider,
    private readonly listener: SessionSocketListener,
  ) {}

  async startSession(
    sessionId: string,
    opts?: { phone?: string; storage?: string },
  ): Promise<string | undefined> {
    const storage = opts?.storage ?? 'file';
    const { state, saveCreds } = await this.storageFactory.create(
      'baileys',
      storage,
      sessionId,
    );
    await this.provider.createWithAuth(sessionId, state, saveCreds);
    return this.listener.listen(sessionId, opts?.phone);
  }

  async closeSession(sessionId: string) {
    await this.provider.disconnect(sessionId);
  }

  async sendMessage(sessionId: string, to: string, message: string) {
    const session = await this.provider.get(sessionId);
    if (!session) throw new Error('Session not found');
    await session.socket.sendMessage(to, { text: message });
  }

  async listChats(sessionId: string) {
    const session = await this.provider.get(sessionId);
    if (!session) throw new Error('Session not found');
    // ajusta a la API real que uses
    return []; // placeholder
  }
}
