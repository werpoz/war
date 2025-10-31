// infrastructure/factories/auth-storage.factory.ts
import { Injectable } from '@nestjs/common';
import { FileAuthAdapter } from '../providers/baileys/adapters/file-auth.adapter';

@Injectable()
export class AuthStorageFactory {
  constructor(private readonly fileAdapter: FileAuthAdapter) {}

  async create(provider: string, storage: string, sessionId: string) {
    switch (storage) {
      case 'file':
        return this.fileAdapter.create(sessionId);
      default:
        throw new Error(`Unknown storage: ${storage}`);
    }
  }
}
