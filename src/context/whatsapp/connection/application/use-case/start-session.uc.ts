import {
  SessionRepository,
  type SessionStatus,
} from '../../domain/repository/session.repository';
import { WhatsappStrategyFactory } from '../../infrastructure/factory/wa-strategy.factory';

export class StartSessionUseCase {
  constructor(
    private readonly repo: SessionRepository,
    private readonly waFactory: WhatsappStrategyFactory,
  ) {}

  async execute(input: {
    sessionId: string;
    provider?: string;
    storage?: string;
    phone?: string;
  }): Promise<{ status: SessionStatus; qr?: string }> {
    const provider = input.provider ?? 'baileys';
    const storage = input.storage ?? 'file';
    const existing = await this.repo.findById(input.sessionId);

    if (existing) {
      if (existing.provider !== provider || existing.storage !== storage) {
        throw new Error('Session already exists with different configuration');
      }
      if (existing.status !== 'closed' && existing.status !== 'removed') {
        return { status: existing.status };
      }
    }

    const gateway = this.waFactory.get(provider);
    const qr = await gateway.startSession(input.sessionId, {
      phone: input.phone,
      storage,
    });

    await this.repo.save({
      id: input.sessionId,
      provider,
      storage,
      status: 'starting',
    });
    return { qr, status: 'starting' };
  }
}
