import { promises as fs } from 'fs';
import { join } from 'path';
import { useMultiFileAuthState } from '@whiskeysockets/baileys';

export type FileAuthState = Awaited<
  ReturnType<typeof useMultiFileAuthState>
> & {
  clear: () => Promise<void>;
};

export class FileAuthAdapter {
  constructor(private basePath: string) {}
  async create(sessionId: string): Promise<FileAuthState> {
    const dir = join(this.basePath, 'sessions', sessionId);
    const result = await useMultiFileAuthState(dir);
    const clear = async () => {
      await fs.rm(dir, { recursive: true, force: true });
    };
    return { ...result, clear };
  }
}
