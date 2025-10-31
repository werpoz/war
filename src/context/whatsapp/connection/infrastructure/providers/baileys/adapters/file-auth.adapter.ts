import { useMultiFileAuthState } from '@whiskeysockets/baileys';

export class FileAuthAdapter {
  constructor(private basePath: string) {}
  async create(sessionId: string) {
    const path = `${this.basePath}/sessions/${sessionId}`;
    return useMultiFileAuthState(path);
  }
}
